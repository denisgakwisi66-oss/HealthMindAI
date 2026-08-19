#!/usr/bin/env python3
"""Probe candidate Gemini models for the key configured in backend/.env."""

from __future__ import annotations

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

    key = load_env(env_path).get('GEMINI_API_KEY', '')
    if not key:
        raise SystemExit('GEMINI_API_KEY is missing in backend/.env')

    candidates = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash-lite',
    ]

    payload = {'contents': [{'role': 'user', 'parts': [{'text': 'Reply with just: OK'}]}]}
    for model in candidates:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
        try:
            resp = httpx.post(url, json=payload, headers={'x-goog-api-key': key}, timeout=40)
            if resp.status_code == 200:
                text = ''
                for cand in resp.json().get('candidates', []):
                    for part in cand.get('content', {}).get('parts', []):
                        text += part.get('text', '')
                print(f"{model}: {resp.status_code} -> {text.strip()[:60]!r}")
            else:
                print(f'{model}: {resp.status_code} -> {resp.text[:120]}')
        except Exception as exc:  # noqa: BLE001
            print(f'{model}: ERROR {str(exc)[:120]}')


if __name__ == '__main__':
    main()
