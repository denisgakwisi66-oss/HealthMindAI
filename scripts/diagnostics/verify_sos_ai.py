#!/usr/bin/env python3
"""Verify live AI chat and emergency SOS endpoints against a running server."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request


BASE = 'http://127.0.0.1:8000/api'


def req(method: str, path: str, body: dict | None = None, auth: str | None = None):
    headers = {'Content-Type': 'application/json'}
    if auth:
        headers['Authorization'] = f'Bearer {auth}'
    data = json.dumps(body).encode() if body else None
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)

    try:
        resp = urllib.request.urlopen(request, timeout=90)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode())
        except Exception:  # noqa: BLE001
            return exc.code, {'error': 'non-json error response'}
    except Exception as exc:  # noqa: BLE001
        return 0, {'error': str(exc)}


def main() -> None:
    print('Waiting for server...')
    for _ in range(30):
        status, payload = req('GET', '/system/status')
        if status == 200:
            print(f'Server up: {payload}')
            break
        time.sleep(1)
    else:
        raise SystemExit('Server not reachable')

    email = f'ai{int(time.time())}@test.com'
    status, payload = req('POST', '/auth/register', {
        'full_name': 'AI Test',
        'email': email,
        'password': 'password123',
        'role': 'patient',
    })
    if status != 200:
        status, payload = req('POST', '/auth/login', {'email': email, 'password': 'password123'})
    token = payload['access_token']
    print('Auth OK')

    print('\n=== TEST 1: AI CHAT ===')
    status, payload = req('POST', '/ai/chat', {
        'message': 'Give me one healthy breakfast idea in one sentence.',
    }, token)
    print(f'status: {status}')
    print(f'response: {payload}')

    print('\n=== TEST 2: EMERGENCY SOS ===')
    status, payload = req('POST', '/emergency/alert', {
        'message': 'Connectivity test - HealthMind AI SOS works.',
        'location': {'latitude': 0.123, 'longitude': 36.789, 'accuracy': 12.0},
    }, token)
    print(f'status: {status}')
    print(f'response: {payload}')


if __name__ == '__main__':
    main()
