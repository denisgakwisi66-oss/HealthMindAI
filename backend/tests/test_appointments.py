import pytest
from datetime import date, timedelta

from app.db.session import AsyncSessionLocal
from sqlalchemy import text


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


async def _add_availability(doctor_user_id: str, weekday: int):
    async with AsyncSessionLocal() as db:
        doctor_row = (await db.execute(
            text('SELECT id FROM public.doctors WHERE user_id = :uid'), {'uid': doctor_user_id}
        )).first()
        await db.execute(text(
            'INSERT INTO public.availability (doctor_id, weekday, start_time, end_time, slot_minutes) '
            "VALUES (:doctor_id, :weekday, '09:00', '12:00', 30)"
        ), {'doctor_id': doctor_row[0], 'weekday': weekday})
        await db.commit()


def _next_weekday(target_weekday: int) -> date:
    today = date.today()
    days_ahead = (target_weekday - today.weekday()) % 7 or 7
    return today + timedelta(days=days_ahead)


@pytest.mark.asyncio
async def test_patient_can_book_and_double_booking_is_rejected(client, make_user):
    doctor_id, _ = await make_user(role='doctor')
    _, patient_token = await make_user(role='patient')
    _, other_patient_token = await make_user(role='patient')

    booking_date = _next_weekday(0)  # Monday
    await _add_availability(doctor_id, weekday=0)

    first = client.post('/api/appointments', headers=_auth(patient_token), json={
        'doctor_id': doctor_id,
        'date': booking_date.isoformat(),
        'time': '09:00',
    })
    assert first.status_code == 200, first.text

    conflict = client.post('/api/appointments', headers=_auth(other_patient_token), json={
        'doctor_id': doctor_id,
        'date': booking_date.isoformat(),
        'time': '09:00',
    })
    assert conflict.status_code == 400
    assert conflict.json()['error']['code'] == 'SLOT_UNAVAILABLE'


@pytest.mark.asyncio
async def test_patient_only_sees_own_appointments(client, make_user):
    doctor_id, _ = await make_user(role='doctor')
    _, patient_a_token = await make_user(role='patient')
    _, patient_b_token = await make_user(role='patient')
    await _add_availability(doctor_id, weekday=1)

    booking_date = _next_weekday(1)  # Tuesday
    client.post('/api/appointments', headers=_auth(patient_a_token), json={
        'doctor_id': doctor_id,
        'date': booking_date.isoformat(),
        'time': '09:00',
    })

    resp = client.get('/api/appointments', headers=_auth(patient_b_token))
    assert resp.status_code == 200
    assert resp.json()['appointments'] == []


@pytest.mark.asyncio
async def test_doctor_cannot_book_appointments(client, make_user):
    doctor_id, doctor_token = await make_user(role='doctor')
    resp = client.post('/api/appointments', headers=_auth(doctor_token), json={
        'doctor_id': doctor_id,
        'date': _next_weekday(2).isoformat(),
        'time': '09:00',
    })
    assert resp.status_code == 403


def test_appointments_requires_auth(client):
    resp = client.get('/api/appointments')
    assert resp.status_code == 401
