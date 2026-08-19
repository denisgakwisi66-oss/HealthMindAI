# -*- coding: utf-8 -*-
"""Test connectivity to Gemini API and Gmail SMTP using credentials from .env."""
import os
import re
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ---- Load .env manually ----
env = {}
with open(r'c:\Users\hp\Downloads\Healthcaresector\backend\.env', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
gemini_key = env.get('GEMINI_API_KEY', '')
smtp_user = env.get('SMTP_USER', '')
smtp_pass = env.get('SMTP_PASSWORD', '')
smtp_from = env.get('SMTP_FROM', '')
model = env.get('GEMINI_MODEL', 'gemini-1.5-pro')
recips = env.get('EMERGENCY_RECIPIENT', '')

out = open(r'c:\Users\hp\Downloads\Healthcaresector\connectivity_out.txt', 'w', encoding='utf-8')
def log(s):
    print(s)
    out.write(str(s) + '\n')

log('=== CONFIG SUMMARY ===')
log('GEMINI_MODEL: ' + model)
log('GEMINI key prefix: ' + gemini_key[:8] + '..., len=' + str(len(gemini_key)) + ' -> starts with AIza? ' + str(gemini_key.startswith('AIza')))
log('SMTP_USER: ' + smtp_user)
log('SMTP_PASSWORD (first 4 + last 4): ' + str(smtp_pass[:4] + '****' + smtp_pass[-4:] if smtp_pass else 'EMPTY') + ' len=' + str(len(smtp_pass)))
log('SMTP_FROM: ' + smtp_from)
log('EMERGENCY_RECIPIENT: ' + (recips if recips else '(MISSING)'))

# ---- Test 1: Gemini API ----
log('\n=== TEST: GEMINI API ===')
url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
payload = {'contents': [{'role': 'user', 'parts': [{'text': 'Say OK'}]}]}
try:
    with httpx.Client(timeout=30) as client:
        resp = client.post(url, json=payload, headers={'x-goog-api-key': gemini_key})
    log('HTTP status: ' + str(resp.status_code))
    body = resp.text[:500]
    log('Response: ' + body)
    if resp.status_code == 200:
        text = ''
        for cand in resp.json().get('candidates', []):
            for part in cand.get('content', {}).get('parts', []):
                text += part.get('text', '')
        log('Gemini text: ' + (text[:100] if text else '(empty)'))
except Exception as e:
    log('Gemini transport error: ' + str(e))

# ---- Test 2: Gmail SMTP ----
log('\n=== TEST: GMAIL SMTP ===')
try:
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        log('SMTP login: SUCCESS')
        # Build message - test a real send FROM the gmail address TO the same gmail
        msg = MIMEMultipart('alternative')
        msg['From'] = smtp_user          # Gmail requires From == auth user
        msg['To'] = smtp_user
        msg['Subject'] = 'HealthMind AI - SMTP connectivity test'
        msg.attach(MIMEText('If you received this, Gmail email sending works for HealthMind AI SOS alerts.\n', 'plain'))
        server.sendmail(smtp_user, [smtp_user], msg.as_string())
        log('SMTP send (FROM user -> TO user): SUCCESS')
except smtplib.SMTPAuthenticationError as e:
    log('SMTP login FAILED (auth): ' + str(e.smtp_error))
except smtplib.SMTPException as e:
    log('SMTP send FAILED: ' + str(e))
except Exception as e:
    log('SMTP error: ' + str(e))

out.close()
log('\nDONE')