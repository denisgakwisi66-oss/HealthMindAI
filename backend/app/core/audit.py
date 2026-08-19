from __future__ import annotations

import json
from datetime import datetime

from fastapi import Request
from loguru import logger
from sqlalchemy import text

from app.db.session import AsyncSessionLocal

_audit_enabled = True


def set_audit_enabled(enabled: bool) -> None:
    """Allow tests to disable audit-write failures from breaking flows."""
    global _audit_enabled
    _audit_enabled = enabled


async def log_audit(
    db,
    *,
    action: str,
    user_id: int | None = None,
    resource_type: str = '',
    resource_id: str | int | None = None,
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    """Write an audit-log entry using an independent session.

    Runs in its own transaction so a slow/failed audit write can never break the
    real request, and it never commits a partially-built request transaction.

    Sensitive information (passwords, tokens, PHI) must never be put in
    details by callers.
    """
    if not _audit_enabled:
        return
    ip = None
    user_agent = None
    if request is not None:
        ip = request.client.host if request.client else None
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            ip = forwarded.split(',')[0].strip()
        user_agent = request.headers.get('user-agent')

        payload = {
        'action': action,
        'user_id': user_id,
        'resource_type': resource_type,
        'resource_id': str(resource_id) if resource_id is not None else None,
        'details': json.dumps(details or {}),
        'ip': ip,
        'user_agent': user_agent,
        'created_at': datetime.utcnow(),
    }

    try:
        async with AsyncSessionLocal() as audit_db:
            await audit_db.execute(text(_INSERT_SQL), payload)
            await audit_db.commit()
    except Exception as exc:
        logger.info(f'AUDIT action={action} user={user_id} detail={details}')
        logger.warning(f'Audit log write failed for action {action}: {exc}')


_INSERT_SQL = (
    'INSERT INTO audit_logs '
    '(action, user_id, resource_type, resource_id, details, ip, user_agent, created_at) '
    'VALUES (:action, :user_id, :resource_type, :resource_id, :details, :ip, :user_agent, :created_at)'
)
