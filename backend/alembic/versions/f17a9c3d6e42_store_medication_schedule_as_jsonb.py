"""store medication schedules as jsonb

Revision ID: f17a9c3d6e42
Revises: e8d47c1a2b90
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f17a9c3d6e42'
down_revision: Union[str, Sequence[str], None] = 'e8d47c1a2b90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        do $$
        begin
          if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'medications'
              and column_name = 'schedule'
              and data_type <> 'jsonb'
          ) then
            alter table public.medications
              alter column schedule type jsonb using to_jsonb(schedule);
          end if;
        end
        $$
        """
    )


def downgrade() -> None:
    op.execute(
        """
        do $$
        begin
          if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'medications'
              and column_name = 'schedule'
              and data_type = 'jsonb'
          ) then
            alter table public.medications
              alter column schedule type text using schedule #>> '{}';
          end if;
        end
        $$
        """
    )
