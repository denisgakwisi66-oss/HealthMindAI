from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.api.dependencies.rate_limit import rate_limit
from app.core.audit import log_audit
from app.core.config import settings
from app.core.exceptions import ApiException, NotFoundError, ServiceUnavailableError
from app.models.ai import AIConversation, AIMessage
from app.models.user import User
from app.services.ai import ask_gemini, stream_gemini

router = APIRouter(prefix='/api/ai', tags=['ai-assistant'])

MAX_HISTORY = 50  # context window in messages sent to the provider
GEMINI_LIVE_TOKEN_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens'
GEMINI_LIVE_WEBSOCKET_URL = (
    'wss://generativelanguage.googleapis.com/ws/'
    'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'
)
GEMINI_LIVE_INSTRUCTIONS = (
    'You are HealthMind AI, a supportive health information assistant, not a doctor. '
    'Never diagnose or replace a clinician. Give clear, cautious general health information '
    'and encourage professional care for personal medical decisions. Automatically detect '
    'whether the user is speaking English, French, or Kinyarwanda and respond naturally in '
    'that language. If the user may be experiencing an emergency, immediately tell them to '
    'seek urgent medical attention and call their local emergency services; if they are in '
    'Rwanda, tell them to call 112. Do not delay escalation with questions or routine advice. '
    'You can use app tools to show the signed-in user their appointments, available doctors '
    'and slots, medications, and medical-record titles. To book an appointment, collect the '
    'doctor, date, and available time, then request the book_appointment tool; the app will '
    'ask the user to confirm before anything is booked. To add medication, only record a '
    'medicine, dosage, and schedule that the user says was prescribed by their clinician; '
    'never recommend, prescribe, infer, or change a medicine or dosage. The app will show '
    'the exact medication details and require confirmation before saving. If details are '
    'missing, ask the user rather than guessing. Use cancel_appointment for cancellations; '
    'rescheduling means separately confirming the cancellation and the new booking. For '
    'medication reminders, guide the user to the medication page and never imply a reminder '
    'was scheduled unless the app confirms it.'
)

GEMINI_LIVE_TOOLS = [
    {
        'functionDeclarations': [
            {
                'name': 'list_appointments',
                'description': 'List the signed-in user’s appointments.',
                'parameters': {'type': 'OBJECT', 'properties': {}},
            },
            {
                'name': 'find_doctors',
                'description': 'Find doctors currently accepting new patients, optionally filtered by specialty.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {'specialty': {'type': 'STRING', 'description': 'Optional medical specialty.'}},
                },
            },
            {
                'name': 'get_available_slots',
                'description': 'Get appointment times that are actually available for one doctor on a date.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'doctor_id': {'type': 'STRING'},
                        'date': {'type': 'STRING', 'description': 'Date as YYYY-MM-DD.'},
                    },
                    'required': ['doctor_id', 'date'],
                },
            },
            {
                'name': 'book_appointment',
                'description': 'Request an appointment booking. The app requires explicit user confirmation before it is created.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'doctor_id': {'type': 'STRING'},
                        'date': {'type': 'STRING', 'description': 'Date as YYYY-MM-DD.'},
                        'time': {'type': 'STRING', 'description': 'Time as 24-hour HH:MM, chosen from available slots.'},
                        'specialty': {'type': 'STRING'},
                        'notes': {'type': 'STRING', 'description': 'Optional reason for the visit.'},
                    },
                    'required': ['doctor_id', 'date', 'time'],
                },
            },
            {
                'name': 'cancel_appointment',
                'description': 'Request cancellation of one of the user’s appointments. The app requires explicit confirmation.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'appointment_id': {'type': 'INTEGER'},
                        'reason': {'type': 'STRING'},
                    },
                    'required': ['appointment_id'],
                },
            },
            {
                'name': 'list_medications',
                'description': 'List medications on the signed-in user’s medication tracker.',
                'parameters': {'type': 'OBJECT', 'properties': {}},
            },
            {
                'name': 'add_prescribed_medication',
                'description': 'Request saving a medication only when the user says it was prescribed by a clinician; never suggest a medicine or dosage. The app requires user confirmation.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'name': {'type': 'STRING'},
                        'dosage': {'type': 'STRING'},
                        'frequency': {'type': 'STRING'},
                        'schedule': {'type': 'STRING', 'description': 'Optional schedule, e.g. 09:00.'},
                        'instructions': {'type': 'STRING'},
                        'start_date': {'type': 'STRING', 'description': 'Optional date as YYYY-MM-DD.'},
                        'end_date': {'type': 'STRING', 'description': 'Optional date as YYYY-MM-DD.'},
                    },
                    'required': ['name', 'dosage', 'frequency'],
                },
            },
            {
                'name': 'list_medical_records',
                'description': 'List the signed-in user’s medical-record titles and types, without file contents.',
                'parameters': {'type': 'OBJECT', 'properties': {}},
            },
            {
                'name': 'open_app_section',
                'description': 'Give the user a link to the relevant HealthMind app section.',
                'parameters': {
                    'type': 'OBJECT',
                    'properties': {
                        'section': {
                            'type': 'STRING',
                            'enum': ['appointments', 'medications', 'records', 'doctors', 'emergency', 'settings'],
                        },
                    },
                    'required': ['section'],
                },
            },
        ],
    },
]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: int | None = None
    context: str | None = None


