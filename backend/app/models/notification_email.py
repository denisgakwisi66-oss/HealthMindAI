from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.base import Base


class NotificationEmail(Base):
    """A log of admin-facing notification emails (appointments, new
    registrations, etc). No FK to users — the recipient is an operational
    inbox, not a system account. Emergency alerts are logged separately in
    EmergencyEvent, which already has its own recipient/status columns."""

    __tablename__ = 'notification_emails'

    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(320), nullable=False)
    subject = Column(String(255), nullable=False)
    event_type = Column(String(40), nullable=False, index=True)
    resource_type = Column(String(60), nullable=True)
    resource_id = Column(String(120), nullable=True)
    status = Column(String(16), nullable=False, default='sent')
    error_detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
