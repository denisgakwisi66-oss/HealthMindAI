from __future__ import annotations

from loguru import logger

from app.core.config import settings
from app.core.email import send_email
from app.db.session import AsyncSessionLocal
from app.models.notification_email import NotificationEmail


async def notify_admin(
    *,
    event_type: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    resource_type: str | None = None,
    resource_id: int | str | None = None,
) -> bool:
    """Send an operational notification email to settings.emergency_recipient
    and log the attempt, independent of whatever transaction the caller is
    in — a failure here must never break the request that triggered it
    (same reasoning as app.core.audit.log_audit).
    """
    recipient = settings.emergency_recipient
    if not recipient:
        return False

    ok = await send_email(recipient, subject, text_body, html_body)

    try:
        async with AsyncSessionLocal() as db:
            db.add(NotificationEmail(
                recipient=recipient,
                subject=subject,
                event_type=event_type,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id is not None else None,
                status='sent' if ok else 'failed',
                error_detail=None if ok else 'Email delivery failed.',
            ))
            await db.commit()
    except Exception as exc:
        logger.warning(f'Failed to log notification email ({event_type}): {exc}')

    return ok
