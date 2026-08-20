import pytest


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


@pytest.mark.asyncio
async def test_non_admin_cannot_list_users(client, make_user):
    _, token = await make_user(role='patient')
    resp = client.get('/api/admin/users', headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_users(client, make_user):
    _, admin_token = await make_user(role='admin')
    resp = client.get('/api/admin/users', headers=_auth(admin_token))
    assert resp.status_code == 200
    assert 'users' in resp.json()


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_own_account(client, make_user):
    admin_id, admin_token = await make_user(role='admin')
    resp = client.patch(
        f'/api/admin/users/{admin_id}/status',
        headers=_auth(admin_token),
        json={'is_active': False},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_can_deactivate_another_user(client, make_user):
    _, admin_token = await make_user(role='admin')
    target_id, _ = await make_user(role='patient')

    resp = client.patch(
        f'/api/admin/users/{target_id}/status',
        headers=_auth(admin_token),
        json={'is_active': False},
    )
    assert resp.status_code == 200
    assert resp.json()['user']['is_active'] is False


def test_admin_users_requires_auth(client):
    resp = client.get('/api/admin/users')
    assert resp.status_code == 401
