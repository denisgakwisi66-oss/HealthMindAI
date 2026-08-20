from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class EmergencyStatus(str, enum.Enum):
    SENT = 'sent'
    FAILED = 'failed'
    RESOLVED = 'resolved'


class EmergencyEvent(Base):
    """A persisted record of an SOS activation. Status is informational and
    never implies that responders were contacted."""

    __tablename__ = 'emergency_events'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # nullable for unauthenticated alerts
    message = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    status = Column(
        Enum(EmergencyStatus, native_enum=False, values_callable=lambda cls: [e.value for e in cls]),
        default=EmergencyStatus.SENT,
        nullable=False,
    )
    recipient = Column(String(320), nullable=True)
    error_detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)