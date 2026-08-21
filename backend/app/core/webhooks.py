"""Outbound webhooks for n8n (Care Orchestrator).

HealthMind emits domain events to N8N_WEBHOOK_URL. Delivery failures are
logged and never raise into the request path — the clinical action already
succeeded; automation is best-effort.

When N8N_WEBHOOK_SECRET is set, every request includes:
  X-HealthMind-Signature: sha256=<hmac_hex>
  X-HealthMind-Event: <event_name>
so n8n can reject unsigned or tampered payloads.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from loguru import logger

from app.core.config import settings


def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def build_webhook_payload(event: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "healthmind-ai",
        "data": data,
    }


async def emit_n8n_event(event: str, data: dict[str, Any]) -> bool:
    """POST a signed JSON event to n8n. Returns True if HTTP 2xx."""
    url = (settings.n8n_webhook_url or "").strip()
    if not url:
        logger.debug("n8n webhook skipped (N8N_WEBHOOK_URL empty): {}", event)
        return False

    payload = build_webhook_payload(event, data)
    body = json.dumps(payload, default=str, separators=(",", ":")).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-HealthMind-Event": event,
        "User-Agent": "HealthMindAI-Webhooks/1.0",
    }

    secret = settings.n8n_webhook_secret.get_secret_value().strip()
    if secret:
        headers["X-HealthMind-Signature"] = f"sha256={_sign(body, secret)}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, content=body, headers=headers)
        if 200 <= response.status_code < 300:
            logger.info("n8n webhook delivered event={} status={}", event, response.status_code)
            return True
        logger.warning(
            "n8n webhook non-2xx event={} status={} body={}",
            event,
            response.status_code,
            response.text[:200],
        )
        return False
    except Exception as exc:
        logger.warning("n8n webhook failed event={}: {}", event, exc)
        return False
