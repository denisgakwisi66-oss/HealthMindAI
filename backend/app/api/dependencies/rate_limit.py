from __future__ import annotations

import asyncio
import time

from fastapi import Depends, Request
from loguru import logger
from redis.asyncio import Redis

from app.core.config import settings
from app.core.exceptions import RateLimitError

# In-process fallback used when Redis is unreachable. Each key tracks
# (started_timestamp, [{timestamp, count}, ...]) roughly in a sliding window.
_memory: dict[str, list[float]] = {}
_memory_lock: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    global _memory_lock
    if _memory_lock is None:
        _memory_lock = asyncio.Lock()
    return _memory_lock


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'


def rate_limit(requests_per_minute: int, fail_closed: bool = False):
    """Dependency factory: limit requests from an IP per minute.

    Uses Redis when available for horizontal correctness, falling back to an
    in-process sliding window so the app still works in dev/single-instance.

    `fail_closed=True` rejects the request outright when Redis is unreachable,
    instead of falling back to a per-process window that's ineffective across
    multiple workers. Reserved for limits whose absence is actually dangerous
    (login/credential-stuffing) — most limits should stay fail-open so a
    transient Redis blip doesn't take the whole API down.
    """

    async def dependency(request: Request) -> None:
        key = f'rl:{_client_ip(request)}'
        window = 60.0
        now = time.monotonic()
        limit = max(1, min(requests_per_minute, settings.rate_limit_per_minute))

        client = Redis.from_url(settings.redis_url, db=settings.redis_db, socket_connect_timeout=0.4, socket_timeout=0.4)
        try:
            try:
                pong = await client.ping()
            except Exception:
                pong = False
            if pong:
                try:
                    async with client.pipeline(transaction=True) as pipe:
                        await pipe.zremrangebyscore(key, 0, now - window)
                        await pipe.zadd(key, {f'{now}': now})
                        await pipe.zcard(key)
                        await pipe.expire(key, int(window) + 5)
                        _, _, count, _ = await pipe.execute()
                    await client.aclose()
                    if count > limit:
                        logger.warning('Rate limit exceeded for %s', _client_ip(request))
                        raise RateLimitError('Too many requests. Please try again shortly.')
                    return
                finally:
                    try:
                        await client.aclose()
                    except Exception:
                        pass
        except RateLimitError:
            raise
        except Exception:
            pass

        if fail_closed:
            logger.warning(
                'Redis unreachable; rejecting request from %s for a fail-closed rate limit.',
                _client_ip(request),
            )
            raise RateLimitError('Too many requests. Please try again shortly.')

        # Redis unavailable -> in-process fallback (fail-open limits only)
        async with _get_lock():
            events = _memory.get(key, [])
            events = [ts for ts in events if now - ts < window]
            if len(events) >= limit:
                raise RateLimitError('Too many requests. Please try again shortly.')
            events.append(now)
            _memory[key] = events

    return dependency