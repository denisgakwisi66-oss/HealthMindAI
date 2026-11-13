from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.db.base import Base


class MedicationReminder(Base):
    __tablename__ = 'medication_reminders'

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(
        Integer,
        ForeignKey('medications.id', ondelete='CASCADE'),
        nullable=False,
    )
    reminder_date = Column(Date, nullable=False)
    reminder_time = Column(String(5), nullable=False)
    recipient = Column(String(320), nullable=False)
    status = Column(String(16), nullable=False, default='processing')
    attempts = Column(Integer, nullable=False, default=1)
    processing_at = Column(DateTime, nullable=True)
    next_attempt_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    error_detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            'medication_id',
            'reminder_date',
            'reminder_time',
            name='uq_medication_reminder_occurrence',
        ),
    )
