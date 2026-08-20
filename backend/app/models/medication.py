from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class Medication(Base):
    __tablename__ = 'medications'

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    dosage = Column(String(120), nullable=False)
    frequency = Column(String(120), nullable=False)
    schedule = Column(String(255), nullable=True)  # comma-separated times e.g. "09:00,21:00"
    instructions = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    # Adherence tracking
    times_taken = Column(Integer, default=0, nullable=False)
    times_due = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)