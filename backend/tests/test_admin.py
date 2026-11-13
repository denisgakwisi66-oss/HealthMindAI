import pytest
from pydantic import ValidationError

from app.api.routes.admin import DoctorProfileUpdate, UserCreate


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


@pytest.mark.asyncio
async def test_non_admin_cannot_update_doctor_specialty(client, make_user):
    _, token = await make_user(role='patient')
    resp = client.patch(
        '/api/admin/users/00000000-0000-0000-0000-000000000001/doctor-profile',
        headers=_auth(token),
        json={'specialty': 'Cardiology'},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_non_admin_cannot_create_users(client, make_user):
    _, token = await make_user(role='patient')
    resp = client.post(
        '/api/admin/users',
        headers=_auth(token),
        json={
            'full_name': 'New Patient',
            'email': 'new.patient@example.com',
            'password': 'safe-password-123',
            'role': 'patient',
        },
    )
    assert resp.status_code == 403


def test_admin_user_creation_cannot_assign_admin_role():
    with pytest.raises(ValidationError):
        UserCreate(
            full_name='New Admin',
            email='new.admin@example.com',
            password='safe-password-123',
            role='admin',
        )


def test_admin_doctor_creation_requires_a_specialty():
    with pytest.raises(ValidationError):
        UserCreate(
            full_name='New Doctor',
            email='new.doctor@example.com',
            password='safe-password-123',
            role='doctor',
        )


def test_admin_doctor_creation_normalizes_specialty():
    user = UserCreate(
        full_name='New Doctor',
        email='new.doctor@example.com',
        password='safe-password-123',
        role='doctor',
        specialty='  Cardiology  ',
    )

    assert user.specialty == 'Cardiology'


def test_admin_doctor_profile_rejects_blank_specialty():
    with pytest.raises(ValidationError):
        DoctorProfileUpdate(specialty='  ')
