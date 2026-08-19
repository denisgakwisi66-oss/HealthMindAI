from __future__ import annotations

import asyncio
from typing import AsyncIterator

import httpx
from loguru import logger

from app.core.config import settings

GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent'

# Healthcare-specific safety controls are injected as a system preamble so the
# assistant behaves as a supportive ally, never as a replacement for a clinician.
SYSTEM_PROMPT = (
    "You are HealthMind AI, a supportive healthcare information assistant, not a "
    "doctor and not a substitute for professional medical care. Follow these rules "
    "strictly:\n"
    "1. Never claim to be a doctor or to provide a definitive diagnosis. If asked to "
    "   diagnose, say you cannot diagnose and recommend seeing a qualified clinician.\n"
    "2. YOU ARE NOT A DOCTOR. Never present clinical conclusions as fact.\n"
    "3. If the user describes potentially urgent or emergency symptoms (chest pain, "
    "   severe breathing difficulty, sudden numbness, severe bleeding, thoughts of "
    "   self-harm, etc.), immediately and clearly advise them to seek emergency "
    "   medical care / call local emergency services, and keep that guidance "
    "   prominent in your reply.\n"
    "4. Do not give specific drug dosages or encourage unsafe medication changes; "
    "   advise them to follow their prescriber's instructions and talk to a "
    "   pharmacist or doctor about interactions.\n"
    "5. Communicate uncertainty plainly (e.g. 'this is general information, not "
    "   medical advice').\n"
    "6. Do not claim to have access to the user's private medical records beyond "
    "   the minimal context the application supplies, and never discuss other "
    "   people's medical information.\n"
    "7. Keep answers clear, concise and helpful. General health information is "
    "   fine; clinical decisions belong to healthcare professionals.\n"
)


def _build_contents(messages: list[dict]) -> list[dict]:
    """Map our {role, content} history to Gemini contents.

    roles: 'user' -> 'user', 'assistant' -> 'model'.
    """
    contents = []
    for msg in messages:
        gemini_role = 'model' if msg.get('role') == 'assistant' else 'user'
        contents.append({'role': gemini_role, 'parts': [{'text': msg.get('content', '')}]})
    if not contents:
        contents = [{'role': 'user', 'parts': [{'text': 'Hello'}]}]
    return contents


def _extract_text(data: dict) -> str:
    """Extract concatenated text from a Gemini response payload."""
    text_parts: list[str] = []
    try:
        for candidate in data.get('candidates', []):
            for part in candidate.get('content', {}).get('parts', []):
                if 'text' in part:
                    text_parts.append(part['text'])
    except Exception:
        pass
    return ''.join(text_parts)


async def ask_gemini(messages: list[dict], max_tokens: int | None = None) -> str:
    """Send a message history to Gemini and return the assistant text.

    Raises a generic ``RuntimeError`` on transport/API failure so callers can
    surface a friendly message and log the reason server-side.
    """
    if not settings.ai_available:
        raise RuntimeError('The AI provider is not configured/unavailable.')

    contents = _build_contents(messages)
    payload = {
        'contents': contents,
        'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'generationConfig': {
            'maxOutputTokens': max_tokens or settings.gemini_max_tokens,
            'temperature': settings.gemini_temperature,
        },
    }
    url = GENERATE_URL.format(model=settings.gemini_model)
    headers = {'x-goog-api-key': settings.gemini_api_key.get_secret_value()}

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 429:
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                raise RuntimeError('The AI service is busy. Please try again shortly.')
            if resp.status_code >= 400:
                logger.error(f'Gemini API error {resp.status_code}: {resp.text[:300]}')
                raise RuntimeError('The AI service returned an error. Please try again.')
            data = resp.json()
            text = _extract_text(data)
            if not text:
                # Respect blocked/safety-filtered responses rather than faking one.
                raise RuntimeError('The AI could not generate a safe response. Please rephrase your question.')
            return text.strip()
        except httpx.HTTPError as exc:
            if attempt < 2:
                await asyncio.sleep(1.0 * (attempt + 1))
                continue
            logger.error(f'Gemini transport error: {exc}')
            raise RuntimeError('Could not reach the AI service. Please try again.') from exc
    raise RuntimeError('The AI service did not respond. Please try again.')


async def stream_gemini(messages: list[dict]) -> AsyncIterator[str]:
    """Stream Gemini output as text chunks (server-side)."""
    if not settings.ai_available:
        raise RuntimeError('The AI provider is not configured/unavailable.')

    contents = _build_contents(messages)
    payload = {
        'contents': contents,
        'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'generationConfig': {
            'maxOutputTokens': settings.gemini_max_tokens,
            'temperature': settings.gemini_temperature,
        },
    }
    url = f'{STREAM_URL.format(model=settings.gemini_model)}?alt=sse'
    headers = {'x-goog-api-key': settings.gemini_api_key.get_secret_value()}

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            async with client.stream('POST', url, json=payload, headers=headers) as resp:
                if resp.status_code >= 400:
                    logger.error(f'Gemini stream error {resp.status_code}')
                    raise RuntimeError('The AI service returned an error. Please try again.')
                full = ''
                import json
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith('data:'):
                        continue
                    data_str = line[len('data:'):].strip()
                    try:
                        data = json.loads(data_str)
                    except Exception:
                        continue
                    chunk = _extract_text(data)
                    if chunk:
                        full += chunk
                        yield chunk
                if not full:
                    raise RuntimeError('The AI could not generate a safe response. Please rephrase your question.')
        except httpx.HTTPError as exc:
            logger.error(f'Gemini stream transport error: {exc}')
            raise RuntimeError('Could not reach the AI service. Please try again.') from exc