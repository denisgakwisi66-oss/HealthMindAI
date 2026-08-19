"""Pytest bootstrap: isolate the test run behind its own SQLite database.

Important: DATABASE_URL must be set before ``app`` is imported anywhere, because
``app.core.config.Settings`` and ``app.db.session`` read it at import time.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DATABASE_URL', 'sqlite+aiosqlite:///./test_healthmind.db')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.core.audit import set_audit_enabled  # noqa: E402


@pytest.fixture
def client():
    """Entering the TestClient context runs the app lifespan (create_all).
    Disable audit writes so slow/independent audit sessions never flake tests.
    """
    set_audit_enabled(False)
    with TestClient(app) as c:
        yield c