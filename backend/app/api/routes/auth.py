from __future__ import annotations

from datetime import date
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request
from loguru import logger
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.api.dependencies.auth import get_current_user, user_to_dict
from app.api.dependencies.database import get_db
from app.api.dependencies.rate_limit import rate_limit
from app.core.audit import log_audit
from app.core.config import settings
from app.core.exceptions import ApiException, ServiceUnavailableError
from starlette.status import HTTP_502_BAD_GATEWAY
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession

# Authentication itself (signup, login, logout, password reset, OAuth) is
# handled entirely by Supabase Auth, called directly from the frontend with
# the anon key. This router only covers the parts that are still ours: the
# `public.users` profile row, and disabling an account on request.
auth_router = APIRouter(prefix='/auth', tags=['auth'])
users_router = APIRouter(prefix='/users', tags=['users'])


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    profile_picture: str | None = None
    phone: str | None = Field(default=None, max_length=32)
    date_of_birth: str | None = None


class DeleteAccountRequest(BaseModel):
    confirmation: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    date_of_birth: str | None = None
    role: str = 'patient'

    @field_validator('role')
    @classmethod
    def restrict_public_role(cls, value: str) -> str:
        # Public self-registration must never create a doctor/admin account
        # by way of a typo or a tampered request — same rule the
        # on_auth_user_created trigger enforces independently for
        # role coming from user_metadata (defense in depth).
        return value if value in ('patient', 'doctor') else 'patient'


def _supabase_admin_headers() -> dict[str, str]:
    headers = {'apikey': settings.supabase_service_role_key.get_secret_value()}
    if not settings.supabase_uses_new_api_keys:
        headers['Authorization'] = f'Bearer {settings.supabase_service_role_key.get_secret_value()}'
    return headers


def _parse_dob(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Date of birth must be in YYYY-MM-DD format.')


@auth_router.post('/register', dependencies=[Depends(rate_limit(settings.rate_limit_per_minute))])
async def register(payload: RegisterRequest) -> dict[str, str]:
    """Create an account via Supabase's Admin API with `email_confirm: true`
    set explicitly, so account creation never depends on the project's
    dashboard-level "Confirm email" setting. The public.users (+
    patients/doctors) row is created by the same on_auth_user_created
    trigger a normal supabase.auth.signUp() would fire — this only changes
    *how* the auth.users row is created, not what happens after. The
    frontend signs the user in immediately afterward with the same
    credentials (supabase.auth.signInWithPassword), exactly like a returning
    user logging in.
    """
    if not settings.supabase_admin_configured:
        raise ServiceUnavailableError(
            'Account creation is not configured. Set valid Supabase URL, anon key, and service-role key in backend/.env.'
        )

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f'{settings.supabase_url}/auth/v1/admin/users',
            headers=_supabase_admin_headers(),
            json={
                'email': payload.email,
                'password': payload.password,
                'email_confirm': True,
                'user_metadata': {
                    'full_name': payload.full_name,
                    'phone': payload.phone,
                    'date_of_birth': payload.date_of_birth,
                    'role': payload.role,
                },
            },
        )

    if 'already been registered' in resp.text.lower():
        raise ApiException('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.')
    if resp.status_code >= 400:
        logger.error('Supabase admin create_user failed with HTTP %s.', resp.status_code)
        raise ApiException(
            'REGISTRATION_FAILED', 'Could not create the account. Please try again.',
            status_code=HTTP_502_BAD_GATEWAY,
        )

    return {'message': 'Account created.'}


@auth_router.get('/me')
@users_router.get('/me')
async def get_me(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {'user': user_to_dict(current_user)}


@users_router.put('/profile')
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.profile_picture is not None:
        current_user.profile_picture = data.profile_picture
    if data.phone is not None:
        current_user.phone = data.phone
    if data.date_of_birth is not None:
        current_user.date_of_birth = _parse_dob(data.date_of_birth)
    await db.commit()
    await db.refresh(current_user)
    await log_audit(db, action='profile.update', user_id=current_user.id, request=request)
    return {'user': user_to_dict(current_user)}


@users_router.delete('/delete')
async def delete_account(
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    if data.confirmation.lower() != 'delete':
        raise ApiException('CONFIRMATION_REQUIRED', 'Please confirm account deletion with the word DELETE.')

    current_user.is_active = False
    await db.commit()
    await log_audit(db, action='account.delete', user_id=current_user.id, request=request)

    # Also disable the Supabase Auth identity itself, so the account can no
    # longer sign in even though we keep the row for audit-history integrity.
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.put(
                f'{settings.supabase_url}/auth/v1/admin/users/{current_user.id}',
                headers=_supabase_admin_headers(),
                json={'ban_duration': '876000h'},
            )
    except Exception as exc:
        logger.warning(f'Failed to disable Supabase auth user {current_user.id}: {exc}')

    return {'message': 'Account deleted successfully.'}
