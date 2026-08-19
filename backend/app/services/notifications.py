from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    *,
    user_id: int,
    title: str,
    message: str = '',
    notif_type: str = 'system',
    commit: bool = True,
) -> Notification:
    """Create an in-app notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
    )
    db.add(notification)
    if commit:
        await db.commit()
    return notification