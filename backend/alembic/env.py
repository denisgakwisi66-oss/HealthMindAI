import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (populates Base.metadata)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The real connection string is Settings.database_url (backend/.env), not the
# placeholder in alembic.ini. Built directly (not via config.set_main_option)
# because the URL can contain a literal '%' (e.g. a URL-encoded password),
# which configparser's interpolation would otherwise choke on.
DATABASE_URL = settings.database_url

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,
        # See app/db/session.py — Supabase's transaction-mode pooler doesn't
        # support asyncpg's client-side prepared-statement cache.
        connect_args={'statement_cache_size': 0},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
