import pytest
from datetime import date, datetime, time, timedelta, timezone

from app.models.medication import MedicationSchedule
from app.services.medication_reminders import _due_occurrences


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


def test_medication_schedule_accepts_jsonb_and_string_values():
    schedule = MedicationSchedule()
    assert schedule.process_bind_param('09:00,21:00', None) == '09:00,21:00'
    assert schedule.process_result_value('09:00,21:00', None) == '09:00,21:00'
    assert schedule.process_result_value(['09:00', '21:00'], None) == '09:00,21:00'
    assert schedule.process_result_value({'times': ['09:00', '21:00']}, None) == '09:00,21:00'


def test_due_medication_reminder_uses_kigali_time_and_grace_window():
    now = datetime(2026, 10, 21, 18, 0, 15, tzinfo=timezone.utc)
    assert _due_occurrences('20:00,21:00', now) == [time(20, 0)]
    assert _due_occurrences('20:00', now + timedelta(minutes=4)) == [time(20, 0)]
    assert _due_occurrences('20:00', now + timedelta(minutes=6)) == []


def test_due_medication_reminder_honors_start_and_end_dates():
    now = datetime(2026, 10, 21, 18, 0, tzinfo=timezone.utc)
    assert _due_occurrences('20:00', now, medication_start=date(2026, 10, 22)) == []
    assert _due_occurrences('20:00', now, medication_end=date(2026, 10, 20)) == []


@pytest.mark.asyncio
async def test_patient_can_add_medication(client, make_user):
    _, token = await make_user(role='patient')
    response = client.post(
        '/api/medications',
        headers=_auth(token),
        json={
            'name': 'Example medication',
            'dosage': '10 mg',
            'frequency': 'daily',
            'schedule': '09:00',
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()['name'] == 'Example medication'
    assert isinstance(response.json()['reminder_email_configured'], bool)


@pytest.mark.asyncio
async def test_doctor_cannot_add_patient_medication(client, make_user):
    _, token = await make_user(role='doctor')
    response = client.post(
        '/api/medications',
        headers=_auth(token),
        json={
            'name': 'Example medication',
            'dosage': '10 mg',
            'frequency': 'daily',
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patient_cannot_delete_another_patients_medication(client, make_user):
    patient_id, _ = await make_user(role='patient')
    _, other_patient_token = await make_user(role='patient')
    from app.db.session import AsyncSessionLocal
    from app.models.medication import Medication

    async with AsyncSessionLocal() as db:
        medication = Medication(
            patient_id=patient_id,
            name='Example medication',
            dosage='10 mg',
            frequency='daily',
        )
        db.add(medication)
        await db.commit()
        await db.refresh(medication)
        medication_id = medication.id

    response = client.delete(
        f'/api/medications/{medication_id}',
        headers=_auth(other_patient_token),
    )
    assert response.status_code == 403
