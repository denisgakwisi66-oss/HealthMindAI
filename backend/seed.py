"""Seed Supabase Auth with demo accounts for local testing.

Usage (from the backend/ directory, with your virtualenv active and
backend/.env pointing at your Supabase project):

    python seed.py

Creates three demo accounts via the Supabase Admin API (skipped if they
already exist). Their `public.users` row is created automatically by the
`handle_new_user` database trigger, with the role read from `app_metadata`
(the only role source the trigger trusts for anything other than 'patient').

    Patient: patient@healthmind.ai / Demo@1234
    Doctor:  doctor@healthmind.ai   / Demo@1234
    Admin:   admin@healthmind.ai    / Demo@1234
"""

import asyncio

import httpx

from app.core.config import settings

DEMO_USERS = [
    {'email': 'patient@healthmind.ai', 'full_name': 'Demo Patient', 'role': 'patient'},
    {'email': 'doctor@healthmind.ai', 'full_name': 'Demo Doctor', 'role': 'doctor'},
    {'email': 'admin@healthmind.ai', 'full_name': 'Demo Admin', 'role': 'admin'},
]
DEMO_PASSWORD = 'Demo@1234'


async def seed() -> None:
    created = []
    existing = []

    headers = {
        'apikey': settings.supabase_service_role_key.get_secret_value(),
        'Content-Type': 'application/json',
    }
    if not settings.supabase_uses_new_api_keys:
        headers['Authorization'] = f'Bearer {settings.supabase_service_role_key.get_secret_value()}'

    async with httpx.AsyncClient(base_url=f'{settings.supabase_url}/auth/v1', headers=headers, timeout=15) as client:
        for user_data in DEMO_USERS:
            response = await client.post('/admin/users', json={
                'email': user_data['email'],
                'password': DEMO_PASSWORD,
                'email_confirm': True,
                'user_metadata': {'full_name': user_data['full_name']},
                'app_metadata': {'role': user_data['role']},
            })
            if response.status_code == 200:
                created.append(user_data)
            elif response.status_code == 422 or 'already been registered' in response.text.lower():
                existing.append(user_data['email'])
            else:
                print(f"Failed to create {user_data['email']}: {response.status_code} {response.text}")

    if created:
        print('Created users:')
        for user in created:
            print(f"  - {user['email']} ({user['role']}) / {DEMO_PASSWORD}")
    if existing:
        print(f"Skipped (already exist): {', '.join(existing)}")
    if not created and not existing:
        print('Nothing to do.')
    else:
        print('\nLogin at http://localhost:8000/login.html with the credentials above.')


if __name__ == '__main__':
    asyncio.run(seed())
