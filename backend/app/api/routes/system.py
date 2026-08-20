from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from loguru import logger
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

router = APIRouter(prefix='/system', tags=['system'])
config_router = APIRouter(prefix='/config', tags=['config'])


@config_router.get('/public', summary='Public runtime config for the frontend')
async def get_public_config() -> dict:
    """Values safe to ship to any browser: a Supabase project URL and its
    anon key are meant to be public (Supabase's own security model relies on
    RLS/JWT verification, not on keeping these secret) — never put the
    service-role key or JWT secret here."""
    return {
        'supabase_url': settings.supabase_url,
        'supabase_anon_key': settings.supabase_anon_key.get_secret_value(),
    }


async def check_redis() -> dict:
    """Return {'status','latency_ms'} without hard-failing the health response."""
    try:
        client = Redis.from_url(settings.redis_url, db=settings.redis_db, socket_connect_timeout=0.5, socket_timeout=0.5)
        pong = await client.ping()
        await client.aclose()
        return {'status': 'ok' if pong else 'unreachable'}
    except Exception as exc:
        logger.warning(f'Redis check failed: {exc}')
        return {'status': 'unreachable'}


@router.get('/status', summary='System status / diagnostics')
async def get_system_status(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    db_status = 'ok'
    try:
        await db.execute(text('SELECT 1'))
    except Exception as exc:
        logger.error(f'Database check failed: {exc}')
        db_status = 'unavailable'

    redis_info = await check_redis()

    status = {
        'database': db_status,
        'redis': redis_info,
        'ai_provider': 'ok' if settings.ai_available else 'not_configured',
        'ai_model': settings.gemini_model if settings.ai_available else None,
        'email': 'configured' if settings.smtp_configured else 'not_configured',
        'emergency_recipient': bool(settings.emergency_recipient),
        'notifications': 'ok',
        'version': settings.app_version,
    }
    return JSONResponse({'status': status})


@router.get('/health', summary='Liveness + readiness probe')
async def health_probe(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Simple health probe used by orchestrators/load balancers.

    Returns 200 with a summary even if a dependency is down, so the container is
    not killed by transient network blips; container health checks should use
    /system/status for deep dependency checks.
    """
    db_ok = True
    try:
        await db.execute(text('SELECT 1'))
    except Exception:
        db_ok = False
    return JSONResponse({
        'status': 'ok' if db_ok else 'degraded',
        'database': db_ok,
    })
