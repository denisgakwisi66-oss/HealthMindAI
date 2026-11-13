"""allow medication notification email events

Revision ID: e8d47c1a2b90
Revises: d13194b83663
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e8d47c1a2b90'
down_revision: Union[str, Sequence[str], None] = 'd13194b83663'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'alter table public.notification_emails '
        'drop constraint if exists notification_emails_event_type_check'
    )
    op.execute(
        "alter table public.notification_emails "
        "add constraint notification_emails_event_type_check "
        "check (event_type in "
        "('emergency_alert','appointment_created','appointment_status_changed',"
        "'user_registered','medication_created'))"
    )


def downgrade() -> None:
    op.execute(
        'alter table public.notification_emails '
        'drop constraint if exists notification_emails_event_type_check'
    )
    op.execute(
        "alter table public.notification_emails "
        "add constraint notification_emails_event_type_check "
        "check (event_type in "
        "('emergency_alert','appointment_created','appointment_status_changed',"
        "'user_registered'))"
    )
