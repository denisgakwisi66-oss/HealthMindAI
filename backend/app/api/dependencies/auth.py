from __future__ import annotations

from typing import Any

import httpx
from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import verify_supabase_token
from app.models.user import User

oauth2_scheme = HTTPBearer(auto_error=False)


def user_to_dict(user: User) -> dict[str, Any]:
    """Shared, safe serialisation of a user. Never expose auth internals."""
    return {
        'id': str(user.id),
        'email': user.email,
        'full_name': user.full_name,
        'profile_picture': user.profile_picture,
        'role': user.role.value if user.role else 'patient',
        'phone': getattr(user, 'phone', None),
        'date_of_birth': getattr(user, 'date_of_birth', None),
        'is_verified': user.is_verified,
        'is_active': user.is_active,
        'created_at': user.created_at.isoformat() if user.created_at else None,
    }


def require_roles(*roles: str):
    """Dependency factory enforcing role-based access on an endpoint.

    Usage: ``current_user: User = Depends(require_roles('doctor', 'admin'))``
    """
    allowed = set(roles)

    async def dependency(
        current_user: User = Depends(_get_current_user),
    ) -> User:
        if current_user.role.value not in allowed:
            raise AuthorizationError('You do not have permission to perform this action.')
        return current_user

    return dependency


async def _get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise AuthenticationError('Authorization header missing or invalid.')

    token = credentials.credentials
    try:
        payload = await verify_supabase_token(token)
    except JWTError:
        raise AuthenticationError('Invalid or expired access token.')
    except httpx.HTTPError:
        raise AuthenticationError('Could not verify the access token right now.')

    user_id = payload.get('sub')
    if not user_id:
        raise AuthenticationError('Access token missing subject.')

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if not user:
        # A valid Supabase session but no matching public.users row yet — the
        # on_auth_user_created trigger should always create one; treat a miss
        # as "not provisioned" rather than authenticated.
        raise AuthenticationError('User not found or inactive.')

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _get_current_user(credentials, db)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Security(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Best-effort authentication. Returns None instead of raising when the
    token is missing/expired. Used where auth is desirable but not mandatory."""
    if not credentials or credentials.scheme.lower() != 'bearer':
        return None
    try:
        return await _get_current_user(credentials, db)
    except AuthenticationError:
        return None
