# HealthMind × n8n Care Orchestrator

These workflows turn HealthMind domain events into patient/admin emails,
SOS fan-out, and scheduled appointment/medication reminders.

## Files

| File | Purpose |
|------|---------|
| `healthmind-care-orchestrator.json` | Webhook router for live events |
| `healthmind-reminders-cron.json` | Every-15-minutes poll for T-24h / T-1h appts + due meds |

## Backend env

```env
N8N_WEBHOOK_URL=https://<your-n8n-host>/webhook/healthmind-care
N8N_WEBHOOK_SECRET=<long-random-shared-secret>
```

Restart the FastAPI server after changing `.env`.

## n8n env / credentials

Set in n8n (Settings → Variables or environment):

| Variable | Example |
|----------|---------|
| `HEALTHMIND_WEBHOOK_SECRET` | same as `N8N_WEBHOOK_SECRET` |
| `HEALTHMIND_API_BASE` | `http://host.docker.internal:8000` (or your public API URL) |
| `HEALTHMIND_FROM_EMAIL` | `noreply@yourdomain.com` |
| `HEALTHMIND_ADMIN_EMAIL` | ops inbox |
| `HEALTHMIND_SOS_EMAIL` | on-call inbox (optional) |
| `HEALTHMIND_VERIFY_STRICT` | `1` to reject bad HMAC signatures |

Also create an **SMTP** credential named `HealthMind SMTP` (or re-map nodes).

Optional: Slack credential for the SOS node.

## Import

1. Open n8n → **Workflows → Import from File**
2. Import both JSON files
3. Open **HealthMind Care Orchestrator** → activate
4. Copy the Production Webhook URL into `N8N_WEBHOOK_URL`
5. Activate **HealthMind Reminders Cron**

## Events handled

- `appointment.created` / `cancelled` / `status_changed`
- `emergency.alert`
- `user.registered`
- `medication.created` / `updated`

## Reminder API (Cron → HealthMind)

```http
GET /api/automation/appointments/upcoming?within_hours=24
GET /api/automation/medications/due?window_minutes=30
X-HealthMind-Automation-Key: <N8N_WEBHOOK_SECRET>
```

Timezone for schedule matching: `Africa/Kigali`.

## Quick test without n8n UI

Point `N8N_WEBHOOK_URL` at [webhook.site](https://webhook.site) temporarily, trigger book/SOS/register, confirm payloads arrive with `X-HealthMind-Event` + `X-HealthMind-Signature`.

## Live n8n Cloud build

See [`LIVE-INTEGRATION.md`](LIVE-INTEGRATION.md) for the actual Cloud workflow
(`$vars`, Gmail, HMAC soft-verify, webhook URL, publish checklist).

