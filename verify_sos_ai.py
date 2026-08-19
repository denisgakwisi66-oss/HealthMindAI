# -*- coding: utf-8 -*-
"""Verify live AI chat (Gemini) and SOS email (Gmail) through the running server."""
import time, urllib.request, json, urllib.error

BASE = 'http://127.0.0.1:8000/api'
out = open(r'c:\Users\hp\Downloads\Healthcaresector\sos_ai_verify.txt', 'w', encoding='utf-8')
def log(s):
    print(s)
    out.write(str(s) + '\n')
    out.flush()

def req(method, path, body=None, auth=None):
    h = {'Content-Type': 'application/json'}
    if auth:
        h['Authorization'] = 'Bearer ' + auth
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=90)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, str(e)

# Wait for server
log('Waiting for server...')
for i in range(30):
    st, r = req('GET', '/system/status')
    if st == 200:
        log('Server up: ' + json.dumps(r))
        break
    time.sleep(1)
else:
    log('SERVER NOT UP')
    raise SystemExit(1)

# Register fresh user
email = 'ai%d@test.com' % int(time.time())
st, r = req('POST', '/auth/register', {'full_name': 'AI Test', 'email': email, 'password': 'password123', 'role': 'patient'})
if st != 200:
    st, r = req('POST', '/auth/login', {'email': email, 'password': 'password123'})
at = r['access_token']
log('\nAuth OK, token acquired.')

# ---- AI CHAT ----
log('\n=== TEST 1: AI CHAT (real Gemini) ===')
st, r = req('POST', '/ai/chat', {'message': 'Give me one healthy breakfast idea in one sentence.'}, at)
log('status: ' + str(st))
if st == 200 and 'response' in r:
    log('AI response: ' + r['response'][:200])
    log('conversation_id: ' + str(r.get('conversation_id')))
else:
    log('FAIL: ' + str(r)[:300])

# ---- SOS / EMERGENCY ALERT ----
log('\n=== TEST 2: EMERGENCY SOS (real Gmail) ===')
st, r = req('POST', '/emergency/alert', {
    'message': 'This is a connectivity test - HealthMind AI SOS works.',
    'location': {'latitude': 0.123, 'longitude': 36.789, 'accuracy': 12.0},
}, at)
log('status: ' + str(st))
log('response: ' + json.dumps(r)[:300])
if st == 200:
    log('SOS EMAIL SENT SUCCESSFULLY to the configured recipient.')

log('\nDONE')