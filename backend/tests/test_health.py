from fastapi.testclient import TestClient

from app.main import app


def test_health_check(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    body = response.json()
    assert body['status'] == 'ok'
    assert body['version']


def test_security_headers_present(client):
    response = client.get('/api/health')
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert 'Content-Security-Policy' in response.headers
