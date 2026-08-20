from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UserRole(str, enum.Enum):
    PATIENT = 'patient'
    DOCTOR = 'doctor'
    ADMIN = 'admin'


class User(Base):
    """Mirrors a Supabase Auth user. `id` is that user's auth.users.id — this
    row is created automatically by the `handle_new_user` Postgres trigger on
    signup, never by application code."""

    __tablename__ = 'users'

    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    profile_picture = Column(String(1024), nullable=True)
    role = Column(
        Enum(UserRole, native_enum=False, values_callable=lambda cls: [e.value for e in cls]),
        default=UserRole.PATIENT,
        nullable=False,
    )
    is_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
