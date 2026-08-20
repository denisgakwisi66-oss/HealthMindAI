"""sync role on auth.users metadata update

Revision ID: a3cf387506ab
Revises: 54f7d5b94bf6
Create Date: 2026-08-20 18:07:07.098030

Supabase's Admin API (`POST /auth/v1/admin/users`, used by backend/seed.py
and by any admin-created account) creates the auth.users row via an initial
INSERT with empty metadata, then a follow-up UPDATE that actually sets
app_metadata/user_metadata. The original `on_auth_user_created` trigger only
fired AFTER INSERT ON auth.users, so it always read the role *before* it was
set, silently defaulting every admin-created account to 'patient' regardless
of the role requested — this is what this revision fixes.

`handle_new_user()` itself is unchanged in its role-resolution logic; it's
now also wired to an AFTER UPDATE trigger (fired only when the metadata
columns it actually reads change, so a plain last_sign_in_at bump on every
login doesn't re-run it), and its INSERT gains an ON CONFLICT DO UPDATE so
re-running it against an existing profile row re-syncs role/is_verified
without touching fields the user may have edited themselves since (full_name,
phone, date_of_birth).
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a3cf387506ab'
down_revision: Union[str, Sequence[str], None] = '54f7d5b94bf6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPGRADE_STATEMENTS = [
    """
    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer set search_path = public
    as $$
    declare
      v_role text;
    begin
      v_role := new.raw_app_meta_data->>'role';
      if v_role is null then
        v_role := coalesce(new.raw_user_meta_data->>'role', 'patient');
        if v_role = 'admin' then
          v_role := 'patient';
        end if;
      end if;
      if v_role not in ('patient','doctor','admin') then
        v_role := 'patient';
      end if;

      insert into public.users (id, email, full_name, phone, date_of_birth, role, is_verified, is_active)
      values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'phone',
        nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
        v_role,
        new.email_confirmed_at is not null,
        true
      )
      on conflict (id) do update set
        role = excluded.role,
        is_verified = excluded.is_verified,
        updated_at = now();

      if v_role = 'patient' then
        insert into public.patients (user_id) values (new.id) on conflict (user_id) do nothing;
      elsif v_role = 'doctor' then
        insert into public.doctors (user_id, specialty) values (new.id, 'General Practice') on conflict (user_id) do nothing;
      end if;

      return new;
    end;
    $$
    """,

    'drop trigger if exists on_auth_user_updated on auth.users',
    """
    create trigger on_auth_user_updated
      after update of raw_app_meta_data, raw_user_meta_data, email_confirmed_at on auth.users
      for each row execute function public.handle_new_user()
    """,
]

DOWNGRADE_STATEMENTS = [
    'drop trigger if exists on_auth_user_updated on auth.users',
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
