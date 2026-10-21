# HealthMind AI Backend

This repository contains the Python FastAPI backend for HealthMind AI.

The backend **also serves the frontend**. `backend/app/main.py` mounts the
project root (where `index.html`, `login.html`, `dashboard.html`, etc. live) at
`/`, so you only need to run the backend to get the whole app: open
`http://localhost:8000` in your browser and the API is available under `/api`.

Authentication, sessions, and password reset are handled by **Supabase Auth**
end-to-end — the frontend talks to Supabase directly for sign-up/login/reset,
and this backend only verifies the resulting tokens and owns the
application-specific data (appointments, records, medications, etc.), stored
in Supabase's Postgres.

## Setup

1. Create a Supabase project (see **Supabase project setup** below) and run
   the schema bootstrap.
2. Copy `.env.example` to `.env` and fill in the `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` values from your
   project's dashboard, plus a `DATABASE_URL` pointing at its Postgres
   connection string and a `GEMINI_API_KEY`. Set `GEMINI_LIVE_MODEL` to the
   Gemini Live model enabled for your API key.
3. Install dependencies:

```bash
python -m pip install -r requirements.txt
```

## Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run the schema bootstrap script (ask whoever ran the
   FURPS/Supabase migration for the current copy, or find it in
   `backend/alembic/versions/` — the initial revision contains the same SQL).
3. **Authentication → Providers** → confirm Email/Password is enabled;
   enable Google there if you want the Google sign-in button to work.
4. **Settings → API Keys** → copy the **Project URL**, **publishable key**,
   and **secret key**. No separate JWT secret is needed — this
   app verifies session tokens against the project's public JWKS at runtime
   (`app/core/security.py`), which works for both the legacy shared-secret
   projects and the newer asymmetric-key ones.
5. **Settings → Database → Connection string** → copy either the direct or
   pooled connection string for `DATABASE_URL` (asyncpg driver:
   `postgresql+asyncpg://...`).
6. To create demo accounts (patient/doctor/admin), run `python seed.py` from
   `backend/` once `.env` is filled in.

## Run Locally (Linux / macOS / Windows)

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open <http://localhost:8000>.

- The frontend pages are served from the same FastAPI app.
- The frontend API client (`js/services/api.js`) uses a **relative `/api`**
  base by default, so no CORS setup is needed when served from the backend.
  Set `VITE_API_URL` if you serve the frontend from a separate origin (Vite).
- The frontend gets its Supabase URL/anon key from `GET /api/config/public`
  (backed by your `.env`) — never hardcode them into the shipped JS.

### Gemini Live voice assistant

Set `GEMINI_API_KEY` and a Live API-enabled `GEMINI_LIVE_MODEL` in
`backend/.env`, then build the React/TypeScript widget from the repository root
with `npm install` and `npm run build:voice`. The authenticated
`POST /api/ai/gemini/live-token` endpoint exchanges the server-only key for a
short-lived, single-use token. The browser uses that token to connect to Gemini
Live over a WebSocket; voice audio is streamed to Gemini and is not stored by
this application. Text fallback uses the existing AI chat service and its
normal conversation storage. During Live voice, the assistant can look up
appointments, doctors, available slots, medications, and medical-record
metadata. Booking, cancellation, and adding a medication require an explicit
confirmation in the widget and use the same authenticated application APIs as
the corresponding pages. The assistant may only record medication details the
user says were prescribed; it must not prescribe or infer medication or dosage.
Microphone access requires HTTPS or localhost.

## Run with Docker

```bash
cd backend
docker compose up --build
```

There's no local database service — `DATABASE_URL` points at Supabase's
Postgres in every environment. `docker-compose.yml` only runs the app itself
plus Redis (for rate limiting/Celery).

### Migrations

Schema changes go through Alembic, pointed at `DATABASE_URL`:

```bash
cd backend
alembic upgrade head
```

On a **fresh** Supabase project where you already ran the SQL bootstrap
script by hand in the SQL Editor, stamp it instead of re-running the (albeit
idempotent) SQL:

```bash
alembic stamp head
```

Future schema changes: `alembic revision --autogenerate -m "..."`, review the
generated file, then `alembic upgrade head`.

### Tests

```bash
cd backend
pytest
```

Tests need a real Postgres (not SQLite — the schema uses native `uuid`
columns) with a stub `auth.users` table; see
`.github/workflows/backend-tests.yml` for the exact setup, or run against a
disposable Supabase branch/project.

## API Compatibility

The frontend expects backend routes under `/api/...`. See `app/api/routes/`
for the available endpoints (auth, users, dashboard, ai, appointments,
medications, notifications, health, system, admin). Sign-up, login, logout,
and password reset are **not** backend routes — the frontend calls Supabase
directly for those (see `js/services/auth.js`).
