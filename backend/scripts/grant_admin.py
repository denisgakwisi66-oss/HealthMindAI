"""Promote an existing, verified HealthMindAI account to admin.

Run from the backend directory:
    python scripts/grant_admin.py --email user@example.com
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import func, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


def _admin_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key.get_secret_value()
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if not settings.supabase_uses_new_api_keys:
        headers['Authorization'] = 'Bearer ' + key
    return headers


async def _promote(email: str) -> None:
    if not settings.supabase_admin_configured:
        raise RuntimeError('Supabase admin configuration is missing from backend/.env.')

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalar_one_or_none()
        if not user:
            raise RuntimeError(
                'No HealthMindAI account exists for this email. Register and verify the account first.'
            )
        if not user.is_active:
            raise RuntimeError('This account is disabled; enable it before granting admin access.')
        if not user.is_verified:
            raise RuntimeError('This account is not verified; verify it before granting admin access.')
        user_id = str(user.id)

    url = f'{settings.supabase_url.rstrip("/")}/auth/v1/admin/users/{user_id}'
    async with httpx.AsyncClient(timeout=15, headers=_admin_headers()) as client:
        response = await client.get(url)
        if response.status_code >= 400:
            raise RuntimeError(f'Supabase could not load the account (HTTP {response.status_code}).')
        try:
            auth_user = response.json()
            auth_user = auth_user.get('user', auth_user)
            app_metadata = auth_user.get('app_metadata') or {}
        except (ValueError, AttributeError) as exc:
            raise RuntimeError('Supabase returned an invalid account response.') from exc
        if (auth_user.get('email') or '').strip().lower() != email:
            raise RuntimeError('The Supabase account email does not match the requested email.')
        if not isinstance(app_metadata, dict):
            raise RuntimeError('Supabase returned invalid app metadata for this account.')

        response = await client.put(
            url,
            json={'app_metadata': {**app_metadata, 'role': 'admin'}},
        )
        if response.status_code >= 400:
            raise RuntimeError(f'Supabase could not update the account (HTTP {response.status_code}).')

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or user.role != UserRole.ADMIN:
            raise RuntimeError(
                'Supabase updated the account, but the application role did not synchronize. '
                'Check the auth-user role synchronization trigger before continuing.'
            )

    print(f'Admin access granted to {email}. Sign in at http://localhost:8000/login.html.')


async def main() -> int:
    parser = argparse.ArgumentParser(description='Grant admin access to an existing verified account.')
    parser.add_argument('--email', required=True, help='Email of the existing account to promote.')
    args = parser.parse_args()
    email = args.email.strip().lower()
    if not email or '@' not in email:
        parser.error('Provide a valid account email.')

    print(f'This will grant full application administration privileges to: {email}')
    confirmation = input(f'Type PROMOTE {email} to continue: ').strip()
    if confirmation != f'PROMOTE {email}':
        print('No changes made.')
        return 1

    try:
        await _promote(email)
    except (httpx.HTTPError, RuntimeError) as exc:
        print(f'Admin promotion failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
