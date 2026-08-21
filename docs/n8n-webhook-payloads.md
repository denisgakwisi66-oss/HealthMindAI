# HealthMind → n8n webhook payloads

Configure the backend:

```env
N8N_WEBHOOK_URL=https://<your-n8n>/webhook/healthmind-care
N8N_WEBHOOK_SECRET=<long-random-string>
```

## Request

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Headers:**
  - `X-HealthMind-Event`: event name (same as `event` in body)
  - `X-HealthMind-Signature`: `sha256=<hex>` HMAC-SHA256 of the **raw body** using `N8N_WEBHOOK_SECRET` (omitted if secret empty)

## Envelope

```json
{
  "event": "appointment.created",
  "timestamp": "2026-08-20T22:00:00Z",
  "source": "healthmind-ai",
  "data": { }
}
```

## Events

| Event | When |
|-------|------|
| `appointment.created` | Patient books |
| `appointment.cancelled` | Patient/admin cancels |
| `appointment.status_changed` | Doctor/admin updates status |
| `emergency.alert` | SOS sent successfully |
| `user.registered` | Frontend notifies after signup |
| `medication.created` | Patient adds medication |
| `medication.updated` | Medication updated |

## Verify signature in n8n

1. Webhook node → raw body
2. Crypto / Code node: `hmac_sha256(rawBody, secret)` equals header without `sha256=` prefix
3. Switch on `{{$json.event}}`


## Automation API (n8n Cron → HealthMind)

Header on every call:

```http
X-HealthMind-Automation-Key: <same value as N8N_WEBHOOK_SECRET>
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/automation/appointments/upcoming?within_hours=24` | Appointments in the next N hours |
| GET | `/api/automation/appointments/upcoming?within_hours=1` | Appointments in the next hour |
| GET | `/api/automation/medications/due?window_minutes=30` | Meds whose schedule is near now |

Timezone for schedule matching: `Africa/Kigali`.

## Live deployment

For the n8n Cloud Care Orchestrator (`$vars`, Gmail, webhook URL), see
[`n8n/LIVE-INTEGRATION.md`](../n8n/LIVE-INTEGRATION.md).

