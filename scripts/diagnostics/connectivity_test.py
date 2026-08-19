#!/usr/bin/env python3
"""Test connectivity to Gemini API and Gmail SMTP using backend/.env."""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / 'backend' / '.env'
    if not env_path.exists():
        raise SystemExit(f'Missing env file: {env_path}')

    env = load_env(env_path)
    gemini_key = env.get('GEMINI_API_KEY', '')
    smtp_user = env.get('SMTP_USER', '')
    smtp_pass = env.get('SMTP_PASSWORD', '')
    model = env.get('GEMINI_MODEL', 'gemini-1.5-pro')

    print('=== CONFIG SUMMARY ===')
    print(f'GEMINI_MODEL: {model}')
    print(f'GEMINI key prefix: {gemini_key[:8]}... len={len(gemini_key)}')
    print(f'SMTP_USER: {smtp_user}')
    print(f'SMTP_PASSWORD len: {len(smtp_pass)}')

    print('\n=== TEST: GEMINI API ===')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    payload = {'contents': [{'role': 'user', 'parts': [{'text': 'Say OK'}]}]}
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(url, json=payload, headers={'x-goog-api-key': gemini_key})
        print(f'HTTP status: {resp.status_code}')
        print(f'Response sample: {resp.text[:300]}')
    except Exception as exc:  # noqa: BLE001
        print(f'Gemini transport error: {exc}')

    print('\n=== TEST: GMAIL SMTP ===')
    try:
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            print('SMTP login: SUCCESS')

            msg = MIMEMultipart('alternative')
            msg['From'] = smtp_user
            msg['To'] = smtp_user
            msg['Subject'] = 'HealthMind AI - SMTP connectivity test'
            msg.attach(MIMEText('If you received this, SMTP sending works.\n', 'plain'))
            server.sendmail(smtp_user, [smtp_user], msg.as_string())
            print('SMTP send: SUCCESS')
    except Exception as exc:  # noqa: BLE001
        print(f'SMTP error: {exc}')


if __name__ == '__main__':
    main()
