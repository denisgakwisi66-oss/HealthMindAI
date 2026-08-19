from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user_optional
from app.api.dependencies.database import get_db
from app.api.dependencies.rate_limit import rate_limit
from app.core.config import settings
from app.core.email import send_email
from app.core.exceptions import ApiException, ServiceUnavailableError
from app.core.audit import log_audit
from app.models.emergency import EmergencyEvent, EmergencyStatus
from app.models.user import User

router = APIRouter(prefix='/api/emergency', tags=['emergency'])


class LocationPayload(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None


class EmergencyAlertRequest(BaseModel):
    location: LocationPayload | None = None
    message: str | None = None


@router.post('/alert', dependencies=[Depends(rate_limit(settings.rate_limit_emergency_per_minute))])
async def trigger_emergency_alert(
    payload: EmergencyAlertRequest,
    request: Request,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Record and send an emergency alert.

    IMPORTANT: this only notifies the configured recipient(s) and LASTING record
    is persisted. It does NOT and cannot contact emergency responders unless a
    real integration exists.
    """
    recipient = settings.emergency_recipient
    who = current_user.full_name if current_user else 'An unauthenticated user'
    when = datetime.utcnow()

    if not recipient:
        event = EmergencyEvent(
            user_id=current_user.id if current_user else None,
            message=payload.message,
            latitude=payload.location.latitude if payload.location else None,
            longitude=payload.location.longitude if payload.location else None,
            accuracy=payload.location.accuracy if payload.location else None,
            status=EmergencyStatus.FAILED,
            error_detail='No emergency recipient is configured (EMERGENCY_RECIPIENT env var).',
        )
        db.add(event)
        await db.commit()
        await log_audit(db, action='emergency.alert', user_id=current_user.id if current_user else None,
                        resource_type='emergency', resource_id=event.id, request=request)
        raise ApiException(
            'EMERGENCY_NOT_CONFIGURED',
            'There is no emergency notification recipient configured for this app. '
            'In an emergency, please contact your local emergency services immediately.',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    location_lines = 'Not shared.'
    maps_link = None
    if payload.location and payload.location.latitude is not None and payload.location.longitude is not None:
        lat, lon = payload.location.latitude, payload.location.longitude
        maps_link = f'https://www.google.com/maps?q={lat},{lon}'
        accuracy = f' (accuracy ~{payload.location.accuracy:.0f}m)' if payload.location.accuracy else ''
        location_lines = f'Latitude: {lat}\nLongitude: {lon}{accuracy}\nMap: {maps_link}'

    subject = f'🚨 EMERGENCY ALERT — {who} needs help'
    text = (
        f'EMERGENCY ALERT — HealthMind AI\n\n'
        f'{who} has triggered the SOS button.\n'
        f'Time: {when.strftime("%Y-%m-%d %H:%M:%S UTC")}\n'
        f'Message: {payload.message or "No additional details provided."}\n'
        f'Location:\n{location_lines}\n\n'
        f'This is an automated emergency notification. Please respond promptly.'
    )
    html = f'<p><strong>{who}</strong> triggered the SOS button.</p>' \
           f'<p>Time: {when.strftime("%Y-%m-%d %H:%M:%S UTC")}</p>' \
           f'<p>Message: {payload.message or "No additional details provided."}</p>' \
           f'<p>Location:<br>{location_lines.replace(chr(10), "<br>")}</p>' \
           + (f'<p><a href="{maps_link}">View location on Google Maps</a></p>' if maps_link else '')

    email_ok = await send_email(recipient, subject, text, html)

    recipient_status = EmergencyStatus.SENT if email_ok else EmergencyStatus.FAILED
    event = EmergencyEvent(
        user_id=current_user.id if current_user else None,
        message=payload.message,
        latitude=payload.location.latitude if payload.location else None,
        longitude=payload.location.longitude if payload.location else None,
        accuracy=payload.location.accuracy if payload.location else None,
        status=recipient_status,
        recipient=recipient if email_ok else None,
        error_detail=None if email_ok else 'Email delivery failed.',
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    await log_audit(db, action='emergency.alert', user_id=current_user.id if current_user else None,
                    resource_type='emergency', resource_id=event.id,
                    details={'email_delivered': email_ok}, request=request)

    if not email_ok:
        raise ApiException(
            'EMERGENCY_EMAIL_FAILED',
            'We could not reach our emergency contacts right now. Please call your local emergency services directly.',
            status_code=status.HTTP_502_BAD_GATEWAY,
        )

    return {
        'status': 'sent',
        'recipient': recipient,
        'timestamp': event.created_at.isoformat() + 'Z',
        'message': 'Your emergency alert has been sent. If this is an emergency, also call local emergency services directly.',
    }