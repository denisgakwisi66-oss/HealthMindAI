from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_roles, user_to_dict
from app.api.dependencies.database import get_db
from app.core.audit import log_audit
from app.core.exceptions import ApiException, NotFoundError
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole

router = APIRouter(prefix='/api/admin', tags=['admin'])


class StatusUpdate(BaseModel):
    is_active: bool


class RoleUpdate(BaseModel):
    role: UserRole


async def _get_user(db: AsyncSession, user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError('User not found.')
    return user


@router.get('/users')
async def list_users(
    role: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(User)
    if role:
        try:
            query = query.where(User.role == UserRole(role))
        except ValueError:
            raise ApiException('VALIDATION_ERROR', 'Invalid role filter.')
    if search:
        query = query.where(or_(User.full_name.ilike(f'%{search}%'), User.email.ilike(f'%{search}%')))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {'users': [user_to_dict(u) for u in rows], 'total': total or 0, 'page': page, 'page_size': page_size}


@router.patch('/users/{user_id}/status')
async def update_user_status(
    user_id: int,
    payload: StatusUpdate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if user_id == current_user.id:
        raise ApiException('VALIDATION_ERROR', 'You cannot disable your own account.')
    user = await _get_user(db, user_id)
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    await log_audit(db, action='admin.user.status', user_id=current_user.id,
                    resource_type='user', resource_id=user_id,
                    details={'is_active': payload.is_active}, request=request)
    return {'user': user_to_dict(user)}


@router.patch('/users/{user_id}/role')
async def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    if user_id == current_user.id:
        raise ApiException('VALIDATION_ERROR', 'You cannot change your own role.')
    user = await _get_user(db, user_id)
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    await log_audit(db, action='admin.user.role', user_id=current_user.id,
                    resource_type='user', resource_id=user_id,
                    details={'role': payload.role.value}, request=request)
    return {'user': user_to_dict(user)}


@router.get('/audit-logs')
async def list_audit_logs(
    action: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    rows = (await db.execute(query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    logs = [{
        'id': a.id, 'action': a.action, 'user_id': a.user_id,
        'resource_type': a.resource_type, 'resource_id': a.resource_id,
        'ip': a.ip, 'created_at': a.created_at.isoformat() + 'Z' if a.created_at else None,
    } for a in rows]
    return {'logs': logs, 'total': total or 0, 'page': page, 'page_size': page_size}