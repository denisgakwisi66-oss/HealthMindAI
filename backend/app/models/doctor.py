from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint

from app.db.base import Base


class Doctor(Base):
    """Doctor professional profile, linked 1:1 to a User (role=doctor)."""

    __tablename__ = 'doctors'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True, index=True)
    specialty = Column(String(120), nullable=False, index=True)
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=True)
    license_number = Column(String(120), nullable=True)
    consultation_fee = Column(Float, nullable=True)
    location = Column(String(255), nullable=True)
    is_accepting_new = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Availability(Base):
    """A doctor's recurring availability window on a given weekday.

    Slot generation derives discrete booking slots from these windows and
    subtracts already-booked appointments.
    """

    __tablename__ = 'availability'

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey('doctors.id'), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_minutes = Column(Integer, default=30, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('doctor_id', 'weekday', 'start_time', name='uq_doctor_weekday_start'),
    )