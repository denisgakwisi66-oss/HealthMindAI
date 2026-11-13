import httpx
import pytest
from pydantic import SecretStr

from app.core import email
from app.core.config import settings


@pytest.mark.asyncio
async def test_send_email_uses_resend_api_when_configured(monkeypatch):
    sent = {}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            sent.update(url=url, headers=headers, payload=json)
            return httpx.Response(200, request=httpx.Request('POST', url))

    monkeypatch.setattr(email.httpx, 'AsyncClient', lambda **_kwargs: FakeClient())
    monkeypatch.setattr(settings, 'resend_api_key', SecretStr('test-resend-key'))
    monkeypatch.setattr(settings, 'email_from', 'HealthMind <alerts@example.com>')
    monkeypatch.setattr(settings, 'email_notifications_enabled', True)

    result = await email.send_email(
        'denisgakwisi66@gmail.com',
        'Test subject',
        'Plain text',
        '<p>HTML</p>',
    )

    assert result is True
    assert sent['url'] == 'https://api.resend.com/emails'
    assert sent['headers']['Authorization'] == 'Bearer test-resend-key'
    assert sent['payload']['to'] == ['denisgakwisi66@gmail.com']
    assert sent['payload']['from'] == 'HealthMind <alerts@example.com>'
    assert sent['payload']['html'] == '<p>HTML</p>'


@pytest.mark.asyncio
async def test_send_email_reports_resend_http_failure(monkeypatch):
    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **_kwargs):
            request = httpx.Request('POST', url)
            return httpx.Response(401, request=request)

    monkeypatch.setattr(email.httpx, 'AsyncClient', lambda **_kwargs: FakeClient())
    monkeypatch.setattr(settings, 'resend_api_key', SecretStr('test-resend-key'))
    monkeypatch.setattr(settings, 'email_from', 'HealthMind <alerts@example.com>')
    monkeypatch.setattr(settings, 'email_notifications_enabled', True)

    assert await email.send_email('recipient@example.com', 'Test', 'Body') is False
