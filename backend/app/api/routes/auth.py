from __future__ import annotations

import os
import secrets
from datetime import date, datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError
from loguru import logger
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.api.dependencies.auth import get_current_user, oauth2_scheme, user_to_dict
from app.api.dependencies.database import get_db
from app.api.dependencies.rate_limit import rate_limit
from app.core.audit import log_audit
from app.core.config import settings
from app.core.email import send_email
from app.core.exceptions import ApiException, AuthenticationError
from app.core.security import (
    create_access_token,
    create_one_time_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.password_reset import PasswordResetToken
from app.models.token import RefreshToken
from app.models.user import User, UserRole

auth_router = APIRouter(prefix='/auth', tags=['auth'])
users_router = APIRouter(prefix='/users', tags=['users'])

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv(
    'GOOGLE_REDIRECT_URI',
    'http://localhost:8000/api/auth/oauth/google/callback',
)
GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    date_of_birth: str | None = None
    role: UserRole = UserRole.PATIENT

    @field_validator('role')
    @classmethod
    def restrict_public_role(cls, value: UserRole) -> UserRole:
        # Public self-registration must never create admin accounts.
        if value == UserRole.ADMIN:
            raise ValueError('Self-registration as an admin is not allowed.')
        return value


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str = Field(min_length=1)


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    profile_picture: str | None = None
    phone: str | None = Field(default=None, max_length=32)
    date_of_birth: str | None = None


def _parse_dob(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiException('VALIDATION_ERROR', 'Date of birth must be in YYYY-MM-DD format.')


async def create_user_tokens(user, db: AsyncSession) -> tuple[str, str]:
    access_jwt = create_access_token({'sub': str(user.id), 'role': user.role.value})
    refresh_jwt = create_refresh_token({'sub': str(user.id), 'role': user.role.value})

    refresh_token_obj = RefreshToken(
        user_id=user.id,
        token=refresh_jwt,
        expires_at=datetime.utcnow() + timedelta(days=settings.jwt_refresh_expire_days),
    )

    # Revoke prior active refresh tokens so each login/refresh yields a single
    # active session and the token table doesn't grow unbounded.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )

    db.add(refresh_token_obj)
    await db.commit()
    return access_jwt, refresh_jwt


@auth_router.post('/login', dependencies=[Depends(rate_limit(settings.rate_limit_login_per_minute))])
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        await log_audit(db, action='login.failed', details={'reason': 'bad_credentials'}, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Invalid email or password.'}},
        )

    if not user.is_active:
        await log_audit(db, action='login.denied', user_id=user.id, details={'reason': 'inactive'}, request=request)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={'error': {'code': 'USER_INACTIVE', 'message': 'Your account is disabled.'}},
        )

    access_token, refresh_token = await create_user_tokens(user, db)
    user.last_login_at = datetime.utcnow()
    await db.commit()
    await log_audit(db, action='login.success', user_id=user.id, request=request)
    return {'access_token': access_token, 'refresh_token': refresh_token, 'user': user_to_dict(user)}


@auth_router.post('/register', dependencies=[Depends(rate_limit(settings.rate_limit_per_minute))])
async def register(data: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'EMAIL_ALREADY_REGISTERED', 'message': 'A user with this email already exists.'}},
        )

    user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        phone=data.phone,
        date_of_birth=_parse_dob(data.date_of_birth),
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()
        if data.role == UserRole.PATIENT:
            db.add(Patient(user_id=user.id))
        elif data.role == UserRole.DOCTOR:
            # Create a minimal doctor profile so the dashboard and scheduling
            # features have a valid linked doctor record immediately after signup.
            db.add(Doctor(user_id=user.id, specialty='General Practice'))
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'REGISTRATION_FAILED', 'message': 'Could not create the account. Please try again.'}},
        )
    await db.refresh(user)
    await log_audit(db, action='register', user_id=user.id, request=request)

    access_token, refresh_token = await create_user_tokens(user, db)
    return {'access_token': access_token, 'refresh_token': refresh_token, 'user': user_to_dict(user)}


@auth_router.post('/logout')
async def logout(
    current_user: User = Depends(get_current_user),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id, RefreshToken.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )
    await db.commit()
    await log_audit(db, action='logout', user_id=current_user.id, request=request)
    return {'message': 'Successfully logged out.'}


@auth_router.get('/me')
async def get_me(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {'user': user_to_dict(current_user)}


@auth_router.post('/refresh')
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    try:
        payload = decode_token(data.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': {'code': 'INVALID_REFRESH_TOKEN', 'message': 'Refresh token is invalid or expired.'}},
        )

    if payload.get('type') != 'refresh':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': {'code': 'INVALID_REFRESH_TOKEN', 'message': 'Refresh token is invalid.'}},
        )

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == data.refresh_token,
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.utcnow(),
        )
    )
    refresh_token_obj = result.scalar_one_or_none()
    if not refresh_token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': {'code': 'INVALID_REFRESH_TOKEN', 'message': 'Refresh token is invalid or revoked.'}},
        )

    user_result = await db.execute(select(User).where(User.id == refresh_token_obj.user_id, User.is_active == True))  # noqa: E712
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': {'code': 'INVALID_USER', 'message': 'User not found or inactive.'}},
        )

    # Rotate: revoke the used refresh token and issue a new pair.
    refresh_token_obj.is_revoked = True
    access_token, new_refresh = await create_user_tokens(user, db)
    return {'access_token': access_token, 'refresh_token': new_refresh}


