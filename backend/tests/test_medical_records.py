import pytest


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


@pytest.mark.asyncio
async def test_patient_can_create_and_list_own_record(client, make_user):
    _, token = await make_user(role='patient')

    create = client.post('/api/medical-records', headers=_auth(token), data={
        'title': 'Annual checkup',
        'record_type': 'consultation',
        'notes': 'All normal.',
    })
    assert create.status_code == 200, create.text
    record_id = create.json()['id']

    listing = client.get('/api/medical-records', headers=_auth(token))
    assert listing.status_code == 200
    ids = [r['id'] for r in listing.json()['records']]
    assert record_id in ids


@pytest.mark.asyncio
async def test_patient_cannot_see_another_patients_record(client, make_user):
    _, owner_token = await make_user(role='patient')
    _, other_token = await make_user(role='patient')

    create = client.post('/api/medical-records', headers=_auth(owner_token), data={
        'title': 'Private record',
        'record_type': 'consultation',
    })
    assert create.status_code == 200

    listing = client.get('/api/medical-records', headers=_auth(other_token))
    assert listing.status_code == 200
    titles = [r['title'] for r in listing.json()['records']]
    assert 'Private record' not in titles


@pytest.mark.asyncio
async def test_patient_cannot_create_record_for_another_patient(client, make_user):
    _, patient_token = await make_user(role='patient')
    other_patient_id, _ = await make_user(role='patient')

    resp = client.post('/api/medical-records', headers=_auth(patient_token), data={
        'title': 'Should be blocked',
        'record_type': 'consultation',
        'patient_id': other_patient_id,
    })
    assert resp.status_code == 403


def test_list_records_requires_auth(client):
    resp = client.get('/api/medical-records')
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_doctor_without_relationship_cannot_delete_patient_record(client, make_user):
    _, patient_token = await make_user(role='patient')
    _, doctor_token = await make_user(role='doctor')

    create = client.post('/api/medical-records', headers=_auth(patient_token), data={
        'title': 'Unrelated record',
        'record_type': 'consultation',
    })
    record_id = create.json()['id']

    resp = client.delete(f'/api/medical-records/{record_id}', headers=_auth(doctor_token))
    assert resp.status_code == 403
