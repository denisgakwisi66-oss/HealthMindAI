from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.requests import Request
from starlette.status import HTTP_422_UNPROCESSABLE_CONTENT

from app.api.routes.health import router as health_router
from app.api.routes.system import router as system_router
from app.api.routes.auth import auth_router, users_router
from app.api.routes.appointments import router as appointments_router
from app.api.routes.emergency import router as emergency_router
from app.api.routes.medications import router as medications_router
from app.api.routes.medical_records import router as records_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.ai_assistant import router as ai_router
from app.api.routes.dashboards import router as dashboards_router
from app.api.routes.admin import router as admin_router
from app.core.config import settings
from app.core.exceptions import ApiException
from app.core.logging import configure_logging

# Import models so metadata is populated before create_all runs.
from app.db.base import Base  # noqa: F401
from app.db.session import data_engine
import app.models  # noqa: F401  (imports every model into Base.metadata)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup when the database is reachable.

    Failures are logged as warnings so the server can still boot and serve
    the frontend and mock-data endpoints even when the DB is not configured.
    """
    try:
        async with data_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info('Database tables ensured (create_all)')
    except Exception as exc:
        logger.warning(
            f'Database is unavailable - auth endpoints will be offline until '
            f'DATABASE_URL is configured. ({type(exc).__name__}: {exc})'
        )
    yield


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title='HealthMind AI Backend',
        description='FastAPI backend for HealthMind AI frontend',
        version=settings.app_version,
        openapi_url='/api/openapi.json',
        docs_url='/api/docs',
        redoc_url='/api/redoc',
        lifespan=lifespan,
    )

    origins = [origin.strip() for origin in settings.frontend_origins.split(',') if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allow_headers=['*'],
    )

    @app.middleware('http')
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(self), camera=(), microphone=()'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; "
            "connect-src 'self' https://generativelanguage.googleapis.com; "
            "font-src 'self' data:; frame-ancestors 'none'"
        )
        return response

    app.include_router(health_router, prefix='/api')
    app.include_router(system_router, prefix='/api')
    app.include_router(auth_router, prefix='/api')
    app.include_router(users_router, prefix='/api')
    app.include_router(emergency_router)
    app.include_router(appointments_router)
    app.include_router(medications_router)
    app.include_router(records_router)
    app.include_router(notifications_router)
    app.include_router(ai_router)
    app.include_router(dashboards_router)
    app.include_router(admin_router)

    frontend_dir = Path(__file__).resolve().parents[2]
    app.mount('/', StaticFiles(directory=str(frontend_dir), html=True), name='frontend')

    return app


app = create_app()


@app.exception_handler(ApiException)
async def api_exception_handler(request: Request, exc: ApiException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    def _safe(value):
        if isinstance(value, BaseException):
            return str(value)
        if hasattr(value, 'isoformat'):
            return value.isoformat()
        return value

    details = []
    for err in exc.errors():
        details.append({
            'loc': err.get('loc'),
            'msg': err.get('msg'),
            'type': err.get('type'),
            'input': _safe(err.get('input')),
        })

    return JSONResponse(
        status_code=HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Validation failed for the request.',
                'details': details,
            }
        },
    )

