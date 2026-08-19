from __future__ import annotations

import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, Integer, String, Boolean, Date

from app.db.base import Base


class UserRole(str, enum.Enum):
    PATIENT = 'patient'
    DOCTOR = 'doctor'
    ADMIN = 'admin'


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    google_id = Column(String(128), unique=True, nullable=True)
    profile_picture = Column(String(1024), nullable=True)
    role = Column(Enum(UserRole, native_enum=False), default=UserRole.PATIENT, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
