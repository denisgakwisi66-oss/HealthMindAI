from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_roles
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.exceptions import ApiException, AuthorizationError, NotFoundError
from app.core.notification_email import notify_admin
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Availability, Doctor
from app.models.user import User, UserRole
from app.services.notifications import create_notification

router = APIRouter(prefix='/api', tags=['appointments'])

# A booking conflict surfaced as a sanitised message regardless of source.
CONFLICT = 'This time slot is no longer available. Please choose another time.'


class AppointmentCreateRequest(BaseModel):
    specialty: str | None = None
    doctor_id: str
    date: str
    time: str = Field(pattern=r'^\d{2}:\d{2}$')
    notes: str | None = None


class CancelRequest(BaseModel):
    reason: str = 'Cancelled by patient'


class StatusRequest(BaseModel):
    status: str


def _appointment_to_dict(appt: Appointment, doctor_name: str | None, patient_name: str | None) -> dict[str, Any]:
    return {
        'id': appt.id,
        'patient_id': appt.patient_id,
        'patient_name': patient_name,
        'doctor_id': appt.doctor_id,
        'doctor_name': doctor_name,
        'specialty': appt.specialty,
        'date': appt.date.isoformat() if appt.date else None,
        'time': appt.time,
        'reason': appt.reason,
        'status': appt.status.value,
        'created_at': appt.created_at.isoformat() + 'Z' if appt.created_at else None,
    }


async def _get_doctor_profile_by_user(db: AsyncSession, doctor_user_id: str) -> Doctor | None:
    result = await db.execute(select(Doctor).where(Doctor.user_id == doctor_user_id))
    return result.scalar_one_or_none()


async def _booked_times(db: AsyncSession, doctor_user_id: str, target_date: date) -> set[str]:
    result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_user_id,
            Appointment.date == target_date,
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    )
    return {a.time for a in result.scalars().all()}


def _build_slots(start: time, end: time, minutes: int) -> list[str]:
    if minutes <= 0:
        minutes = 30
    slots: list[str] = []
    current_time = start
    while True:
        if current_time >= end:
            break
        slots.append(current_time.strftime('%H:%M'))
        current_time = (datetime.combine(date(2020, 1, 1), current_time) + timedelta(minutes=minutes)).time()
        if current_time == start:
            break
    return slots


