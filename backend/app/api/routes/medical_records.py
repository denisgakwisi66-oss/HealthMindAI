from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.config import settings
from app.core.exceptions import (
    ApiException,
    AuthorizationError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord, RecordType
from app.models.user import User, UserRole
from app.services.medical_record_storage import (
    delete_medical_record,
    load_medical_record,
    store_medical_record,
)
from loguru import logger

router = APIRouter(prefix='/api', tags=['medical-records'])

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}


def _record_to_dict(r: MedicalRecord) -> dict[str, Any]:
    return {
        'id': r.id,
        'patient_id': r.patient_id,
        'doctor_id': r.doctor_id,
        'title': r.title,
        'record_type': r.record_type.value,
        'notes': r.notes,
        'file_name': r.file_name,
        'file_size': r.file_size,
        'created_at': r.created_at.isoformat() + 'Z' if r.created_at else None,
    }


async def _doctor_has_access(db: AsyncSession, doctor_id: str, patient_id: str) -> bool:
    r = await db.execute(select(Appointment.id).where(
        Appointment.doctor_id == doctor_id,
        Appointment.patient_id == patient_id,
    ).limit(1))
    return r.first() is not None


async def _user_can_view(db: AsyncSession, record: MedicalRecord, user: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.PATIENT:
        return record.patient_id == user.id
    return await _doctor_has_access(db, user.id, record.patient_id)


async def _validate_upload(file: UploadFile | None) -> None:
    if file is None:
        return
    suffix = Path(file.filename or '').suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ApiException('VALIDATION_ERROR', f'Unsupported file type. Allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))}.')
    size = 0
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    while True:
        chunk = await file.read(1024 * 512)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise ApiException('VALIDATION_ERROR', f'File is too large. Maximum size is {settings.max_upload_size_mb}MB.')
    await file.seek(0)


@router.get('/medical-records')
async def list_records(
    patient_id: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(MedicalRecord)

    if current_user.role == UserRole.PATIENT:
        query = query.where(MedicalRecord.patient_id == current_user.id)
    elif current_user.role == UserRole.DOCTOR:
        subquery = select(Appointment.patient_id).where(Appointment.doctor_id == current_user.id).scalar_subquery()
        query = query.where(or_(
            MedicalRecord.doctor_id == current_user.id,
            and_(MedicalRecord.doctor_id.is_(None), MedicalRecord.patient_id.in_(subquery)),
        ))
    # Admins see all.

    if patient_id is not None:
        query = query.where(MedicalRecord.patient_id == patient_id)
    if search:
        query = query.where(MedicalRecord.title.ilike(f'%{search}%'))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(
        query.order_by(MedicalRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    records = [r for r in rows if await _user_can_view(db, r, current_user)]
    return {'records': [_record_to_dict(r) for r in records], 'total': total or 0, 'page': page, 'page_size': page_size}


@router.post('/medical-records')
async def create_record(
    request: Request,
    title: str = Form(...),
    record_type: str = Form(...),
    notes: str = Form(''),
    patient_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        rtype = RecordType(record_type)
    except ValueError:
        # Map frontend labels to enum values.
        mapping = {'history': 'consultation', 'lab': 'lab_report', 'document': 'other', 'medical_history': 'consultation'}
        rtype = RecordType(mapping.get(record_type, 'other'))

    target_patient = current_user.id
    if patient_id is not None:
        if current_user.role == UserRole.PATIENT:
            raise AuthorizationError('You can only add records to your own profile.')
        target_patient = patient_id

    await _validate_upload(file)
    file_name = None
    file_path = None
    file_size = None
    if file and file.filename:
        original_name = Path(file.filename).name
        file_path = f'{uuid.uuid4().hex}{Path(original_name).suffix.lower()}'
        content = await file.read()
        await store_medical_record(file_path, content, file.content_type)
        file_name = original_name
        file_size = len(content)

    record = MedicalRecord(
        patient_id=target_patient,
        doctor_id=current_user.id if current_user.role == UserRole.DOCTOR else None,
        title=title,
        record_type=rtype,
        notes=notes or None,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
    )
    db.add(record)
    try:
        await db.commit()
        await db.refresh(record)
    except SQLAlchemyError:
        await db.rollback()
        if file_path:
            try:
                await delete_medical_record(file_path)
            except (ServiceUnavailableError, OSError):
                logger.exception('Failed to clean up an uploaded medical record after database failure.')
        raise
    await log_audit(db, action='record.create', user_id=current_user.id,
                    resource_type='medical_record', resource_id=record.id,
                    details={'record_type': rtype.value}, request=request)
    return _record_to_dict(record)


@router.get('/medical-records/{record_id}/download')
async def download_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError('Record not found.')
    if not await _user_can_view(db, record, current_user):
        raise AuthorizationError('You do not have permission to download this record.')
    if not record.file_path:
        raise NotFoundError('This record has no attached file.')
    file_name = record.file_name or f'record-{record.id}'
    return Response(
        content=await load_medical_record(record.file_path),
        media_type=mimetypes.guess_type(file_name)[0] or 'application/octet-stream',
        headers={
            'Cache-Control': 'private, no-store',
            'Content-Disposition': f"attachment; filename*=UTF-8''{quote(file_name, safe='')}",
        },
    )


@router.delete('/medical-records/{record_id}')
async def delete_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError('Record not found.')
    if current_user.role == UserRole.PATIENT and record.patient_id != current_user.id:
        raise AuthorizationError('You can only delete your own records.')
    if current_user.role == UserRole.DOCTOR and record.doctor_id != current_user.id:
        raise AuthorizationError('You can only delete records you authored.')
    if record.file_path:
        await delete_medical_record(record.file_path)
    await db.delete(record)
    await db.commit()
    await log_audit(db, action='record.delete', user_id=current_user.id,
                    resource_type='medical_record', resource_id=record_id, request=request)
    return {'message': 'Record deleted.'}