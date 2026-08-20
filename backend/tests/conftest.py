"""Pytest bootstrap.

Tests run against a real Postgres (not SQLite — the schema uses native
`uuid`/`jsonb` columns that SQLite can't represent), pointed at by the usual
DATABASE_URL. CI provides a throwaway `postgres:16` service container and a
stub `auth.users` table (see .github/workflows/backend-tests.yml) so the
`public.users` foreign key resolves without a real Supabase project.

Authentication is faked without ever contacting a real Supabase project:
this project's tokens are signed with an asymmetric key (ES256) and verified
against Supabase's published JWKS (app/core/security.py), so tests generate
their own throwaway EC keypair, monkeypatch the JWKS fetch to serve its
public half, and sign test tokens with the private half. A matching
public.users row is inserted directly (via the real on_auth_user_created
trigger, by inserting into auth.users) so the app's own lookup finds it.
"""
import base64
import json
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/healthmind_test')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('SUPABASE_URL', 'https://test.supabase.co')
os.environ.setdefault('SUPABASE_ANON_KEY', 'test-anon-key')
os.environ.setdefault('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
os.environ.setdefault('GEMINI_API_KEY', 'test-gemini-key')

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.core.security as security_module  # noqa: E402
from app.main import app  # noqa: E402
from app.core.audit import set_audit_enabled  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402

# ---------------------------------------------------------------------------
# Fake JWKS: a throwaway EC keypair standing in for Supabase's real one.
# ---------------------------------------------------------------------------
_TEST_KID = 'test-key-id'
_test_private_key = ec.generate_private_key(ec.SECP256R1())
_test_public_numbers = _test_private_key.public_key().public_numbers()


def _b64url_uint(value: int, length: int = 32) -> str:
    return base64.urlsafe_b64encode(value.to_bytes(length, 'big')).rstrip(b'=').decode('ascii')


_TEST_JWK = {
    'kty': 'EC',
    'crv': 'P-256',
    'kid': _TEST_KID,
    'alg': 'ES256',
    'use': 'sig',
    'x': _b64url_uint(_test_public_numbers.x),
    'y': _b64url_uint(_test_public_numbers.y),
}


async def _fake_get_jwks(force_refresh: bool = False):
    return [_TEST_JWK]


security_module._get_jwks = _fake_get_jwks

_TEST_PRIVATE_KEY_PEM = _test_private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode('ascii')


@pytest.fixture
def client():
    set_audit_enabled(False)
    with TestClient(app) as c:
        yield c


def make_access_token(user_id: str, email: str) -> str:
    now = datetime.utcnow()
    payload = {
        'sub': user_id,
        'email': email,
        'role': 'authenticated',
        'aud': 'authenticated',
        'iat': now,
        'exp': now + timedelta(hours=1),
    }
    return jwt.encode(payload, _TEST_PRIVATE_KEY_PEM, algorithm='ES256', headers={'kid': _TEST_KID})


@pytest_asyncio.fixture
async def make_user():
    """Insert into auth.users and let the real on_auth_user_created trigger
    create the matching public.users (+ patients/doctors) row, exactly as it
    does in production. Returns (user_id, access_token)."""
    created_ids = []

    async def _make(role: str = 'patient', full_name: str = 'Test User', email: str | None = None):
        user_id = str(uuid.uuid4())
        email = email or f'{user_id}@example.com'
        async with AsyncSessionLocal() as db:
            await db.execute(text(
                'INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at) '
                'VALUES (:id, :email, CAST(:user_meta AS jsonb), CAST(:app_meta AS jsonb), now())'
            ), {
                'id': user_id,
                'email': email,
                'user_meta': json.dumps({'full_name': full_name}),
                'app_meta': json.dumps({'role': role}),
            })
            await db.commit()
        created_ids.append(user_id)
        return user_id, make_access_token(user_id, email)

    yield _make

    async with AsyncSessionLocal() as db:
        for user_id in created_ids:
            await db.execute(text('DELETE FROM public.users WHERE id = :id'), {'id': user_id})
            await db.execute(text('DELETE FROM auth.users WHERE id = :id'), {'id': user_id})
        await db.commit()
