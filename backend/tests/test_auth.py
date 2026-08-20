import pytest


@pytest.mark.asyncio
async def test_get_me_returns_profile(client, make_user):
    user_id, token = await make_user(role='patient', full_name='Flow Tester')
    resp = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body['user']['id'] == user_id
    assert body['user']['role'] == 'patient'
    assert body['user']['full_name'] == 'Flow Tester'


def test_me_requires_token(client):
    resp = client.get('/api/auth/me')
    assert resp.status_code == 401


def test_me_rejects_garbage_token(client):
    resp = client.get('/api/auth/me', headers={'Authorization': 'Bearer not-a-real-jwt'})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_inactive_user_is_rejected(client, make_user):
    user_id, token = await make_user(role='patient')
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        await db.execute(text('UPDATE public.users SET is_active = false WHERE id = :id'), {'id': user_id})
        await db.commit()

    resp = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 401


def test_protected_endpoint_requires_token(client):
    resp = client.get('/api/dashboard/overview')
    assert resp.status_code == 401
    assert resp.json()['error']['code'] == 'AUTHENTICATION_REQUIRED'
