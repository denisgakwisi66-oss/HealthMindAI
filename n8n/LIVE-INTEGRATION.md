# HealthMind Care Orchestrator — Live Integration

**Workflow ID:** `iQ1LSprpJml0rivt`  
**Webhook (prod):** `https://utekanaoworkflow.app.n8n.cloud/webhook/healthmind-care`  
**Status:** Built in n8n Cloud (draft). Backend URL is wired. Publish after smoke test.

## What n8n actually uses (vs original prompt)

| Topic | Original prompt | Live n8n Cloud build |
|-------|-----------------|----------------------|
| Config | `$env.HEALTHMIND_*` | `$vars.HEALTHMIND_*` (Cloud blocks `$env`) |
| Email | SMTP + `HEALTHMIND_FROM_EMAIL` | **Gmail** node (sends from your Gmail; display name “HealthMind AI”) |
| HMAC | Code reads secret directly | **Inject Config (Set)** → **Verify & Normalize (Code)** |
| Slack | Optional | Connected; channel must be ID (`C0…`), not `#name` |

## n8n Variables to create

Settings → Variables:

| Variable | Required | Notes |
|----------|----------|--------|
| `HEALTHMIND_WEBHOOK_SECRET` | Yes | Same value as `backend/.env` → `N8N_WEBHOOK_SECRET` |
| `HEALTHMIND_API_BASE` | Yes (for Cron) | Public base URL of this API, **no trailing slash** (e.g. ngrok / deployed host). Local-only URLs won’t work from n8n Cloud. |
| `HEALTHMIND_ADMIN_EMAIL` | Yes | Ops inbox |
| `HEALTHMIND_SOS_EMAIL` | Recommended | Falls back to admin if unset |
| `HEALTHMIND_SLACK_SOS_CHANNEL` | If Slack used | Channel **ID** |
| `HEALTHMIND_VERIFY_STRICT` | Optional | Leave unset/`0` until signatures match; `1` hard-rejects bad HMAC |

## Backend `.env` (already set on this machine)

```env
N8N_WEBHOOK_URL=https://utekanaoworkflow.app.n8n.cloud/webhook/healthmind-care
N8N_WEBHOOK_SECRET=<same as n8n Variable HEALTHMIND_WEBHOOK_SECRET>
```

Restart FastAPI after changing the secret.

## HMAC note (important)

HealthMind signs the **exact raw POST bytes** it sends (compact JSON, no spaces).

Your n8n Code node re-stringifies the **parsed** body with `JSON.stringify(body)`. That can differ (key order / spacing), so keep **`HEALTHMIND_VERIFY_STRICT` soft** until you confirm a live signature matches. Soft mode still runs the workflow; it only logs unverified.

## Cron APIs (already implemented)

Every 15 minutes n8n should call:

```http
GET {HEALTHMIND_API_BASE}/api/automation/appointments/upcoming?within_hours=24
GET {HEALTHMIND_API_BASE}/api/automation/medications/due?window_minutes=30
X-HealthMind-Automation-Key: <HEALTHMIND_WEBHOOK_SECRET>
```

Reminder windows: `hours_until` 23–25 → T-24h; 0.5–1.5 → T-1h.  
Schedule timezone: `Africa/Kigali`.

## Verified in n8n (mocks)

- `appointment.created` → patient + admin emails only  
- `emergency.alert` → SOS email + Slack  
- Webhook → Inject Config → Verify → Switch + `$vars` resolve  

## Still to verify live

- Other branches: cancelled, status_changed, user.registered, medication.*, fallback  
- Schedule / reminders against a publicly reachable `HEALTHMIND_API_BASE`  
- Real Gmail + Slack sends  
- **Publish** the workflow after a successful live smoke test  

## Live smoke checklist

1. Paste `N8N_WEBHOOK_SECRET` into n8n Variable `HEALTHMIND_WEBHOOK_SECRET`  
2. Restart backend  
3. Book a test appointment (or hit SOS) while logged in  
4. Confirm an execution appears in n8n and Gmail/Slack fire  
5. Publish the workflow  

## Optional later

- Gmail “Send As” `noreply@healthmind.ai`, or switch nodes back to SMTP  
- Point `HEALTHMIND_API_BASE` at a tunnel (ngrok) or production host so Cloud Cron can reach automation APIs  
