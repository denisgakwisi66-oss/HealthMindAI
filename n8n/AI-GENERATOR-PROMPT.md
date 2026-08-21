> **n8n Cloud note:** On n8n Cloud, `$env.*` is often blocked — use **`$vars.*`**
> (n8n Variables) instead. Prefer the **Gmail** node if you have no SMTP credential.
> See [`LIVE-INTEGRATION.md`](LIVE-INTEGRATION.md) for the live workflow that was built.

# Paste this into n8n AI Workflow Builder

Copy everything inside the box below and paste it into n8n’s AI generator
(“Build with AI” / workflow chat). After it builds the workflow:

1. Add your **SMTP** credential
2. Optionally add **Slack** for SOS
3. Activate the workflow and copy the **Production Webhook URL**
4. Put that URL in HealthMind `backend/.env` as `N8N_WEBHOOK_URL`
5. Set the same shared secret in both places (`N8N_WEBHOOK_SECRET` / n8n variable)

---

## PROMPT (copy from here)

```
Build an n8n workflow named "HealthMind Care Orchestrator" for a healthcare app called HealthMind AI.

## Goal
Receive live events from the HealthMind backend via webhook, then send the right emails (and optional Slack) for appointments, medications, SOS emergencies, and new user onboarding. Also include a second schedule-based branch (or a second workflow) that polls HealthMind every 15 minutes for appointment reminders (T-24h and T-1h) and medication due reminders.

## Incoming webhook
- Method: POST
- Path: healthmind-care
- Content-Type: application/json
- Headers from HealthMind:
  - X-HealthMind-Event: same as body.event
  - X-HealthMind-Signature: sha256=<hmac_hex> of the raw request body using shared secret
- Body envelope ALWAYS looks like:
{
  "event": "appointment.created",
  "timestamp": "2026-08-20T22:00:00Z",
  "source": "healthmind-ai",
  "data": { }
}

After the Webhook node, add a Code node that:
1. Reads the JSON body
2. Soft-verifies HMAC-SHA256 signature against env var HEALTHMIND_WEBHOOK_SECRET (header X-HealthMind-Signature, format sha256=<hex>). If HEALTHMIND_VERIFY_STRICT=1 and signature mismatches, throw. Otherwise continue.
3. Outputs: { event, timestamp, source, data }

Then Switch / IF on `event` into these branches:

### 1) appointment.created
data typically includes:
appointment_id, patient_id, patient_name, patient_email, doctor_id, doctor_name, specialty, date, time, reason, status

Actions:
- Email patient (to data.patient_email): confirm booking with doctor name, date, time, specialty
- Email admin (to env HEALTHMIND_ADMIN_EMAIL): notify new booking

### 2) appointment.cancelled
data: appointment_id, patient_id, doctor_id, date, time, reason, cancelled_by, cancelled_by_name, status
Action: email patient (if email available) and/or admin that appointment was cancelled with reason

### 3) appointment.status_changed
data: appointment_id, patient_id, doctor_id, date, time, status, updated_by, updated_by_name
Action: email admin (and patient if email present) with the new status

### 4) emergency.alert  (CRITICAL — highest priority)
data may include:
event_id, user_id, user_name, user_email, message, latitude, longitude, accuracy, recipient, email_delivered, maps_link

Actions (fan-out):
- Email env HEALTHMIND_SOS_EMAIL (fallback HEALTHMIND_ADMIN_EMAIL) with subject "SOS ALERT" including user, message, coordinates, maps_link
- Optional Slack message to channel from env HEALTHMIND_SLACK_SOS_CHANNEL with same details
- Keep this path simple and reliable; do not delay SOS behind other branches

### 5) user.registered
data: user_id, email, full_name, role, phone
Actions:
- Welcome email to the new user
- Notify admin of new registration + role

### 6) medication.created
data: medication_id, patient_id, patient_email, patient_name, name, dosage, frequency, schedule, instructions, start_date, end_date
Action: email patient confirming medication was saved and that reminders will use schedule times (comma-separated HH:MM)

### 7) medication.updated
Acknowledge / optional short email to patient that medication was updated. No heavy logic.

### Fallback
Log/ignore unknown events without failing the webhook response.

## Reminder Cron (same workflow with Schedule trigger OR separate workflow "HealthMind Reminders Cron")
Every 15 minutes:

A) HTTP Request GET {{$env.HEALTHMIND_API_BASE}}/api/automation/appointments/upcoming?within_hours=24
Header: X-HealthMind-Automation-Key = {{$env.HEALTHMIND_WEBHOOK_SECRET}}
Response shape:
{ within_hours, generated_at, count, appointments: [ { appointment_id, hours_until, date, time, specialty, patient:{full_name,email,phone}, doctor:{full_name,email} } ] }

Filter appointments where hours_until is about 24 (23–25) OR about 1 (0.5–1.5).
For each, email patient a reminder labeled T-24h or T-1h.

B) HTTP Request GET {{$env.HEALTHMIND_API_BASE}}/api/automation/medications/due?window_minutes=30
Same automation header.
Response shape:
{ window_minutes, generated_at, count, medications: [ { medication_id, name, dosage, schedule_time, instructions, patient:{full_name,email,phone} } ] }

For each due med with patient.email, send "time to take {name} ({dosage})" email.

Timezone context: Africa/Kigali (backend already matches schedules in that TZ).

## Email style
- From: {{$env.HEALTHMIND_FROM_EMAIL}} or noreply@healthmind.ai
- Calm, clear, short healthcare tone
- Never invent clinical advice
- Always include that SOS does not replace calling local emergency services

## Credentials / env to expect
- SMTP credential for all emails
- Optional Slack credential for SOS
- Env vars: HEALTHMIND_WEBHOOK_SECRET, HEALTHMIND_API_BASE, HEALTHMIND_FROM_EMAIL, HEALTHMIND_ADMIN_EMAIL, HEALTHMIND_SOS_EMAIL, HEALTHMIND_SLACK_SOS_CHANNEL, HEALTHMIND_VERIFY_STRICT

## Output requirements
- Name nodes clearly
- Webhook should respond quickly (onReceived) so HealthMind is not blocked
- Do not hardcode secrets
- Prefer Switch on event, then parallel email nodes where useful (patient + admin)
- Make the workflow ready to activate after I attach SMTP credentials
```

## PROMPT END

---

## After n8n builds it

Set in HealthMind `backend/.env`:

```env
N8N_WEBHOOK_URL=https://YOUR
N8N_WEBHOOK_SECRET=same-secret-you-put-in-n8n
```

Restart backend, then test by booking an appointment or triggering SOS — you should see executions in n8n.