@router.post(
    '/gemini/live-token',
    dependencies=[Depends(rate_limit(settings.rate_limit_ai_per_minute))],
)
async def create_gemini_live_token(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Mint a short-lived, single-use token for a browser Gemini Live session."""
    if not settings.ai_available:
        raise ServiceUnavailableError(
            'Gemini Live voice is not configured. You can still use text chat.'
        )

    now = datetime.now(timezone.utc)
    session_config = {
        'tools': GEMINI_LIVE_TOOLS,
        'systemInstruction': {'parts': [{'text': GEMINI_LIVE_INSTRUCTIONS}]},
        'inputAudioTranscription': {},
        'outputAudioTranscription': {},
        'sessionResumption': {},
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
                'voiceConfig': {
                    'prebuiltVoiceConfig': {'voiceName': 'Aoede'},
                },
            },
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                GEMINI_LIVE_TOKEN_URL,
                headers={
                    'x-goog-api-key': settings.gemini_api_key.get_secret_value(),
                    'Content-Type': 'application/json',
                },
                json={
                    'uses': 1,
                    'expireTime': (now + timedelta(minutes=30)).isoformat().replace('+00:00', 'Z'),
                    'newSessionExpireTime': (now + timedelta(minutes=1)).isoformat().replace('+00:00', 'Z'),
                    'bidiGenerateContentSetup': {
                        'model': f'models/{settings.gemini_live_model}',
                        **session_config,
                    },
                },
            )
    except httpx.HTTPError as exc:
        logger.exception('Gemini Live token request failed for user %s', current_user.id)
        raise ServiceUnavailableError(
            'Gemini Live voice is temporarily unavailable. Please try again or use text chat.'
        ) from exc

    if response.is_error:
        logger.error('Gemini Live token request failed with HTTP {}.', response.status_code)
        raise ServiceUnavailableError(
            'Gemini Live could not create a voice session. Please try again or use text chat.'
        )

    try:
        token = response.json().get('name')
    except (ValueError, AttributeError):
        token = None
    if not isinstance(token, str) or not token:
        logger.error('Gemini Live token endpoint returned an invalid response.')
        raise ServiceUnavailableError(
            'Gemini Live returned an invalid session token. Please use text chat.'
        )

    return {
        'token': token,
        'model': settings.gemini_live_model,
        'websocket_url': GEMINI_LIVE_WEBSOCKET_URL,
        'config': session_config,
    }


class RegenerateRequest(BaseModel):
    conversation_id: int
    message_id: int


class TitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ActionRequest(BaseModel):
    action: str
    data: Any = None
    confirmation: bool = False


def _conv_dict(c: AIConversation) -> dict[str, Any]:
    return {
        'id': c.id,
        'title': c.title,
        'created_at': c.created_at.isoformat() + 'Z' if c.created_at else None,
        'updated_at': c.updated_at.isoformat() + 'Z' if c.updated_at else None,
    }


def _msg_dict(m: AIMessage) -> dict[str, Any]:
    return {
        'id': m.id,
        'conversation_id': m.conversation_id,
        'role': m.role,
        'content': m.content,
        'timestamp': m.created_at.isoformat() + 'Z' if m.created_at else None,
    }


async def _get_conversation(db: AsyncSession, conversation_id: int, user_id: int) -> AIConversation:
    result = await db.execute(select(AIConversation).where(AIConversation.id == conversation_id, AIConversation.user_id == user_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise NotFoundError('Conversation not found.')
    return conversation


async def _history(db: AsyncSession, conversation_id: int) -> list[dict]:
    rows = (await db.execute(
        select(AIMessage).where(AIMessage.conversation_id == conversation_id).order_by(AIMessage.created_at.asc())
    )).scalars().all()
    return [{'role': m.role, 'content': m.content} for m in rows][-MAX_HISTORY:]


@router.get('/conversations')
async def list_conversations(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    rows = (await db.execute(
        select(AIConversation).where(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.updated_at.desc()).offset(offset).limit(limit)
    )).scalars().all()
    return {'conversations': [_conv_dict(c) for c in rows]}




@router.get('/conversations/search')
async def search_conversations(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (await db.execute(
        select(AIConversation).where(
            AIConversation.user_id == current_user.id,
            AIConversation.title.ilike(f'%{q}%'),
        ).order_by(AIConversation.updated_at.desc()).limit(20)
    )).scalars().all()
    return {'conversations': [_conv_dict(c) for c in rows]}


@router.get('/conversations/{conversation_id}')
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    conversation = await _get_conversation(db, conversation_id, current_user.id)
    messages = (await db.execute(
        select(AIMessage).where(AIMessage.conversation_id == conversation_id).order_by(AIMessage.created_at.asc())
    )).scalars().all()
    return {'id': conversation.id, 'title': conversation.title, 'messages': [_msg_dict(m) for m in messages]}

@router.put('/conversations/{conversation_id}/title')
async def rename_conversation(
    conversation_id: int,
    payload: TitleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    conversation = await _get_conversation(db, conversation_id, current_user.id)
    conversation.title = payload.title.strip() or 'New conversation'
    await db.commit()
    return {'message': 'Conversation title updated.'}


@router.delete('/conversations/{conversation_id}')
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    conversation = await _get_conversation(db, conversation_id, current_user.id)
    await db.delete(conversation)
    await db.commit()
    return {'message': 'Conversation deleted.'}


@router.post('/chat', dependencies=[Depends(rate_limit(settings.rate_limit_ai_per_minute))])
async def chat_ai(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    conversation_id = payload.conversation_id
    if conversation_id is None:
        conversation = AIConversation(user_id=current_user.id, title=payload.message[:60])
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        conversation_id = conversation.id
    else:
        await _get_conversation(db, conversation_id, current_user.id)

    db.add(AIMessage(conversation_id=conversation_id, role='user', content=payload.message))
    history = await _history(db, conversation_id)

    try:
        response_text = await ask_gemini(history)
    except RuntimeError as exc:
        await db.commit()  # persist the user message
        raise ApiException('AI_UNAVAILABLE', str(exc))

    db.add(AIMessage(conversation_id=conversation_id, role='assistant', content=response_text))
    await db.execute(
        update(AIConversation).where(AIConversation.id == conversation_id).values(updated_at=datetime.utcnow())
    )
    await db.commit()
    await log_audit(db, action='ai.chat', user_id=current_user.id,
                    resource_type='conversation', resource_id=conversation_id, request=request)
    return {'conversation_id': conversation_id, 'response': response_text}


@router.post('/chat/stream')
async def chat_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> StreamingResponse:
    conversation_id = payload.conversation_id
    if conversation_id is None:
        conversation = AIConversation(user_id=current_user.id, title=payload.message[:60])
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        conversation_id = conversation.id
    else:
        await _get_conversation(db, conversation_id, current_user.id)

    db.add(AIMessage(conversation_id=conversation_id, role='user', content=payload.message))
    history = await _history(db, conversation_id)

    income_placeholder = AIMessage(conversation_id=conversation_id, role='assistant', content='')
    db.add(income_placeholder)
    await db.commit()
    await db.refresh(income_placeholder)

    async def event_stream() -> AsyncIterator[str]:
        full = ''
        try:
            async for chunk in stream_gemini(history):
                full += chunk
                yield f'data: {json.dumps({"content": chunk})}\n\n'
        except RuntimeError as exc:
            yield f'data: {json.dumps({"error": str(exc)})}\n\n'
        finally:
            # Persist the assistant message with whatever streamed in.
            income_placeholder.content = full or 'I could not generate a response. Please try again.'
            await db.execute(
                update(AIConversation).where(AIConversation.id == conversation_id).values(updated_at=datetime.utcnow())
            )
            await db.commit()
            await log_audit(db, action='ai.chat.stream', user_id=current_user.id,
                            resource_type='conversation', resource_id=conversation_id, request=request)
            yield 'data: [DONE]\n\n'

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@router.post('/regenerate')
async def regenerate_ai(
    payload: RegenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, Any]:
    conversation = await _get_conversation(db, payload.conversation_id, current_user.id)
    result = await db.execute(select(AIMessage).where(
        AIMessage.id == payload.message_id,
        AIMessage.conversation_id == payload.conversation_id,
    ))
    target = result.scalar_one_or_none()
    if not target or target.role != 'assistant':
        raise NotFoundError('Message not found.')

    # Regenerate: drop the target + later messages, re-ask with remaining history.
    await db.execute(
        AIMessage.__table__.delete().where(
            AIMessage.conversation_id == payload.conversation_id,
            AIMessage.id >= payload.message_id,
        )
    )
    history = await _history(db, payload.conversation_id)
    try:
        response_text = await ask_gemini(history)
    except RuntimeError as exc:
        await db.commit()
        raise ApiException('AI_UNAVAILABLE', str(exc))

    db.add(AIMessage(conversation_id=payload.conversation_id, role='assistant', content=response_text))
    await db.execute(
        update(AIConversation).where(AIConversation.id == conversation.id).values(updated_at=datetime.utcnow())
    )
    await db.commit()
    await log_audit(db, action='ai.regenerate', user_id=current_user.id,
                    resource_type='conversation', resource_id=payload.conversation_id, request=request)
    return {'conversation_id': payload.conversation_id, 'message_id': payload.message_id, 'response': response_text}


@router.get('/suggestions')
async def ai_suggestions(context: str | None = None) -> dict[str, Any]:
    suggestions = [
        'Book a follow-up appointment',
        'Ask about medication interactions',
        'Request a summary of your last visit',
        'What should I do if symptoms get worse at night?',
    ]
    return {'suggestions': suggestions}


@router.post('/actions')
async def ai_actions(
    payload: ActionRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """AI-requested actions.

    Only safe, general actions are allowed; anything that would mutate clinical
    data is deliberately rejected here so the AI can never trigger side effects
    without explicit user action in the UI.
    """
    action = (payload.action or '').strip().lower()
    safe = {
        'open_appointments': {'message': 'Open the Appointments page to book or manage your appointments.', 'target': '/appointments.html'},
        'open_medications': {'message': 'Open the Medications page to review your medications.', 'target': '/medications.html'},
        'open_emergency': {'message': 'Open the Emergency page.', 'target': '/emergency.html'},
        'open_records': {'message': 'Open the Medical Records page.', 'target': '/medical-records.html'},
        'reminder': {'message': 'You can enable reminders from the Settings page.', 'target': '/settings.html'},
    }
    if action in safe:
        return {'action': payload.action, 'status': 'completed', 'message': safe[action]['message'], 'target': safe[action]['target']}
    if payload.confirmation:
        return {'action': payload.action, 'status': 'requires_manual_action',
                'message': 'This action needs to be completed from the app pages for your safety. I did not make any changes.'}
    return {'action': payload.action, 'status': 'completed',
            'message': 'I can help guide you. For sensitive actions, please use the relevant page in the app so I never make changes without your explicit action.'}
