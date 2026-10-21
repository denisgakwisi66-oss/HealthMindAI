from __future__ import annotations

import time
from typing import Any

import httpx
from jose import jwt

from app.core.config import settings

_JWKS_CACHE_TTL_SECONDS = 3600
_jwks_cache: dict[str, Any] = {'keys': [], 'fetched_at': 0.0}


async def _fetch_jwks() -> list[dict]:
    """Fetch this Supabase project's published signing keys.

    Supabase's newer projects sign user session tokens with an asymmetric
    key (ES256/ECC P-256 here) rather than a single shared HS256 secret —
    verification means matching the token's `kid` against Supabase's public
    JWKS, not decoding with a static secret."""
    url = settings.supabase_jwks_url or f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    return resp.json().get('keys', [])


async def _get_jwks(force_refresh: bool = False) -> list[dict]:
    now = time.monotonic()
    stale = (now - _jwks_cache['fetched_at']) > _JWKS_CACHE_TTL_SECONDS
    if force_refresh or not _jwks_cache['keys'] or stale:
        _jwks_cache['keys'] = await _fetch_jwks()
        _jwks_cache['fetched_at'] = now
    return _jwks_cache['keys']


async def verify_supabase_token(token: str) -> dict[str, Any]:
    """Decode and validate a Supabase Auth access token against the
    project's published JWKS. No secret is configured locally — the public
    keys are fetched (and cached) from Supabase itself, refetched once if a
    token's `kid` isn't found, to tolerate key rotation."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get('kid')

    keys = await _get_jwks()
    matching = next((k for k in keys if k.get('kid') == kid), None)
    if matching is None:
        keys = await _get_jwks(force_refresh=True)
        matching = next((k for k in keys if k.get('kid') == kid), None)
    if matching is None:
        from jose import JWTError
        raise JWTError(f'No signing key found for kid={kid!r}.')

    return jwt.decode(
        token,
        matching,
        algorithms=['ES256', 'RS256'],
        audience='authenticated',
    )
