"""Internal read APIs for n8n Cron / reminder workflows.

Protected by the shared automation secret (same value as N8N_WEBHOOK_SECRET)
via header ``X-HealthMind-Automation-Key``. These endpoints never require a
user JWT — n8n is the caller.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.models.appointment import Appointment, AppointmentStatus
from app.models.medication import Medication
from app.models.user import User

router = APIRouter(prefix='/api/automation', tags=['automation'])

# Reminder windows assume Africa/Kigali local wall-clock for schedule strings.
LOCAL_TZ = ZoneInfo('Africa/Kigali')

ACTIVE_APPOINTMENT_STATUSES = {
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
}


async def require_automation_key(
    x_healthmind_automation_key: str | None = Header(default=None, alias='X-HealthMind-Automation-Key'),
) -> None:
    expected = settings.n8n_webhook_secret.get_secret_value().strip()
    if not expected:
        raise AuthenticationError(
            'Automation API is disabled until N8N_WEBHOOK_SECRET is configured.'
        )
    if not x_healthmind_automation_key or x_healthmind_automation_key.strip() != expected:
        raise AuthenticationError('Invalid or missing X-HealthMind-Automation-Key.')


def _parse_hhmm(value: str) -> time | None:
    value = value.strip()
    if not value:
        return None
    try:
        hour, minute = value.split(':', 1)
        return time(int(hour), int(minute))
    except (TypeError, ValueError):
        return None


def _combine_local(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=LOCAL_TZ)


@router.get('/appointments/upcoming', dependencies=[Depends(require_automation_key)])
async def list_upcoming_appointments(
    within_hours: int = Query(24, ge=1, le=72),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Appointments starting within the next ``within_hours`` (local time).

    Used by n8n for T-24h / T-1h reminder Cron jobs. Call twice with
    ``within_hours=24`` and ``within_hours=1`` (or filter client-side).
    """
    now = datetime.now(LOCAL_TZ)
    horizon = now + timedelta(hours=within_hours)

    result = await db.execute(
        select(Appointment).where(
            Appointment.status.in_(tuple(ACTIVE_APPOINTMENT_STATUSES)),
            Appointment.date >= now.date(),
            Appointment.date <= horizon.date(),
        )
    )
    rows = result.scalars().all()

    user_ids = {a.patient_id for a in rows} | {a.doctor_id for a in rows}
    users: dict[Any, User] = {}
    if user_ids:
        urows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users = {u.id: u for u in urows}

    items: list[dict[str, Any]] = []
    for appt in rows:
        slot = _parse_hhmm(appt.time)
        if not slot:
            continue
        starts_at = _combine_local(appt.date, slot)
        if not (now <= starts_at <= horizon):
            continue
        patient = users.get(appt.patient_id)
        doctor = users.get(appt.doctor_id)
        hours_until = (starts_at - now).total_seconds() / 3600.0
        items.append({
            'appointment_id': appt.id,
            'starts_at': starts_at.isoformat(),
            'hours_until': round(hours_until, 2),
            'date': appt.date.isoformat(),
            'time': appt.time,
            'status': appt.status.value if hasattr(appt.status, 'value') else str(appt.status),
            'specialty': appt.specialty,
            'reason': appt.reason,
            'patient': {
                'id': str(appt.patient_id),
                'full_name': patient.full_name if patient else None,
                'email': patient.email if patient else None,
                'phone': getattr(patient, 'phone', None) if patient else None,
            },
            'doctor': {
                'id': str(appt.doctor_id),
                'full_name': doctor.full_name if doctor else None,
                'email': doctor.email if doctor else None,
            },
        })

    items.sort(key=lambda x: x['starts_at'])
    return {
        'within_hours': within_hours,
        'generated_at': now.isoformat(),
        'count': len(items),
        'appointments': items,
    }


@router.get('/medications/due', dependencies=[Depends(require_automation_key)])
async def list_due_medications(
    window_minutes: int = Query(30, ge=5, le=180),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Active medications whose schedule time falls inside the current window.

    ``schedule`` is comma-separated ``HH:MM`` values (e.g. ``09:00,21:00``).
    n8n should poll this every 15–30 minutes.
    """
    now = datetime.now(LOCAL_TZ)
    window = timedelta(minutes=window_minutes)
    today = now.date()

    result = await db.execute(
        select(Medication).where(
            Medication.is_active == True,  # noqa: E712
            or_(Medication.start_date.is_(None), Medication.start_date <= today),
            or_(Medication.end_date.is_(None), Medication.end_date >= today),
        )
    )
    meds = result.scalars().all()

    patient_ids = {m.patient_id for m in meds}
    patients: dict[Any, User] = {}
    if patient_ids:
        prows = (await db.execute(select(User).where(User.id.in_(patient_ids)))).scalars().all()
        patients = {u.id: u for u in prows}

    due: list[dict[str, Any]] = []
    for med in meds:
        if not med.schedule:
            continue
        for part in med.schedule.split(','):
            slot = _parse_hhmm(part)
            if not slot:
                continue
            due_at = _combine_local(today, slot)
            delta = abs(due_at - now)
            if delta > window:
                continue
            patient = patients.get(med.patient_id)
            due.append({
                'medication_id': med.id,
                'name': med.name,
                'dosage': med.dosage,
                'frequency': med.frequency,
                'schedule_time': slot.strftime('%H:%M'),
                'due_at': due_at.isoformat(),
                'minutes_from_now': int((due_at - now).total_seconds() / 60),
                'instructions': med.instructions,
                'patient': {
                    'id': str(med.patient_id),
                    'full_name': patient.full_name if patient else None,
                    'email': patient.email if patient else None,
                    'phone': getattr(patient, 'phone', None) if patient else None,
                },
            })

    due.sort(key=lambda x: x['due_at'])
    return {
        'window_minutes': window_minutes,
        'generated_at': now.isoformat(),
        'count': len(due),
        'medications': due,
    }
