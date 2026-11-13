from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Query, Request
from loguru import logger
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_roles, user_to_dict
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.config import settings
from app.core.exceptions import ApiException, NotFoundError, ServiceUnavailableError
from app.models.audit_log import AuditLog
from app.models.doctor import Doctor
from app.models.user import User, UserRole

router = APIRouter(prefix='/api/admin', tags=['admin'])


class StatusUpdate(BaseModel):
    is_active: bool


class RoleUpdate(BaseModel):
    role: UserRole


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal['patient', 'doctor'] = 'patient'
    specialty: str | None = Field(default=None, min_length=2, max_length=120)

    @model_validator(mode='after')
    def validate_doctor_specialty(self) -> 'UserCreate':
        if self.role == 'doctor':
            specialty = (self.specialty or '').strip()
            if not specialty:
                raise ValueError('A specialty is required when creating a doctor.')
            self.specialty = specialty
        else:
            self.specialty = None
        return self


class DoctorProfileUpdate(BaseModel):
    specialty: str = Field(min_length=2, max_length=120)

    @staticmethod
    def normalize_specialty(value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError('Specialty must contain at least 2 characters.')
        return value

    @model_validator(mode='after')
    def trim_specialty(self) -> 'DoctorProfileUpdate':
        self.specialty = self.normalize_specialty(self.specialty)
        return self


async def _get_user(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError('User not found.')
    return user


@router.post('/users')
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    if not settings.supabase_admin_configured:
        raise ServiceUnavailableError('Account creation is not configured.')

    key = settings.supabase_service_role_key.get_secret_value()
    headers = {'apikey': key}
    if not settings.supabase_uses_new_api_keys:
        headers['Authorization'] = f'Bearer {key}'
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f'{settings.supabase_url.rstrip("/")}/auth/v1/admin/users',
                headers=headers,
                json={
                    'email': str(payload.email),
                    'password': payload.password,
                    'email_confirm': True,
                    'user_metadata': {
                        'full_name': payload.full_name,
                        'role': payload.role,
                    },
                },
            )
    except httpx.HTTPError as exc:
        logger.error('Admin user creation failed to reach Supabase: {}', type(exc).__name__)
        raise ServiceUnavailableError('Account creation is temporarily unavailable.') from exc

    if response.status_code >= 400:
        if 'already been registered' in response.text.lower():
            raise ApiException('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.')
        logger.error('Supabase admin user creation failed with HTTP {}.', response.status_code)
        raise ServiceUnavailableError('Could not create the account. Please try again.')

    try:
        user_id = response.json().get('id')
    except ValueError as exc:
        logger.error('Supabase admin user creation returned an invalid response.')
        raise ServiceUnavailableError('Could not create the account. Please try again.') from exc
    if not user_id:
        logger.error('Supabase admin user creation returned no user ID.')
        raise ServiceUnavailableError('Could not create the account. Please try again.')
    try:
        doctor_user_id = UUID(user_id)
    except (TypeError, ValueError) as exc:
        logger.error('Supabase admin user creation returned an invalid user ID.')
        raise ServiceUnavailableError('Could not create the account. Please try again.') from exc
    if payload.role == 'doctor':
        doctor_result = await db.execute(select(Doctor).where(Doctor.user_id == doctor_user_id))
        doctor = doctor_result.scalar_one_or_none()
        if doctor:
            doctor.specialty = payload.specialty
        else:
            db.add(Doctor(user_id=doctor_user_id, specialty=payload.specialty))
        await db.commit()

    await log_audit(
        db,
        action='admin.user.create',
        user_id=current_user.id,
        resource_type='user',
        resource_id=str(user_id) if user_id else None,
        details={'role': payload.role, 'specialty': payload.specialty},
        request=request,
    )
    return {'message': 'User created successfully.'}


@router.get('/users')
async def list_users(
    role: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(User)
    if role:
        try:
            query = query.where(User.role == UserRole(role))
        except ValueError:
            raise ApiException('VALIDATION_ERROR', 'Invalid role filter.')
    if search:
        query = query.where(or_(User.full_name.ilike(f'%{search}%'), User.email.ilike(f'%{search}%')))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    doctor_rows = (await db.execute(
        select(Doctor.user_id, Doctor.specialty).where(Doctor.user_id.in_([u.id for u in rows]))
    )).all() if rows else []
    specialties = {str(user_id): specialty for user_id, specialty in doctor_rows}
    users = []
    for user in rows:
        item = user_to_dict(user)
        item['specialty'] = specialties.get(str(user.id)) if user.role == UserRole.DOCTOR else None
        users.append(item)
    return {'users': users, 'total': total or 0, 'page': page, 'page_size': page_size}


@router.patch('/users/{user_id}/status')
async def update_user_status(
    user_id: str,
    payload: StatusUpdate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if user_id == str(current_user.id):
        raise ApiException('VALIDATION_ERROR', 'You cannot disable your own account.')
    user = await _get_user(db, user_id)
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    await log_audit(db, action='admin.user.status', user_id=current_user.id,
                    resource_type='user', resource_id=user_id,
                    details={'is_active': payload.is_active}, request=request)
    return {'user': user_to_dict(user)}


@router.patch('/users/{user_id}/role')
async def update_user_role(
    user_id: str,
    payload: RoleUpdate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if user_id == str(current_user.id):
        raise ApiException('VALIDATION_ERROR', 'You cannot change your own role.')
    user = await _get_user(db, user_id)
    user.role = payload.role
    if payload.role == UserRole.DOCTOR:
        doctor_result = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
        if not doctor_result.scalar_one_or_none():
            db.add(Doctor(user_id=user.id, specialty='General Medicine'))
    await db.commit()
    await db.refresh(user)
    await log_audit(db, action='admin.user.role', user_id=current_user.id,
                    resource_type='user', resource_id=user_id,
                    details={'role': payload.role.value}, request=request)
    return {'user': user_to_dict(user)}


@router.patch('/users/{user_id}/doctor-profile')
async def update_doctor_profile(
    user_id: str,
    payload: DoctorProfileUpdate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    user = await _get_user(db, user_id)
    if user.role != UserRole.DOCTOR:
        raise ApiException('VALIDATION_ERROR', 'Only doctor accounts can have a specialty.')

    result = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        doctor = Doctor(user_id=user.id, specialty=payload.specialty)
        db.add(doctor)
    else:
        doctor.specialty = payload.specialty
    await db.commit()
    await log_audit(
        db,
        action='admin.doctor.specialty',
        user_id=current_user.id,
        resource_type='doctor',
        resource_id=user_id,
        details={'specialty': payload.specialty},
        request=request,
    )
    return {'specialty': payload.specialty}


@router.get('/audit-logs')
async def list_audit_logs(
    action: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    logs = [{
        'id': a.id, 'action': a.action, 'user_id': a.user_id,
        'resource_type': a.resource_type, 'resource_id': a.resource_id,
        'ip': a.ip, 'created_at': a.created_at.isoformat() + 'Z' if a.created_at else None,
    } for a in rows]
    return {'logs': logs, 'total': total or 0, 'page': page, 'page_size': page_size}