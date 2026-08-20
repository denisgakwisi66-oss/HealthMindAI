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
