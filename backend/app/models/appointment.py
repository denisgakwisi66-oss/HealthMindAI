from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Date, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = 'scheduled'
    CONFIRMED = 'confirmed'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    NO_SHOW = 'no_show'
    RESCHEDULED = 'rescheduled'


class Appointment(Base):
    __tablename__ = 'appointments'

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    specialty = Column(String(120), nullable=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(String(8), nullable=False)  # HH:MM 24h
    reason = Column(Text, nullable=True)
    status = Column(
        Enum(AppointmentStatus, native_enum=False, values_callable=lambda cls: [e.value for e in cls]),
        default=AppointmentStatus.SCHEDULED,
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        # Prevent double-booking at the database level. The partial index means
        # only *active* appointments occupy a slot, so cancelled appointments can
        # be freed and rebooked. Postgres and SQLite both support partial indexes.
        Index(
            'uq_active_appointment_slot',
            'doctor_id',
            'date',
            'time',
            unique=True,
            postgresql_where=(status != AppointmentStatus.CANCELLED),
            sqlite_where=(status != AppointmentStatus.CANCELLED),
        ),
    )