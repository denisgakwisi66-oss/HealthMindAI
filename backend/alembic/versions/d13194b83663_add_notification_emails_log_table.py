"""add notification_emails log table

Revision ID: d13194b83663
Revises: a3cf387506ab
Create Date: 2026-08-20 18:20:43.850278

A log of admin-facing notification emails (new appointment, appointment
status change, new registration) — separate from `emergency_events`, which
already has its own dedicated recipient/status/error_detail columns for the
emergency-alert flow specifically. This table has no foreign key to
public.users or auth.users on purpose: the recipient is an operational
inbox, not a system user account.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd13194b83663'
down_revision: Union[str, Sequence[str], None] = 'a3cf387506ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPGRADE_STATEMENTS = [
    """
    create table if not exists public.notification_emails (
      id bigserial primary key,
      recipient text not null,
      subject text not null,
      event_type text not null
        check (event_type in ('emergency_alert','appointment_created','appointment_status_changed','user_registered')),
      resource_type text,
      resource_id text,
      status text not null default 'sent' check (status in ('sent','failed')),
      error_detail text,
      created_at timestamptz not null default now()
    )
    """,
    'create index if not exists idx_notification_emails_event on public.notification_emails(event_type)',
    'create index if not exists idx_notification_emails_created on public.notification_emails(created_at)',
    'alter table public.notification_emails enable row level security',
]

DOWNGRADE_STATEMENTS = [
    'drop table if exists public.notification_emails',
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