@auth_router.post('/change-password')
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str]:
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'INVALID_PASSWORD', 'message': 'Current password is incorrect.'}},
        )
    current_user.hashed_password = hash_password(data.new_password)
    # Invalidate all other sessions after a password change.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id, RefreshToken.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )
    await db.commit()
    await log_audit(db, action='password.change', user_id=current_user.id, request=request)
    return {'message': 'Password updated successfully.'}


@auth_router.post('/forgot-password', dependencies=[Depends(rate_limit(settings.rate_limit_per_minute))])
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Issue an expiring, single-use reset token and email a reset link."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        raw_token, token_hash = create_one_time_token({}, settings.jwt_access_expire_minutes)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=30),
        ))
        await db.commit()

        reset_url = f'{settings.frontend_url.rstrip("/")}/reset-password.html?token={raw_token}'
        await send_email(
            user.email,
            'Reset your HealthMind AI password',
            f'Hello {user.full_name},\n\n'
            f'Click the link below to reset your password (valid for 30 minutes):\n{reset_url}\n\n'
            'If you did not request this, you can safely ignore this email.',
            f'<p>Hello {user.full_name},</p><p>Click the link below to reset your password '
            f'(valid for 30 minutes):</p><p><a href="{reset_url}">Reset my password</a></p>'
            '<p style="color:#666">If you did not request this, you can safely ignore this email.</p>',
        )

    # Always return the same message to prevent user enumeration.
    return {'message': 'If that email exists in our system, password reset instructions have been sent.'}


@auth_router.post('/reset-password', dependencies=[Depends(rate_limit(settings.rate_limit_per_minute))])
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Validate an expiring single-use reset token; hash + store the new password."""
    now = datetime.utcnow()
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.expires_at > now,
            PasswordResetToken.used_at.is_(None),
        )
    )
    tokens = result.scalars().all()

    matched = None
    for token_obj in tokens:
        if verify_password(data.token, token_obj.token_hash):
            matched = token_obj
            break

    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'INVALID_RESET_TOKEN', 'message': 'This reset link is invalid or has expired.'}},
        )

    user_result = await db.execute(select(User).where(User.id == matched.user_id, User.is_active == True))  # noqa: E712
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'INVALID_USER', 'message': 'Account not found.'}},
        )

    user.hashed_password = hash_password(data.new_password)
    matched.used_at = now
    # Invalidate all existing sessions.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )
    await db.commit()
    await log_audit(db, action='password.reset', user_id=user.id)
    return {'message': 'Password reset completed. Please log in with your new password.'}


@users_router.get('/me')
async def get_me(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the currently authenticated user's profile."""
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'CONFIRMATION_REQUIRED', 'message': 'Please confirm account deletion with the word DELETE.'}},
        )
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': {'code': 'INVALID_PASSWORD', 'message': 'Current password is incorrect.'}},
        )
    current_user.is_active = False
    await db.commit()
    await log_audit(db, action='account.delete', user_id=current_user.id, request=request)
    return {'message': 'Account deleted successfully.'}


@auth_router.get('/oauth/apple')
async def apple_oauth_login() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={'error': {'code': 'NOT_IMPLEMENTED', 'message': 'Apple OAuth is not configured for this backend.'}},
    )


@auth_router.get('/oauth/google')
async def google_oauth_login() -> RedirectResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail='Google OAuth is not configured.')
    state = secrets.token_urlsafe(32)
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'email profile openid',
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state,
    }
    return RedirectResponse(f'{GOOGLE_AUTH_URL}?{urlencode(params)}')


@auth_router.get('/oauth/google/callback')
async def google_oauth_callback(
    request: Request,
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error:
        raise HTTPException(status_code=400, detail=f'Google OAuth error: {error}')
    if not code:
        raise HTTPException(status_code=400, detail='Authorization code not provided')
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail='Google OAuth is not configured.')

    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'code': code,
                    'redirect_uri': GOOGLE_REDIRECT_URI,
                    'grant_type': 'authorization_code',
                },
                headers={'Accept': 'application/json'},
            )
            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail='Failed to get access token from Google.')
            token_data = token_response.json()
            access_token = token_data.get('access_token')
            if not access_token:
                raise HTTPException(status_code=400, detail='No access token received.')

            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={'Authorization': f'Bearer {access_token}'},
            )
            if userinfo_response.status_code != 200:
                raise HTTPException(status_code=400, detail='Failed to get user info from Google.')
            user_info = userinfo_response.json()

        email = user_info.get('email')
        full_name = user_info.get('name', 'Google User')
        google_id = user_info.get('id')
        picture = user_info.get('picture')
        if not email:
            raise HTTPException(status_code=400, detail='No email received from Google.')

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                google_id=google_id,
                profile_picture=picture,
                role=UserRole.PATIENT,
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.flush()
            db.add(Patient(user_id=user.id))
            await db.commit()
            await db.refresh(user)
            await log_audit(db, action='register.oauth.google', user_id=user.id, request=request)

        access_jwt, refresh_jwt = await create_user_tokens(user, db)
        frontend_url = settings.frontend_url.rstrip('/')
        redirect_url = f'{frontend_url}/oauth-callback?access_token={access_jwt}&refresh_token={refresh_jwt}'
        return RedirectResponse(redirect_url)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f'Google OAuth error: {exc}')
        raise HTTPException(status_code=500, detail='OAuth processing error.')