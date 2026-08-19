from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.exceptions import AuthorizationError, NotFoundError
from app.models.notification import Notification
from app.models.user import User, UserRole

router = APIRouter(prefix='/api', tags=['notifications'])


def _to_dict(n: Notification) -> dict[str, Any]:
    return {
        'id': n.id,
        'title': n.title,
        'message': n.message,
        'type': n.type,
        'read': n.read,
        'created_at': n.created_at.isoformat() + 'Z' if n.created_at else None,
    }


@router.get('/notifications')
async def list_notifications(
    read: bool | None = None,
    type: str | None = Query(default=None, alias='type'),
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count()).select_from(Notification).where(Notification.user_id == current_user.id)

    if read is not None:
        query = query.where(Notification.read == read)
        count_query = count_query.where(Notification.read == read)
    if type:
        query = query.where(Notification.type == type)

    total = (await db.execute(count_query)).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(
        query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    unread = (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == current_user.id, Notification.read == False)  # noqa: E712
    )).scalar() or 0

    return {
        'notifications': [_to_dict(n) for n in rows],
        'total': total or 0,
        'unread_count': unread,
        'page': page,
        'page_size': page_size,
    }


@router.post('/notifications/{notification_id}/read')
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundError('Notification not found.')
    if notification.user_id != current_user.id:
        raise AuthorizationError('You can only manage your own notifications.')
    notification.read = True
    await db.commit()
    return {'message': 'Notification marked as read.'}


@router.post('/notifications/read-all')
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await db.execute(
        update(Notification).where(Notification.user_id == current_user.id, Notification.read == False).values(read=True)  # noqa: E712
    )
    await db.commit()
    return {'message': 'All notifications marked as read.'}


@router.delete('/notifications/{notification_id}')
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundError('Notification not found.')
    if notification.user_id != current_user.id:
        raise AuthorizationError('You can only delete your own notifications.')
    await db.delete(notification)
    await db.commit()
    return {'message': 'Notification deleted.'}


@router.get('/notifications/unread')
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    unread = (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == current_user.id, Notification.read == False)  # noqa: E712
    )).scalar() or 0
    return {'unread_count': unread}