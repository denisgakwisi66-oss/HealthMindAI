import uuid

from fastapi.testclient import TestClient

from app.main import app


def _unique_email() -> str:
    return f'user_{uuid.uuid4().hex[:10]}@example.com'


def test_register_and_login_flow(client):
    email = _unique_email()

    # Public self-registration works for patients.
    resp = client.post('/api/auth/register', json={
        'full_name': 'Flow Tester',
        'email': email,
        'password': 'correct-horse-battery',
        'date_of_birth': '1992-05-05',
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body['access_token']
    assert body['refresh_token']
    assert body['user']['role'] == 'patient'

    # Wrong password must be rejected.
    bad = client.post('/api/auth/login', json={'email': email, 'password': 'wrong-password'})
    assert bad.status_code == 401

    # Correct login issues a fresh token pair and marks last_login_at.
    ok = client.post('/api/auth/login', json={'email': email, 'password': 'correct-horse-battery'})
    assert ok.status_code == 200, ok.text
    assert ok.json()['user']['email'] == email

    # Protected endpoint: use the access token.
    headers = {'Authorization': f"Bearer {ok.json()['access_token']}"}
    me = client.get('/api/users/me', headers=headers)
    assert me.status_code == 200
    assert me.json()['user']['email'] == email

    # Refresh token rotates the pair.
    ref = client.post('/api/auth/refresh', json={'refresh_token': ok.json()['refresh_token']})
    assert ref.status_code == 200, ref.text
    assert ref.json()['access_token']


def test_public_cannot_register_as_doctor_or_admin(client):
    resp = client.post('/api/auth/register', json={
        'full_name': 'Sneaky Doctor',
        'email': _unique_email(),
        'password': 'correct-horse-battery',
        'role': 'doctor',
    })
    assert resp.status_code == 422 or resp.status_code == 400


def test_protected_endpoint_requires_token(client):
    resp = client.get('/api/dashboard/overview')
    assert resp.status_code == 401
    assert resp.json()['error']['code'] == 'AUTHENTICATION_REQUIRED'