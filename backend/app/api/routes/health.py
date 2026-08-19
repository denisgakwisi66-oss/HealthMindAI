from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=['health'])


@router.get('/health', summary='Health check')
async def health_check() -> dict:
    return {'status': 'ok', 'version': settings.app_version}
