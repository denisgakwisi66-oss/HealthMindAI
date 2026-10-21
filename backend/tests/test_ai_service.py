import pytest

from app.core.config import settings
from app.services import ai


@pytest.mark.asyncio
async def test_exhausted_gemini_quota_is_reported_without_retry(monkeypatch):
    requests = []

    class MockResponse:
        status_code = 429

        @staticmethod
        def json():
            return {
                'error': {
                    'status': 'RESOURCE_EXHAUSTED',
                    'message': (
                        'You exceeded your current quota. '
                        'Quota exceeded for metric: free_tier_requests.'
                    ),
                },
            }

    class MockAsyncClient:
        def __init__(self, timeout):
            assert timeout == 60

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, url, json, headers):
            requests.append((url, json, headers))
            return MockResponse()

    monkeypatch.setattr(ai.httpx, 'AsyncClient', MockAsyncClient)

    with pytest.raises(RuntimeError, match='reached its current API quota') as error:
        await ai.ask_gemini([{'role': 'user', 'content': 'Hello'}])

    assert 'Google AI quota and billing' in str(error.value)
    assert 'Live voice may remain available' in str(error.value)
    assert len(requests) == 1
    assert requests[0][0].endswith(f'/{settings.gemini_model}:generateContent')
