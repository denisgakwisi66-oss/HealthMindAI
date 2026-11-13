from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from loguru import logger
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.email import send_email
from app.db.session import AsyncSessionLocal
from app.models.medication import Medication
from app.models.medication_reminder import MedicationReminder
from app.models.user import User

LOCAL_TZ = ZoneInfo('Africa/Kigali')
POLL_SECONDS = 15
DELIVERY_GRACE = timedelta(minutes=5)
PROCESSING_LEASE = timedelta(minutes=2)
RETRY_DELAY = timedelta(minutes=1)
MAX_ATTEMPTS = 5
_email_configuration_warning_logged = False


def _schedule_times(schedule: str | None) -> list[time]:
    if not schedule:
        return []
    parsed = []
    for value in schedule.split(','):
        try:
            parsed.append(time.fromisoformat(value.strip()))
        except ValueError:
            logger.warning('Skipping invalid medication reminder time: {}', value)
    return parsed


def _due_occurrences(
    schedule: str | None,
    now: datetime,
    medication_start: date | None = None,
    medication_end: date | None = None,
) -> list[time]:
    local_now = now.astimezone(LOCAL_TZ)
    today = local_now.date()
    if medication_start and medication_start > today:
        return []
    if medication_end and medication_end < today:
        return []
    occurrences = []
    for scheduled_time in _schedule_times(schedule):
        due_at = datetime.combine(today, scheduled_time, tzinfo=LOCAL_TZ)
        elapsed = local_now - due_at
        if timedelta(0) <= elapsed <= DELIVERY_GRACE:
            occurrences.append(scheduled_time)
    return occurrences


async def _claim_occurrence(
    *,
    medication_id: int,
    reminder_date: date,
    reminder_time: str,
    recipient: str,
    now: datetime,
) -> int | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            insert(MedicationReminder)
            .values(
                medication_id=medication_id,
                reminder_date=reminder_date,
                reminder_time=reminder_time,
                recipient=recipient,
                status='processing',
                attempts=1,
                processing_at=now,
            )
            .on_conflict_do_nothing(
                index_elements=[
                    'medication_id',
                    'reminder_date',
                    'reminder_time',
                ]
            )
            .returning(MedicationReminder.id)
        )
        claimed_id = result.scalar_one_or_none()
        if claimed_id is not None:
            await db.commit()
            return claimed_id

        reminder = (
            await db.execute(
                select(MedicationReminder)
                .where(
                    MedicationReminder.medication_id == medication_id,
                    MedicationReminder.reminder_date == reminder_date,
                    MedicationReminder.reminder_time == reminder_time,
                )
                .with_for_update()
            )
        ).scalar_one()
        if reminder.status == 'sent' or reminder.attempts >= MAX_ATTEMPTS:
            await db.rollback()
            return None
        if reminder.status == 'processing' and reminder.processing_at:
            if reminder.processing_at > now - PROCESSING_LEASE:
                await db.rollback()
                return None
        if reminder.next_attempt_at and reminder.next_attempt_at > now:
            await db.rollback()
            return None

        reminder.status = 'processing'
        reminder.attempts += 1
        reminder.processing_at = now
        reminder.next_attempt_at = None
        reminder.error_detail = None
        await db.commit()
        return reminder.id


async def _finish_occurrence(reminder_id: int, sent: bool, now: datetime) -> None:
    async with AsyncSessionLocal() as db:
        reminder = await db.get(MedicationReminder, reminder_id)
        if reminder is None:
            logger.error('Medication reminder {} disappeared before status update.', reminder_id)
            return
        reminder.status = 'sent' if sent else 'failed'
        reminder.sent_at = now if sent else None
        reminder.processing_at = None
        reminder.next_attempt_at = None if sent or reminder.attempts >= MAX_ATTEMPTS else now + RETRY_DELAY
        reminder.error_detail = None if sent else 'Email provider did not confirm delivery.'
        await db.commit()


async def process_due_medication_reminders(now: datetime | None = None) -> None:
    global _email_configuration_warning_logged
    recipient = settings.emergency_recipient.strip()
    if not recipient:
        if not _email_configuration_warning_logged:
            logger.error('Medication reminders are disabled: EMERGENCY_RECIPIENT is empty.')
            _email_configuration_warning_logged = True
        return
    resend_configured = bool(settings.resend_api_key.get_secret_value() and settings.email_from.strip())
    if not settings.smtp_configured and not resend_configured:
        if not _email_configuration_warning_logged:
            logger.error(
                'Medication reminders are disabled because email is not configured; set SMTP '
                'credentials or RESEND_API_KEY and EMAIL_FROM.'
            )
            _email_configuration_warning_logged = True
        return
    _email_configuration_warning_logged = False

    utc_now = now or datetime.now(timezone.utc)
    if utc_now.tzinfo is None:
        utc_now = utc_now.replace(tzinfo=timezone.utc)
    utc_now = utc_now.astimezone(timezone.utc).replace(tzinfo=None)
    local_now = utc_now.replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ)

    async with AsyncSessionLocal() as db:
        medications = (
            await db.execute(
                select(Medication, User)
                .join(User, User.id == Medication.patient_id)
                .where(
                    Medication.is_active == True,  # noqa: E712
                    or_(Medication.start_date.is_(None), Medication.start_date <= local_now.date()),
                    or_(Medication.end_date.is_(None), Medication.end_date >= local_now.date()),
                )
            )
        ).all()

    for medication, patient in medications:
        for scheduled_time in _due_occurrences(
            medication.schedule,
            utc_now.replace(tzinfo=timezone.utc),
            medication.start_date,
            medication.end_date,
        ):
            time_label = scheduled_time.strftime('%H:%M')
            reminder_id = await _claim_occurrence(
                medication_id=medication.id,
                reminder_date=local_now.date(),
                reminder_time=time_label,
                recipient=recipient,
                now=utc_now,
            )
            if reminder_id is None:
                continue

            subject = f'Medication reminder: {medication.name} ({time_label})'
            body = (
                f'Medication reminder for {patient.full_name}.\n\n'
                f'Medication: {medication.name}\n'
                f'Dosage: {medication.dosage}\n'
                f'Scheduled time: {time_label} Africa/Kigali\n'
                f'Instructions: {medication.instructions or "Follow the instructions provided by your clinician."}\n\n'
                'This is an automated reminder. Follow your clinician’s directions.'
            )
            try:
                sent = await send_email(recipient, subject, body)
                await _finish_occurrence(reminder_id, sent, utc_now)
                if sent:
                    logger.info(
                        'Medication reminder sent for medication_id={} scheduled={} {}.',
                        medication.id,
                        local_now.date(),
                        time_label,
                    )
                else:
                    logger.error(
                        'Medication reminder email failed for medication_id={} scheduled={} {}.',
                        medication.id,
                        local_now.date(),
                        time_label,
                    )
            except Exception:
                logger.exception(
                    'Medication reminder delivery raised an error for medication_id={}.',
                    medication.id,
                )
                await _finish_occurrence(reminder_id, False, utc_now)


async def run_medication_reminder_scheduler() -> None:
    logger.info(
        'Medication reminder scheduler started; polling every {} seconds in Africa/Kigali.',
        POLL_SECONDS,
    )
    while True:
        try:
            await process_due_medication_reminders()
        except Exception:
            logger.exception('Medication reminder scheduler iteration failed.')
        await asyncio.sleep(POLL_SECONDS)
