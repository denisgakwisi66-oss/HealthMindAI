from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_roles
from app.api.dependencies.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit_log import AuditLog
from app.models.doctor import Doctor
from app.models.medication import Medication
from app.models.medical_record import MedicalRecord
from app.models.notification import Notification
from app.models.user import User, UserRole

router = APIRouter(prefix='/api', tags=['dashboards'])


def _iso(dt) -> str | None:
    return dt.isoformat() + 'Z' if dt else None


@router.get('/dashboard/overview')
async def dashboard_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    today = datetime.utcnow().date()
    if current_user.role == UserRole.PATIENT:
        res = await db.execute(
            select(Appointment).where(
                Appointment.patient_id == current_user.id,
                Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
                Appointment.date >= today,
            ).order_by(Appointment.date.asc(), Appointment.time.asc()).limit(5)
        )
        upcoming = [{'doctor_name': f'Doctor #{a.doctor_id}', 'specialty': a.specialty,
                     'time': a.time, 'date': a.date.isoformat(), 'id': a.id} for a in res.scalars().all()]

        meds = (await db.execute(
            select(Medication).where(Medication.patient_id == current_user.id, Medication.is_active == True)  # noqa: E712
        )).scalars().all()
        meds_due = [{'name': m.name, 'dosage': m.dosage, 'schedule': m.schedule or 'As prescribed',
                     'taken': False} for m in meds[:3]]

        notifications = (await db.execute(
            select(Notification).where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc()).limit(4)
        )).scalars().all()
        notif_list = [{'icon': '🔔', 'title': n.title, 'message': n.message or '', 'time_ago': 'Just now'}
                      for n in notifications]

        records = (await db.execute(
            select(MedicalRecord).where(MedicalRecord.patient_id == current_user.id)
            .order_by(MedicalRecord.created_at.desc()).limit(3)
        )).scalars().all()
        recent_records = [{'title': r.title, 'type': r.record_type.value, 'date': _iso(r.created_at)} for r in records]

        return {'upcoming_appointments': upcoming, 'medications_due': meds_due,
                'notifications': notif_list, 'recent_records': recent_records, 'health_trends': []}

    return {'upcoming_appointments': [], 'medications_due': [], 'notifications': [],
            'recent_records': [], 'health_trends': []}


@router.get('/dashboard/metrics')
async def dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # No wearable/device metric source is connected; these are intentionally null
    # rather than fabricated values so the UI shows neutral placeholders.
    return {'heart_rate': None, 'blood_pressure': None, 'steps': None, 'sleep': None}


@router.get('/admin/dashboard')
async def admin_dashboard(
    current_user: User = Depends(require_roles('admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_doctors = (await db.execute(select(func.count()).select_from(Doctor))).scalar() or 0
    total_appointments = (await db.execute(select(func.count()).select_from(Appointment))).scalar() or 0
    total_records = (await db.execute(select(func.count()).select_from(MedicalRecord))).scalar() or 0

    activity_rows = (await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    )).scalars().all()
    recent_activity = [{
        'icon': '📌', 'title': a.action,
        'details': a.resource_type or ('user #%s' % a.user_id if a.user_id else 'system'),
        'timestamp': _iso(a.created_at),
    } for a in activity_rows]

    return {
        'stats': {
            'total_users': total_users,
            'total_doctors': total_doctors,
            'total_hospitals': 0,
            'total_appointments': total_appointments,
            'total_records': total_records,
        },
        'recent_activity': recent_activity,
    }


@router.get('/doctor/dashboard')
async def doctor_dashboard(
    current_user: User = Depends(require_roles('doctor', 'admin')),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    today = datetime.utcnow().date()
    doctor_id = current_user.id

    total_patients = (await db.execute(
        select(func.count(func.distinct(Appointment.patient_id))).where(Appointment.doctor_id == doctor_id)
    )).scalar() or 0
    today_appointments = (await db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.doctor_id == doctor_id, Appointment.date == today,
            Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
        )
    )).scalar() or 0
    pending = (await db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.doctor_id == doctor_id, Appointment.status == AppointmentStatus.SCHEDULED,
        )
    )).scalar() or 0
    completed_today = (await db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.doctor_id == doctor_id, Appointment.date == today,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
    )).scalar() or 0

    today_list = (await db.execute(
        select(Appointment).where(Appointment.doctor_id == doctor_id, Appointment.date == today)
        .order_by(Appointment.time.asc())
    )).scalars().all()
    patient_ids = {a.patient_id for a in today_list}
    patients = {}
    if patient_ids:
        rows = (await db.execute(select(User).where(User.id.in_(patient_ids)))).scalars().all()
        patients = {u.id: u.full_name for u in rows}

    today_appts = [{
        'id': a.id, 'patient_id': a.patient_id, 'patient_name': patients.get(a.patient_id, 'Patient'),
        'time': a.time, 'type': a.specialty or 'Consultation', 'status': a.status.value,
    } for a in today_list]

    recent_ids = (await db.execute(
        select(Appointment.patient_id, func.max(Appointment.created_at))
        .where(Appointment.doctor_id == doctor_id)
        .group_by(Appointment.patient_id)
        .order_by(func.max(Appointment.created_at).desc()).limit(5)
    )).all()
    recent_patients = []
    if recent_ids:
        id_list = [row[0] for row in recent_ids]
        rows = (await db.execute(select(User).where(User.id.in_(id_list)))).scalars().all()
        name_map = {u.id: u.full_name for u in rows}
        recent_patients = [{'id': i, 'name': name_map.get(i, 'Patient'), 'age': None, 'last_visit': 'Recently'} for i in id_list]

    return {
        'stats': {
            'total_patients': total_patients,
            'today_appointments': today_appointments,
            'pending_appointments': pending,
            'completed_today': completed_today,
        },
        'today_appointments': today_appts,
        'recent_patients': recent_patients,
    }