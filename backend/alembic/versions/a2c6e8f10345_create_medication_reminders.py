"""create medication reminder delivery log

Revision ID: a2c6e8f10345
Revises: f17a9c3d6e42
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a2c6e8f10345'
down_revision: Union[str, Sequence[str], None] = 'f17a9c3d6e42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        create table if not exists public.medication_reminders (
          id bigserial primary key,
          medication_id bigint not null
            references public.medications(id) on delete cascade,
          reminder_date date not null,
          reminder_time text not null,
          recipient text not null,
          status text not null default 'processing'
            check (status in ('processing','sent','failed')),
          attempts integer not null default 1,
          processing_at timestamp,
          next_attempt_at timestamp,
          sent_at timestamp,
          error_detail text,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          constraint uq_medication_reminder_occurrence
            unique (medication_id, reminder_date, reminder_time)
        )
        """
    )
    op.execute(
        'create index if not exists idx_medication_reminders_due '
        'on public.medication_reminders(status, next_attempt_at)'
    )
    op.execute('alter table public.medication_reminders enable row level security')


def downgrade() -> None:
    op.execute('drop table if exists public.medication_reminders')
