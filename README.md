# HealthMind AI

A healthcare patient-portal app: a FastAPI backend and a vanilla HTML/CSS/JS
frontend, served together from the same process.

- **Backend setup, Supabase project setup, running locally/with Docker,
  running tests:** see [`backend/README.md`](backend/README.md).
- **Frontend**: plain HTML/CSS/JS under `js/` and `css/`, served as static
  files by the backend — no build step. `js/services/auth.js` talks to
  Supabase Auth directly; `js/services/api.js` talks to this backend's `/api`.
- **Languages**: English, French, and Kinyarwanda are available from the
  app's language selector. The choice is saved on the device and applies to
  the current page, shared navigation, and interface elements rendered later.
  Patient-entered content and AI-generated answers are not rewritten by the
  interface translator.
- **Voice assistant**: React/TypeScript source in `js/voice-assistant.tsx`;
  run `npm install` and `npm run build:voice` from the repository root after
  checkout. It uses Gemini Live with backend-minted, short-lived tokens; see
  [`backend/README.md`](backend/README.md) for setup.
- **Diagnostic scripts**: see [`scripts/README.md`](scripts/README.md).

## Quick start

```bash
cd backend
python -m pip install -r requirements.txt
# fill in backend/.env — see backend/README.md's Supabase project setup section
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open <http://localhost:8000>.

## Android and iOS apps

The mobile clients use Capacitor and package the existing frontend locally;
the FastAPI backend remains a separately hosted service. Deploy the backend
over HTTPS before building a device app, then configure its origin in the
build environment. Do not put API keys, Supabase secrets, or database
credentials in the mobile app.

```powershell
npm.cmd install
$env:HEALTHMIND_API_URL = "https://your-api.example.com"
npm.cmd run mobile:add:android
npm.cmd run mobile:add:ios
npm.cmd run mobile:sync:android
npm.cmd run mobile:sync:ios
```

`mobile:sync:ios` prepares the iOS target; building and signing iOS requires
macOS with Xcode. Android builds require Android Studio and the Android SDK.
The mobile build requires an HTTPS API origin and fails if it is missing.
For a production backend, include `https://localhost` and
`capacitor://localhost` in `FRONTEND_ORIGINS` alongside any web origins so
the packaged WebView can make credentialed API requests. Keep that allowlist
explicit; do not enable wildcard CORS.

In Supabase Auth URL Configuration, add `https://localhost/**` and
`capacitor://localhost/**` to the allowed redirect URLs so password recovery
can return to either native WebView origin. Keep your existing website URLs
there as well.

### Render free/test deployment

The root [`render.yaml`](render.yaml) defines a free Render web service and
private free Key Value instance. Connect this GitHub repository in Render and
create a Blueprint from `render.yaml`. Enter the required database, Supabase,
and Gemini values in Render's secret prompts; never commit them or paste them
into chat. Render assigns an HTTPS `onrender.com` URL after deployment. Use
that exact URL as `HEALTHMIND_API_URL` when syncing the Capacitor projects.
Apply database changes with `python -m alembic upgrade head` from the backend
directory before testing newly added features.

This is only a test configuration: free web services can sleep, free Key
Value data is not persistent, and Render does not provide free background
workers. The blueprint therefore omits Celery worker/beat services, so
scheduled/background tasks will not run. Do not use this free setup with real
patient records or for production.

Medical-record uploads use local disk in development. Production startup
requires `MEDICAL_RECORDS_STORAGE_PROVIDER=supabase`; create a **private**
Supabase Storage bucket (default name `medical-records`) before deploying and
set `SUPABASE_STORAGE_BUCKET` if you choose another name. The backend accesses
objects with its server-only Supabase secret key, while authenticated API
routes enforce record permissions. Never make the bucket public or put the
secret key in the mobile app. Configure storage retention, backups, and
restore testing for your requirements before enabling patient uploads.

A production deployment also needs an appropriate paid, reliable compute and
background-worker plan. Render's free tier can sleep, lacks persistent
Key Value data, and blocks outbound SMTP ports used by the default
email-alert configuration. For email on Render's free tier, configure a
Resend API key as `RESEND_API_KEY` and a verified sender as `EMAIL_FROM` in
the Render service environment. Emergency, appointment, and medication
notifications are sent to `denisgakwisi66@gmail.com`; without an email
provider and verified sender, delivery is not available. This free setup is
only suitable for fake-data testing.

The FastAPI service checks active medication schedules every 15 seconds using
Africa/Kigali time and sends a reminder email at the scheduled time, with a
five-minute catch-up window and retry attempts if email delivery fails. Apply
the database migrations through `a2c6e8f10345` for the reminder delivery log
before starting the updated service. This scheduler is part of the web service;
it does not depend on a browser tab or the n8n Cron workflow.

Microphone access for the Gemini voice assistant is requested by the app at
runtime. Android and iOS native projects include a user-facing microphone
permission description. Voice conversations still require a network
connection to the FastAPI backend and Gemini Live.

## n8n Care Orchestrator

Appointment confirmations, medication reminders, SOS fan-out, and welcome
emails are automated via n8n.

1. Set `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` in `backend/.env`
2. Import workflows from [`n8n/`](n8n/) (see [`n8n/README.md`](n8n/README.md))
3. Payload reference: [`docs/n8n-webhook-payloads.md`](docs/n8n-webhook-payloads.md)
