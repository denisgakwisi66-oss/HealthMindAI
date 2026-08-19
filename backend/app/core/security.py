from __future__ import annotations

from datetime import datetime, timedelta
import secrets
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Uses the bcrypt package directly. passlib 1.7.x is incompatible with
    modern bcrypt releases (>= 4.1), so it is intentionally avoided here.
    """
    password_bytes = password.encode('utf-8')
    # bcrypt only uses the first 72 bytes; truncate to avoid a hard error.
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: dict[str, Any]) -> str:
    now = datetime.utcnow()
    payload = {
        **subject,
        'exp': now + timedelta(minutes=settings.jwt_access_expire_minutes),
        'iat': now,
        'sub': subject.get('sub'),
        'type': 'access',
    }
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: dict[str, Any]) -> str:
    now = datetime.utcnow()
    payload = {
        **subject,
        'exp': now + timedelta(days=settings.jwt_refresh_expire_days),
        'iat': now,
        'sub': subject.get('sub'),
        'type': 'refresh',
        'jti': secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError when invalid/expired."""
    return jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
    )


def create_one_time_token(subject: dict[str, Any], expire_minutes: int) -> tuple[str, str]:
    """Create a single-use opaque token plus its bcrypt hash.

    Returns (raw_token, token_hash). The raw token is returned to the user
    (e.g. embedded in an email link); only the hash is stored server-side so a
    database leak does not reveal usable reset tokens.
    """
    raw = secrets.token_urlsafe(32)
    token_hash = hash_password(raw)
    return raw, token_hash
