# -*- coding: utf-8 -*-
"""Probe current Gemini 3.x models for the key in .env."""
import httpx

env = {}
with open(r'c:\Users\hp\Downloads\Healthcaresector\backend\.env', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
key = env['GEMINI_API_KEY']

candidates = [
    'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash',
    'gemini-3.5-flash-lite', 'gemini-3-flash-preview',
    'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite',
]

out = open(r'c:\Users\hp\Downloads\Healthcaresector\model_probe2_out.txt', 'w', encoding='utf-8')
for model in candidates:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    payload = {'contents': [{'role': 'user', 'parts': [{'text': 'Reply with just: OK'}]}]}
    try:
        resp = httpx.post(url, json=payload, headers={'x-goog-api-key': key}, timeout=40)
        ok = resp.status_code == 200
        text = ''
        if ok:
            try:
                for cand in resp.json().get('candidates', []):
                    for part in cand.get('content', {}).get('parts', []):
                        text += part.get('text', '')
            except Exception:
                pass
        line = f'{model}: {resp.status_code}' + (f' -> {text.strip()[:60]!r}' if ok else f' -> {resp.text[:140]}')
        out.write(line + '\n')
    except Exception as e:
        out.write(f'{model}: ERROR {str(e)[:140]}\n')
    out.flush()
out.close()