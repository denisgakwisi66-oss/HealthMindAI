# HealthMind AI

A healthcare patient-portal app: a FastAPI backend and a vanilla HTML/CSS/JS
frontend, served together from the same process.

- **Backend setup, Supabase project setup, running locally/with Docker,
  running tests:** see [`backend/README.md`](backend/README.md).
- **Frontend**: plain HTML/CSS/JS under `js/` and `css/`, served as static
  files by the backend — no build step. `js/services/auth.js` talks to
  Supabase Auth directly; `js/services/api.js` talks to this backend's `/api`.
- **Diagnostic scripts**: see [`scripts/README.md`](scripts/README.md).

## Quick start

```bash
cd backend
python -m pip install -r requirements.txt
# fill in backend/.env — see backend/README.md's Supabase project setup section
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open <http://localhost:8000>.

## n8n Care Orchestrator

Appointment confirmations, medication reminders, SOS fan-out, and welcome
emails are automated via n8n.

1. Set `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` in `backend/.env`
2. Import workflows from [`n8n/`](n8n/) (see [`n8n/README.md`](n8n/README.md))
3. Payload reference: [`docs/n8n-webhook-payloads.md`](docs/n8n-webhook-payloads.md)

