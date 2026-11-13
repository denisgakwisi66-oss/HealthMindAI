from __future__ import annotations

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from loguru import logger

from app.core.config import settings


def _send_sync(recipient: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """Send an email using SMTP. Returns True on success. Never raises."""

    msg = MIMEMultipart('alternative')
    msg['From'] = settings.smtp_from
    msg['To'] = recipient
    msg['Subject'] = subject
    msg.attach(MIMEText(text_body, 'plain'))
    if html_body:
        msg.attach(MIMEText(html_body, 'html'))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            if settings.use_tls:
                server.starttls()
                server.ehlo()
            user = settings.smtp_user.get_secret_value()
            password = settings.smtp_password.get_secret_value()
            if user and password:
                server.login(user, password)
            server.sendmail(settings.smtp_from, [recipient], msg.as_string())
        return True
    except Exception as exc:  # pragma: no cover - depends on external service
        logger.error(f'Email send failed to {recipient}: {type(exc).__name__}: {exc}')
        return False


async def send_email(recipient: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """Send through Resend when configured, otherwise use SMTP in a worker thread.

    Returns True on delivery success and False when email cannot be sent.
    """
    if not settings.email_notifications_enabled:
        logger.info('Email notifications disabled; skipping email to %s.', recipient)
        return False

    resend_key = settings.resend_api_key.get_secret_value()
    if resend_key:
        if not settings.email_from.strip():
            logger.error('Resend email delivery is configured without EMAIL_FROM.')
            return False
        payload = {
            'from': settings.email_from,
            'to': [recipient],
            'subject': subject,
            'text': text_body,
        }
        if html_body:
            payload['html'] = html_body
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    'https://api.resend.com/emails',
                    headers={'Authorization': f'Bearer {resend_key}'},
                    json=payload,
                )
                response.raise_for_status()
            return True
        except httpx.HTTPStatusError as exc:
            logger.error('Resend email delivery failed with HTTP {}.', exc.response.status_code)
            return False
        except httpx.HTTPError as exc:
            logger.error('Resend email delivery failed: {}', type(exc).__name__)
            return False

    if not settings.smtp_configured:
        logger.warning('No email provider configured; skipping email to %s.', recipient)
        return False
    return await asyncio.to_thread(_send_sync, recipient, subject, text_body, html_body)