from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.status import HTTP_422_UNPROCESSABLE_CONTENT

from app.api.routes.health import router as health_router
from app.api.routes.system import router as system_router, config_router
from app.api.routes.auth import auth_router, users_router
from app.api.routes.appointments import router as appointments_router
from app.api.routes.emergency import router as emergency_router
from app.api.routes.medications import router as medications_router
from app.api.routes.medical_records import router as records_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.ai_assistant import router as ai_router
from app.api.routes.dashboards import router as dashboards_router
from app.api.routes.admin import router as admin_router
from app.api.routes.notify import router as notify_router
from app.core.config import settings
from app.core.exceptions import ApiException
from app.core.logging import configure_logging

# Import models so Alembic (and anything introspecting metadata) sees every
# table. Schema itself is owned by the Supabase SQL bootstrap + Alembic
# migrations, not created here — see backend/alembic/.
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
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
            "default-src 'self'; "
            f"script-src 'self' https://esm.sh https://cdn.jsdelivr.net https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https:; "
            f"connect-src 'self' {settings.supabase_url} https://esm.sh https://generativelanguage.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none'"
        )
        return response

    app.include_router(health_router, prefix='/api')
    app.include_router(system_router, prefix='/api')
    app.include_router(config_router, prefix='/api')
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
    app.include_router(notify_router)

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

