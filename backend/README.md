# HealthMind AI Backend

This repository contains the Python FastAPI backend for HealthMind AI.

The backend **also serves the frontend**. `backend/app/main.py` mounts the
project root (where `index.html`, `login.html`, `dashboard.html`, etc. live) at
`/`, so you only need to run the backend to get the whole app: open
`http://localhost:8000` in your browser and the API is available under `/api`.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in the required environment variables (at minimum a working
   `DATABASE_URL` for auth endpoints, `JWT_SECRET_KEY`, `APP_SECRET_KEY`).
3. Install dependencies:

```bash
python -m pip install -r requirements.txt
```

## Run Locally (Linux / macOS / Windows)

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open <http://localhost:8000>.

- The frontend pages are served from the same Django-less FastAPI app.
- The frontend API client (`js/services/api.js`) uses a **relative `/api`**
  base by default, so no CORS setup is needed when served from the backend.
  Set `VITE_API_URL` if you serve the frontend from a separate origin (Vite).

### Database

Auth endpoints (login / register / profile) need PostgreSQL. The app will
auto-create its tables on startup when `DATABASE_URL` is reachable. To create
demo accounts:

```bash
cd backend
python seed.py
#   patient: patient@healthmind.ai / Demo@1234
#   doctor:  doctor@healthmind.ai   / Demo@1234
#   admin:   admin@healthmind.ai    / Demo@1234
```

Redis and Firebase are optional and only power `/api/system/status` and
push notifications / Celery; the app runs without them.

## Run with Docker

```bash
cd backend
docker compose up --build
```

(With Docker Compose, keep `DATABASE_URL` / `REDIS_URL` pointing at the `db`
and `redis` service hostnames, as in the commented variants of `.env.example`.)

### Migrations

Tables are auto-created on startup for development. If you prefer Alembic:

```bash
cd backend
alembic upgrade head
```

### Tests

```bash
cd backend
pytest
```

## API Compatibility

The frontend expects backend routes under `/api/...`. See `app/api/routes/`
for the available endpoints (auth, users, dashboard, ai, appointments,
medications, notifications, health, system).
