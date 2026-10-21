from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

import httpx
from loguru import logger

from app.core.config import settings
from app.core.exceptions import NotFoundError, ServiceUnavailableError


def _safe_object_name(object_name: str) -> str:
    if not object_name or Path(object_name).name != object_name or object_name in {'.', '..'}:
        raise ValueError('Invalid medical record object name.')
    return object_name


def _supabase_object_url(object_name: str) -> str:
    bucket = quote(settings.supabase_storage_bucket, safe='')
    object_path = quote(_safe_object_name(object_name), safe='')
    return f'{settings.supabase_url.rstrip("/")}/storage/v1/object/{bucket}/{object_path}'


def _supabase_headers(content_type: str = 'application/octet-stream') -> dict[str, str]:
    key = settings.supabase_service_role_key.get_secret_value()
    return {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': content_type,
    }


async def store_medical_record(
    object_name: str,
    content: bytes,
    content_type: str | None = None,
) -> None:
    object_name = _safe_object_name(object_name)
    if settings.medical_records_storage_provider == 'local':
        storage_dir = Path(settings.storage_dir)
        storage_dir.mkdir(parents=True, exist_ok=True)
        (storage_dir / object_name).write_bytes(content)
        return

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                _supabase_object_url(object_name),
                content=content,
                headers={
                    **_supabase_headers(content_type or 'application/octet-stream'),
                    'x-upsert': 'false',
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error('Supabase medical-record upload failed: {}', type(exc).__name__)
        raise ServiceUnavailableError(
            'Medical record storage is temporarily unavailable.'
        ) from exc


async def load_medical_record(object_name: str) -> bytes:
    object_name = _safe_object_name(object_name)
    if settings.medical_records_storage_provider == 'local':
        file_path = Path(settings.storage_dir) / object_name
        if not file_path.is_file():
            raise NotFoundError('File missing on server.')
        return file_path.read_bytes()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                _supabase_object_url(object_name),
                headers=_supabase_headers(),
            )
            if response.status_code == 404:
                raise NotFoundError('File missing in medical record storage.')
            response.raise_for_status()
            return response.content
    except httpx.HTTPError as exc:
        logger.error('Supabase medical-record download failed: {}', type(exc).__name__)
        raise ServiceUnavailableError(
            'Medical record storage is temporarily unavailable.'
        ) from exc


async def delete_medical_record(object_name: str) -> None:
    object_name = _safe_object_name(object_name)
    if settings.medical_records_storage_provider == 'local':
        file_path = Path(settings.storage_dir) / object_name
        if file_path.is_file():
            file_path.unlink()
        return

    bucket = quote(settings.supabase_storage_bucket, safe='')
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(
                f'{settings.supabase_url.rstrip("/")}/storage/v1/object/{bucket}',
                headers=_supabase_headers('application/json'),
                json={'prefixes': [object_name]},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error('Supabase medical-record deletion failed: {}', type(exc).__name__)
        raise ServiceUnavailableError(
            'Medical record storage is temporarily unavailable.'
        ) from exc
