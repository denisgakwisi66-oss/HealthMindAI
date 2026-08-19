from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text

from app.db.base import Base


class RecordType(str, enum.Enum):
    LAB_REPORT = 'lab_report'
    CONSULTATION = 'consultation'
    PRESCRIPTION = 'prescription'
    IMAGING = 'imaging'
    VACCINATION = 'vaccination'
    OTHER = 'other'


class MedicalRecord(Base):
    __tablename__ = 'medical_records'

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    record_type = Column(
        Enum(RecordType, native_enum=False),
        default=RecordType.OTHER,
        nullable=False,
    )
    notes = Column(Text, nullable=True)
    # For optional file attachments (validated, size-limited server-side).
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(512), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)