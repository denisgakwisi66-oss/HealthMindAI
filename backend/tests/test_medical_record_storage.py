from __future__ import annotations

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, settings
from app.core.exceptions import ServiceUnavailableError
from app.services import medical_record_storage


def test_production_requires_supabase_storage():
    with pytest.raises(ValidationError, match='MEDICAL_RECORDS_STORAGE_PROVIDER=supabase'):
        Settings(
            app_env='production',
            database_url='postgresql+asyncpg://user:pass@localhost/db',
            redis_url='redis://localhost:6379/0',
            supabase_url='https://project.supabase.co',
            supabase_anon_key='publishable-test-key',
            supabase_service_role_key='secret-test-key',
            gemini_api_key='test-gemini-key',
            medical_records_storage_provider='local',
        )


def test_render_service_requires_supabase_storage():
    with pytest.raises(ValidationError, match='MEDICAL_RECORDS_STORAGE_PROVIDER=supabase'):
        Settings(
            app_env='development',
            render_service_id='srv-test',
            database_url='postgresql+asyncpg://user:pass@localhost/db',
            redis_url='redis://localhost:6379/0',
            supabase_url='https://project.supabase.co',
            supabase_anon_key='publishable-test-key',
            supabase_service_role_key='secret-test-key',
            gemini_api_key='test-gemini-key',
            medical_records_storage_provider='local',
        )


@pytest.mark.asyncio
async def test_supabase_upload_uses_private_server_credentials(monkeypatch):
    captured = {}

    class MockResponse:
        status_code = 200

        def raise_for_status(self):
            return None

    class MockAsyncClient:
        def __init__(self, timeout):
            captured['timeout'] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return MockResponse()

    monkeypatch.setattr(settings, 'medical_records_storage_provider', 'supabase')
    monkeypatch.setattr(settings, 'supabase_storage_bucket', 'private-records')
    monkeypatch.setattr(settings, 'supabase_url', 'https://project.supabase.co')
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('server-secret'))
    monkeypatch.setattr(medical_record_storage.httpx, 'AsyncClient', MockAsyncClient)

    await medical_record_storage.store_medical_record(
        'unique-record.pdf',
        b'private file bytes',
        'application/pdf',
    )

    assert captured['url'] == (
        'https://project.supabase.co/storage/v1/object/private-records/unique-record.pdf'
    )
    assert captured['content'] == b'private file bytes'
    assert captured['headers']['Authorization'] == 'Bearer server-secret'
    assert captured['headers']['apikey'] == 'server-secret'
    assert captured['headers']['x-upsert'] == 'false'


@pytest.mark.asyncio
async def test_supabase_download_returns_bytes(monkeypatch):
    class MockResponse:
        status_code = 200
        content = b'private file bytes'

        def raise_for_status(self):
            return None

    class MockAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, **kwargs):
            return MockResponse()

    monkeypatch.setattr(settings, 'medical_records_storage_provider', 'supabase')
    monkeypatch.setattr(settings, 'supabase_url', 'https://project.supabase.co')
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('server-secret'))
    monkeypatch.setattr(medical_record_storage.httpx, 'AsyncClient', MockAsyncClient)

    assert await medical_record_storage.load_medical_record('unique-record.pdf') == b'private file bytes'


@pytest.mark.asyncio
async def test_local_storage_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'medical_records_storage_provider', 'local')
    monkeypatch.setattr(settings, 'storage_dir', str(tmp_path))

    await medical_record_storage.store_medical_record('local-record.pdf', b'local bytes')
    assert await medical_record_storage.load_medical_record('local-record.pdf') == b'local bytes'
    await medical_record_storage.delete_medical_record('local-record.pdf')
    assert not (tmp_path / 'local-record.pdf').exists()


@pytest.mark.asyncio
async def test_storage_rejects_paths_outside_bucket():
    with pytest.raises(ValueError, match='Invalid medical record object name'):
        await medical_record_storage.load_medical_record('../private.pdf')


@pytest.mark.asyncio
async def test_supabase_upload_failure_is_reported(monkeypatch):
    class MockResponse:
        def raise_for_status(self):
            request = httpx.Request('POST', 'https://storage.example/object')
            response = httpx.Response(503, request=request)
            raise httpx.HTTPStatusError('storage unavailable', request=request, response=response)

    class MockAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            return MockResponse()

    monkeypatch.setattr(settings, 'medical_records_storage_provider', 'supabase')
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('server-secret'))
    monkeypatch.setattr(medical_record_storage.httpx, 'AsyncClient', MockAsyncClient)

    with pytest.raises(ServiceUnavailableError):
        await medical_record_storage.store_medical_record('unique-record.pdf', b'content')
