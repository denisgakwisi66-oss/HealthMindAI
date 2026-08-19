"""Seed the HealthMind AI database with demo users.

Usage (from the backend/ directory, with your virtualenv active):

    python seed.py

This creates three demo accounts (skipped if they already exist):

    Patient: patient@healthmind.ai / Demo@1234
    Doctor:  doctor@healthmind.ai   / Demo@1234
    Admin:   admin@healthmind.ai    / Demo@1234

The tables are created automatically if they do not exist yet.
"""

import asyncio

from sqlalchemy import select

from app.api.routes.auth import user_to_dict
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import AsyncSessionLocal, data_engine
from app.models.patient import Patient
from app.models.user import User, UserRole

DEMO_USERS = [
    {'email': 'patient@healthmind.ai', 'full_name': 'Demo Patient', 'role': UserRole.PATIENT},
    {'email': 'doctor@healthmind.ai', 'full_name': 'Demo Doctor', 'role': UserRole.DOCTOR},
    {'email': 'admin@healthmind.ai', 'full_name': 'Demo Admin', 'role': UserRole.ADMIN},
]
DEMO_PASSWORD = 'Demo@1234'


async def seed() -> None:
    # Ensure tables exist
    async with data_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    created = []
    existing = []

    async with AsyncSessionLocal() as session:
        for user_data in DEMO_USERS:
            result = await session.execute(select(User).where(User.email == user_data['email']))
            if result.first():
                existing.append(user_data['email'])
                continue

            user = User(
                full_name=user_data['full_name'],
                email=user_data['email'],
                hashed_password=hash_password(DEMO_PASSWORD),
                role=user_data['role'],
                is_verified=True,
                is_active=True,
            )
            session.add(user)
            await session.flush()

            if user.role == UserRole.PATIENT:
                session.add(Patient(user_id=user.id))

            created.append(user_to_dict(user))

        await session.commit()

    if created:
        print('Created users:')
        for user in created:
            print(f'  - {user["email"]} ({user["role"]}) / {DEMO_PASSWORD}')
    if existing:
        print(f'Skipped (already exist): {", ".join(existing)}')

    if not created and not existing:
        print('Nothing to do.')
    else:
        print(f'\nLogin at http://localhost:8000/login.html with the credentials above.')


if __name__ == '__main__':
    asyncio.run(seed())