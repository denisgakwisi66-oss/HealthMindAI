from __future__ import annotations

from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from app.api.dependencies.database import get_db
from app.api.dependencies.rate_limit import rate_limit
from app.core.config import settings
from app.core.notification_email import notify_admin
from app.core.webhooks import emit_n8n_event
from app.models.user import User

router = APIRouter(prefix='/api/notify', tags=['notify'])


class UserRegisteredRequest(BaseModel):
    email: EmailStr


@router.post('/user-registered', dependencies=[Depends(rate_limit(settings.rate_limit_per_minute))])
async def notify_user_registered(
    payload: UserRegisteredRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Called by the frontend right after a Supabase signUp() call succeeds
    (before a session necessarily exists, if email confirmation is on — so
    this can't require auth). Never trusts client-supplied profile data:
    it looks up the row the on_auth_user_created trigger already created
    and only sends a notification if a match is found, so this can't be
    used to spam arbitrary fabricated "signup" emails for names/roles that
    don't exist.
    """
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if user:
        await notify_admin(
            event_type='user_registered',
            subject=f'New {user.role.value} registered: {user.full_name}',
            text_body=f'{user.full_name} ({user.email}) registered as a {user.role.value}.',
            resource_type='user', resource_id=str(user.id),
        )
        await emit_n8n_event('user.registered', {
            'user_id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role.value,
            'phone': getattr(user, 'phone', None),
        })
    return {'message': 'ok'}
