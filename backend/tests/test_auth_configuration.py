from types import SimpleNamespace

from pydantic import SecretStr

from app.api.routes import ai_assistant
from app.api.routes.auth import _supabase_admin_headers
from app.core.config import settings


def test_public_config_rejects_placeholder_supabase_values(client, monkeypatch):
    monkeypatch.setattr(settings, 'supabase_url', 'https://example.supabase.co')
    monkeypatch.setattr(settings, 'supabase_anon_key', SecretStr('replace-with-anon-key'))

    response = client.get('/api/config/public')

    assert response.status_code == 503
    assert 'valid Supabase URL and anon key' in response.json()['error']['message']


def test_register_rejects_missing_supabase_admin_key(client, monkeypatch):
    monkeypatch.setattr(settings, 'supabase_url', 'https://project-id.supabase.co')
    monkeypatch.setattr(settings, 'supabase_anon_key', SecretStr('public-anon-key'))
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('replace-with-service-role-key'))

    response = client.post('/api/auth/register', json={
        'full_name': 'Test User',
        'email': 'test@example.com',
        'password': 'Correct-Horse-Battery-1',
        'date_of_birth': '1990-01-01',
        'role': 'patient',
    })

    assert response.status_code == 503
    assert 'service-role key' in response.json()['error']['message']


def test_new_supabase_secret_key_is_sent_only_as_api_key(monkeypatch):
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('sb_secret_test'))

    headers = _supabase_admin_headers()

    assert headers == {'apikey': 'sb_secret_test'}


def test_legacy_service_role_key_keeps_bearer_authorization(monkeypatch):
    monkeypatch.setattr(settings, 'supabase_service_role_key', SecretStr('legacy-service-role-key'))

    headers = _supabase_admin_headers()

    assert headers['apikey'] == 'legacy-service-role-key'
    assert headers['Authorization'] == 'Bearer legacy-service-role-key'


async def test_gemini_live_token_is_single_use_and_configuration_is_locked(
    client, monkeypatch
):
    monkeypatch.setitem(
        client.app.dependency_overrides,
        ai_assistant.get_current_user,
        lambda: SimpleNamespace(id='test-user'),
    )
    monkeypatch.setattr(settings, 'gemini_api_key', SecretStr('test-gemini-key'))
    monkeypatch.setattr(settings, 'ai_provider_enabled', True)
    requests = []

    class MockResponse:
        is_error = False

        @staticmethod
        def json():
            return {'name': 'auth_tokens/test-ephemeral-token'}

    class MockAsyncClient:
        def __init__(self, timeout):
            assert timeout == 15

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, url, headers, json):
            requests.append((url, headers, json))
            return MockResponse()

    monkeypatch.setattr(ai_assistant.httpx, 'AsyncClient', MockAsyncClient)

    response = client.post(
        '/api/ai/gemini/live-token',
    )

    assert response.status_code == 200
    body = response.json()
    assert body['token'] == 'auth_tokens/test-ephemeral-token'
    assert body['model'] == settings.gemini_live_model
    assert body['config']['inputAudioTranscription'] == {}
    assert body['config']['outputAudioTranscription'] == {}
    assert 'not a doctor' in body['config']['systemInstruction']['parts'][0]['text']
    declared_tools = body['config']['tools'][0]['functionDeclarations']
    tool_names = {tool['name'] for tool in declared_tools}
    assert {
        'list_appointments',
        'find_doctors',
        'get_available_slots',
        'book_appointment',
        'cancel_appointment',
        'list_medications',
        'add_prescribed_medication',
        'list_medical_records',
        'open_app_section',
    } <= tool_names
    medication_tool = next(tool for tool in declared_tools if tool['name'] == 'add_prescribed_medication')
    assert medication_tool['parameters']['required'] == ['name', 'dosage', 'frequency']
    assert len(requests) == 1
    url, headers, request_body = requests[0]
    assert url == ai_assistant.GEMINI_LIVE_TOKEN_URL
    assert headers['x-goog-api-key'] == settings.gemini_api_key.get_secret_value()
    assert request_body['uses'] == 1
    assert request_body['bidiGenerateContentSetup']['model'] == f'models/{settings.gemini_live_model}'
    assert request_body['bidiGenerateContentSetup']['generationConfig']['responseModalities'] == ['AUDIO']
    assert request_body['bidiGenerateContentSetup']['systemInstruction'] == body['config']['systemInstruction']
    assert request_body['bidiGenerateContentSetup']['tools'] == body['config']['tools']


async def test_gemini_live_token_returns_service_error_on_upstream_failure(
    client, monkeypatch
):
    monkeypatch.setitem(
        client.app.dependency_overrides,
        ai_assistant.get_current_user,
        lambda: SimpleNamespace(id='test-user'),
    )
    monkeypatch.setattr(settings, 'gemini_api_key', SecretStr('test-gemini-key'))
    monkeypatch.setattr(settings, 'ai_provider_enabled', True)

    class MockResponse:
        is_error = True
        status_code = 403

    class MockAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            return MockResponse()

    monkeypatch.setattr(ai_assistant.httpx, 'AsyncClient', MockAsyncClient)

    response = client.post(
        '/api/ai/gemini/live-token',
    )

    assert response.status_code == 503
    assert 'Gemini Live could not create a voice session' in response.json()['error']['message']