@router.get('/appointments')
async def list_appointments(
    status: str = 'all',
    date_from: str | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List appointments. Patients see their own; doctors see theirs; admins see all."""
    query = select(Appointment)

    if current_user.role == UserRole.PATIENT:
        query = query.where(Appointment.patient_id == current_user.id)
    elif current_user.role == UserRole.DOCTOR:
        query = query.where(Appointment.doctor_id == current_user.id)

    if status and status != 'all':
        try:
            query = query.where(Appointment.status == AppointmentStatus(status))
        except ValueError:
            raise ApiException('VALIDATION_ERROR', 'Invalid appointment status filter.')

    if date_from:
        try:
            query = query.where(Appointment.date >= date.fromisoformat(date_from))
        except ValueError:
            raise ApiException('VALIDATION_ERROR', 'date_from must be YYYY-MM-DD.')

    rows = (await db.execute(query.order_by(Appointment.date.asc(), Appointment.time.asc()))).scalars().all()

    user_ids = set()
    for a in rows:
        user_ids.add(a.doctor_id)
        if current_user.role in (UserRole.DOCTOR, UserRole.ADMIN):
            user_ids.add(a.patient_id)
    name_map: dict[str, str] = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        name_map = {u.id: u.full_name for u in users}

    appointments = [
        _appointment_to_dict(a, name_map.get(a.doctor_id), name_map.get(a.patient_id))
        for a in rows
    ]
    return {'appointments': appointments, 'total': len(appointments)}


@router.get('/appointments/specialties')
async def get_specialties(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(Doctor.specialty).where(Doctor.specialty.isnot(None)).distinct())
    specialties = [{'id': s, 'name': s} for s in result.scalars().all() if s]
    known = ['Cardiology', 'General Medicine', 'Dermatology', 'Pediatrics', 'Orthopedics', 'Neurology']
    existing = {s['name'] for s in specialties}
    for name in known:
        if name not in existing:
            specialties.append({'id': name, 'name': name})
    return {'specialties': specialties}


@router.get('/appointments/doctors')
async def get_doctors(specialty: str | None = None, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    query = (
        select(Doctor, User.full_name)
        .join(User, User.id == Doctor.user_id)
        .where(User.is_active == True, Doctor.is_accepting_new == True)  # noqa: E712
    )
    if specialty:
        query = query.where(Doctor.specialty == specialty)
    rows = (await db.execute(query.order_by(User.full_name))).all()
    doctors = [
        {
            'id': doctor.user_id,
            'name': f'Dr. {full_name}',
            'specialty': doctor.specialty,
            'years_experience': doctor.years_experience,
            'location': doctor.location,
            'fee': doctor.consultation_fee,
        }
        for doctor, full_name in rows
    ]
    return {'doctors': doctors}


@router.get('/appointments/available-slots')
async def get_available_slots(doctor_id: str, date: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    try:
        target_date = date.fromisoformat(date)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Date must be in YYYY-MM-DD format.')

    doctor_profile = await _get_doctor_profile_by_user(db, doctor_id)
    if not doctor_profile:
        raise NotFoundError('Doctor not found.')

    weekday = target_date.weekday()
    result = await db.execute(select(Availability).where(Availability.doctor_id == doctor_profile.id, Availability.weekday == weekday))
    windows = result.scalars().all()

    if target_date < datetime.utcnow().date():
        return {'slots': [], 'message': 'This date is in the past.'}

    all_slots: list[str] = []
    for window in windows:
        all_slots.extend(_build_slots(window.start_time, window.end_time, window.slot_minutes))

    all_slots = list(dict.fromkeys(all_slots))  # de-duplicate across windows
    booked = await _booked_times(db, doctor_id, target_date)
    available = [s for s in all_slots if s not in booked]
    return {'slots': available}


@router.post('/appointments')
async def create_appointment(
    payload: AppointmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if current_user.role != UserRole.PATIENT:
        raise AuthorizationError('Only patients can book appointments.')

    try:
        target_date = date.fromisoformat(payload.date)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Date must be in YYYY-MM-DD format.')

    if target_date < datetime.utcnow().date():
        raise ApiException('VALIDATION_ERROR', 'You cannot book an appointment in the past.')

    doctor_profile = await _get_doctor_profile_by_user(db, payload.doctor_id)
    if not doctor_profile or not doctor_profile.is_accepting_new:
        raise NotFoundError('Doctor not found or not accepting new patients.')

    # Application-level double-booking guard.
    booked = await _booked_times(db, payload.doctor_id, target_date)
    if payload.time in booked:
        raise ApiException('SLOT_UNAVAILABLE', CONFLICT)

    # Verify the chosen time is genuinely on the doctor's schedule.
    weekday = target_date.weekday()
    avail = await db.execute(select(Availability).where(
        Availability.doctor_id == doctor_profile.id,
        Availability.weekday == weekday,
    ))
    valid_times: set[str] = set()
    for w in avail.scalars().all():
        valid_times.update(_build_slots(w.start_time, w.end_time, w.slot_minutes))
    if payload.time not in valid_times:
        raise ApiException('SLOT_UNAVAILABLE', 'That time is not within the doctor’s available hours.')

    appointment = Appointment(
        patient_id=current_user.id,
        doctor_id=payload.doctor_id,
        specialty=payload.specialty or doctor_profile.specialty,
        date=target_date,
        time=payload.time,
        reason=payload.notes,
        status=AppointmentStatus.SCHEDULED,
    )
    db.add(appointment)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ApiException('SLOT_UNAVAILABLE', CONFLICT)
    await db.refresh(appointment)

    await create_notification(db, user_id=payload.doctor_id, notif_type='appointment',
                              title='New appointment request',
                              message=f'A patient booked {appointment.time} on {target_date.isoformat()}.')
    await log_audit(db, action='appointment.create', user_id=current_user.id,
                    resource_type='appointment', resource_id=appointment.id, request=request)

    doctor_name = (await db.execute(select(User.full_name).where(User.id == payload.doctor_id))).scalar()
    await notify_admin(
        event_type='appointment_created',
        subject=f'New appointment: {current_user.full_name} with Dr. {doctor_name}',
        text_body=(
            f'{current_user.full_name} booked an appointment with Dr. {doctor_name}\n'
            f'Date: {target_date.isoformat()} at {payload.time}\n'
            f'Reason: {payload.notes or "Not provided"}'
        ),
        resource_type='appointment', resource_id=appointment.id,
    )
    return _appointment_to_dict(appointment, f'Dr. {doctor_name}' if doctor_name else None, current_user.full_name)


@router.post('/appointments/{appointment_id}/cancel')
async def cancel_appointment(
    appointment_id: int,
    payload: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundError('Appointment not found.')
    if appointment.patient_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise AuthorizationError('You can only cancel your own appointments.')

    appointment.status = AppointmentStatus.CANCELLED
    await db.commit()
    await create_notification(db, user_id=appointment.doctor_id, notif_type='appointment',
                              title='Appointment cancelled',
                              message=f'The appointment on {appointment.date.isoformat()} at {appointment.time} was cancelled.')
    await log_audit(db, action='appointment.cancel', user_id=current_user.id,
                    resource_type='appointment', resource_id=appointment.id, details={'reason': payload.reason}, request=request)
    await notify_admin(
        event_type='appointment_status_changed',
        subject=f'Appointment cancelled: #{appointment.id}',
        text_body=(
            f'Appointment #{appointment.id} on {appointment.date.isoformat()} at {appointment.time} '
            f'was cancelled by {current_user.full_name}.\nReason: {payload.reason}'
        ),
        resource_type='appointment', resource_id=appointment.id,
    )
    return {'message': 'Appointment cancelled.'}


@router.put('/doctor/appointments/{appointment_id}/status')
async def update_appointment_status(
    appointment_id: int,
    payload: StatusRequest,
    current_user: User = Depends(require_roles('doctor', 'admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundError('Appointment not found.')

    if current_user.role == UserRole.DOCTOR and appointment.doctor_id != current_user.id:
        raise AuthorizationError('You can only update your own appointments.')

    try:
        new_status = AppointmentStatus(payload.status)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Invalid appointment status.')

    appointment.status = new_status
    await db.commit()
    await log_audit(db, action='appointment.status', user_id=current_user.id,
                    resource_type='appointment', resource_id=appointment.id, details={'status': new_status.value}, request=request)
    await notify_admin(
        event_type='appointment_status_changed',
        subject=f'Appointment #{appointment.id} status: {new_status.value}',
        text_body=(
            f'Appointment #{appointment.id} on {appointment.date.isoformat()} at {appointment.time} '
            f'was updated to "{new_status.value}" by {current_user.full_name}.'
        ),
        resource_type='appointment', resource_id=appointment.id,
    )
    return {'id': appointment.id, 'status': new_status.value, 'message': 'Appointment status updated.'}