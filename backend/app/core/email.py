from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
    """Send an email asynchronously (SMTP is blocking, so run in a thread pool).

    Returns True on success and False when the mail server is unreachable or
    SMTP is not configured, so callers can degrade gracefully.
    """
    if not settings.smtp_configured:
        logger.warning('SMTP not configured; skipping email to %s.', recipient)
        return False
    if not settings.email_notifications_enabled:
        logger.info('Email notifications disabled; skipping email to %s.', recipient)
        return False
    return await asyncio.to_thread(_send_sync, recipient, subject, text_body, html_body)