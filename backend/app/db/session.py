from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _make_engine():
    url = settings.database_url
    kwargs = {'echo': False, 'future': True}
    if url.startswith('postgresql'):
        kwargs.update(
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_timeout=settings.database_pool_timeout,
            pool_pre_ping=True,
            # Supabase's connection pooler (Supavisor / pgbouncer, port 6543,
            # "transaction" mode) multiplexes many logical clients over the
            # same physical connections, so asyncpg's client-side prepared
            # statement cache can collide across requests
            # (DuplicatePreparedStatementError). Disabling it is the
            # documented fix and is harmless against a direct (non-pooled)
            # connection too.
            connect_args={'statement_cache_size': 0},
        )
    return create_async_engine(url, **kwargs)


data_engine = _make_engine()
AsyncSessionLocal = sessionmaker(
    bind=data_engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
