"""Application data models package. Importing every model here ensures the
SQLAlchemy metadata is fully populated before create_all/migrations run."""

from app.db.base import Base
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.token import RefreshToken
from app.models.doctor import Doctor, Availability
from app.models.appointment import Appointment, AppointmentStatus
from app.models.medication import Medication
from app.models.medical_record import MedicalRecord, RecordType
from app.models.notification import Notification
from app.models.ai import AIConversation, AIMessage
from app.models.emergency import EmergencyEvent, EmergencyStatus
from app.models.audit_log import AuditLog
from app.models.password_reset import PasswordResetToken

__all__ = [
    'Base',
    'User',
    'UserRole',
    'Patient',
    'RefreshToken',
    'Doctor',
    'Availability',
    'Appointment',
    'AppointmentStatus',
    'Medication',
    'MedicalRecord',
    'RecordType',
    'Notification',
    'AIConversation',
    'AIMessage',
    'EmergencyEvent',
    'EmergencyStatus',
    'AuditLog',
    'PasswordResetToken',
]
