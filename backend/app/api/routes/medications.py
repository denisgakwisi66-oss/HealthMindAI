from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.exceptions import ApiException, AuthorizationError, NotFoundError
from app.models.medication import Medication
from app.models.user import User, UserRole

router = APIRouter(prefix='/api', tags=['medications'])


class MedicationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    dosage: str = Field(min_length=1, max_length=120)
    frequency: str = Field(min_length=1, max_length=120)
    schedule: str | None = None
    instructions: str | None = None
    start_date: str | None = None
    end_date: str | None = None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Dates must be in YYYY-MM-DD format.')


def _medication_to_dict(m: Medication) -> dict[str, Any]:
    return {
        'id': m.id,
        'name': m.name,
        'dosage': m.dosage,
        'frequency': m.frequency,
        'schedule': m.schedule,
        'instructions': m.instructions,
        'start_date': m.start_date.isoformat() if m.start_date else None,
        'end_date': m.end_date.isoformat() if m.end_date else None,
        'is_active': m.is_active,
        'times_taken': m.times_taken,
        'times_due': m.times_due,
    }


def _apply_request(m: Medication, payload: MedicationRequest) -> None:
    m.name = payload.name
    m.dosage = payload.dosage
    m.frequency = payload.frequency
    m.schedule = payload.schedule
    m.instructions = payload.instructions
    m.start_date = _parse_date(payload.start_date)
    m.end_date = _parse_date(payload.end_date)


async def _can_view(db: AsyncSession, med: Medication, user: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.PATIENT:
        return med.patient_id == user.id
    # Doctor: read access only for patients they have a record/appointment with.
    from app.models.appointment import Appointment
    from app.models.medical_record import MedicalRecord
    r = await db.execute(select(MedicalRecord.id).where(MedicalRecord.patient_id == med.patient_id, MedicalRecord.doctor_id == user.id).limit(1))
    if r.first():
        return True
    r2 = await db.execute(select(Appointment.id).where(Appointment.patient_id == med.patient_id, Appointment.doctor_id == user.id).limit(1))
    return r2.first() is not None


@router.get('/medications')
async def list_medications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (await db.execute(select(Medication).order_by(Medication.created_at.desc()))).scalars().all()
    result = []
    for med in rows:
        if await _can_view(db, med, current_user):
            result.append(_medication_to_dict(med))
    return {'medications': result}


@router.get('/medications/adherence')
async def get_adherence(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    total = taken = 0
    if current_user.role in (UserRole.PATIENT, UserRole.ADMIN):
        if current_user.role == UserRole.PATIENT:
            rows = (await db.execute(select(Medication).where(Medication.patient_id == current_user.id))).scalars().all()
        else:
            rows = (await db.execute(select(Medication))).scalars().all()
        total = sum(m.times_due for m in rows)
        taken = sum(m.times_taken for m in rows)
    rate = round((taken / total) * 100) if total else 0
    return {'adherence': {'rate': rate, 'total': total, 'taken': taken}}


@router.post('/medications')
async def create_medication(
    payload: MedicationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if current_user.role != UserRole.PATIENT:
        raise AuthorizationError('Only patients can add their own medications.')
    med = Medication(patient_id=current_user.id)
    _apply_request(med, payload)
    db.add(med)
    await db.commit()
    await db.refresh(med)
    await log_audit(db, action='medication.create', user_id=current_user.id,
                    resource_type='medication', resource_id=med.id, request=request)
    return _medication_to_dict(med)


@router.put('/medications/{medication_id}')
async def update_medication(
    medication_id: int,
    payload: MedicationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    med = result.scalar_one_or_none()
    if not med:
        raise NotFoundError('Medication not found.')
    if current_user.role == UserRole.PATIENT and med.patient_id != current_user.id:
        raise AuthorizationError('You can only update your own medications.')
    if current_user.role == UserRole.DOCTOR and not await _can_view(db, med, current_user):
        raise AuthorizationError('You do not have access to this medication.')

    _apply_request(med, payload)
    await db.commit()
    await db.refresh(med)
    await log_audit(db, action='medication.update', user_id=current_user.id,
                    resource_type='medication', resource_id=med.id, request=request)
    return _medication_to_dict(med)


@router.delete('/medications/{medication_id}')
async def delete_medication(
    medication_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    med = result.scalar_one_or_none()
    if not med:
        raise NotFoundError('Medication not found.')
    if current_user.role == UserRole.PATIENT and med.patient_id != current_user.id:
        raise AuthorizationError('You can only delete your own medications.')
    await db.delete(med)
    await db.commit()
    await log_audit(db, action='medication.delete', user_id=current_user.id,
                    resource_type='medication', resource_id=medication_id, request=request)
    return {'message': 'Medication deleted.'}