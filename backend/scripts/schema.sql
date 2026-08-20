-- ============================================================
-- HealthMind AI — Supabase schema
-- Mirrors the combined effect of every revision under
-- backend/alembic/versions/ (currently: 54f7d5b94bf6 initial schema,
-- a3cf387506ab role-sync-on-update trigger fix, d13194b83663
-- notification_emails table). This copy is for reference / pasting into
-- the Supabase SQL Editor by hand; the source of truth for what's
-- actually applied to a given database is Alembic (`alembic upgrade
-- head` / `alembic current`), not this file — if you edit the schema,
-- add a new Alembic revision and update this file to match, not the
-- other way around.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- users (profile row, keyed to auth.users) ----------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  date_of_birth date,
  role text not null default 'patient' check (role in ('patient','doctor','admin')),
  profile_picture text,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_role on public.users(role);

-- ---------- patients / doctors (1:1 profile extensions) ----------
create table if not exists public.patients (
  id bigserial primary key,
  user_id uuid not null unique references public.users(id) on delete cascade,
  blood_group text,
  allergies text,
  chronic_conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  height_cm numeric,
  weight_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id bigserial primary key,
  user_id uuid not null unique references public.users(id) on delete cascade,
  specialty text not null,
  bio text,
  years_experience integer,
  license_number text,
  consultation_fee numeric,
  location text,
  is_accepting_new boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_doctors_specialty on public.doctors(specialty);

create table if not exists public.availability (
  id bigserial primary key,
  doctor_id bigint not null references public.doctors(id) on delete cascade,
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  unique (doctor_id, weekday, start_time)
);

-- ---------- appointments ----------
create table if not exists public.appointments (
  id bigserial primary key,
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete cascade,
  specialty text,
  date date not null,
  time text not null,
  reason text,
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','completed','cancelled','no_show','rescheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_active_appointment_slot on public.appointments (doctor_id, date, time)
  where status <> 'cancelled';
create index if not exists idx_appointments_patient on public.appointments(patient_id);
create index if not exists idx_appointments_doctor on public.appointments(doctor_id);

-- ---------- medications ----------
create table if not exists public.medications (
  id bigserial primary key,
  patient_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  schedule text,
  instructions text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  times_taken integer not null default 0,
  times_due integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_medications_patient on public.medications(patient_id);

-- ---------- medical records ----------
create table if not exists public.medical_records (
  id bigserial primary key,
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid references public.users(id) on delete set null,
  title text not null,
  record_type text not null default 'other'
    check (record_type in ('lab_report','consultation','prescription','imaging','vaccination','other')),
  notes text,
  file_name text,
  file_path text,
  file_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_medical_records_patient on public.medical_records(patient_id);
create index if not exists idx_medical_records_doctor on public.medical_records(doctor_id);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);

-- ---------- AI assistant ----------
create table if not exists public.ai_conversations (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id bigserial primary key,
  conversation_id bigint not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------- emergency events (unauthenticated callers allowed) ----------
create table if not exists public.emergency_events (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  message text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  status text not null default 'sent' check (status in ('sent','failed','resolved')),
  recipient text,
  error_detail text,
  created_at timestamptz not null default now()
);

-- ---------- audit log ----------
create table if not exists public.audit_logs (
  id bigserial primary key,
  action text not null,
  user_id uuid references public.users(id) on delete set null,
  resource_type text,
  resource_id text,
  details jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_user on public.audit_logs(user_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);

-- ============================================================
-- Auto-create the profile row (+ patient/doctor row) on signup.
--
-- Role resolution order:
--   1. raw_app_meta_data->>'role'   — only settable via the service-role
--      Admin API (trusted). Used by backend/seed.py for demo accounts.
--   2. raw_user_meta_data->>'role'  — settable by the signing-up client
--      itself (untrusted, this is what register.js sends). May be
--      'patient' or 'doctor', but 'admin' here is silently demoted to
--      'patient' — public self-registration can never create an admin,
--      even though Supabase's own /auth/v1/signup endpoint would
--      otherwise let any caller pass arbitrary metadata.
--   3. 'patient' — default if neither is present.
-- ============================================================
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supabase's Admin API (used by backend/seed.py and any admin-created
-- account) creates auth.users via an initial INSERT with empty metadata,
-- then a follow-up UPDATE that actually sets app_metadata/user_metadata.
-- Without this second trigger, the role above is always read before it's
-- set, and every admin-created account silently becomes 'patient'.
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_app_meta_data, raw_user_meta_data, email_confirmed_at on auth.users
  for each row execute function public.handle_new_user();

-- ---------- notification emails (operational log, no FK to users) ----------
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
);
create index if not exists idx_notification_emails_event on public.notification_emails(event_type);
create index if not exists idx_notification_emails_created on public.notification_emails(created_at);

-- ============================================================
-- Row Level Security — enable everywhere, no policies.
-- FastAPI connects with a trusted Postgres role and bypasses RLS by
-- design; this is defense-in-depth against anon/authenticated misuse.
-- ============================================================
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.medical_records enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.emergency_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_emails enable row level security;
