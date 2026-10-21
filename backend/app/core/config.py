from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding='utf-8',
        case_sensitive=False,
        env_prefix='',
        extra='ignore',
        populate_by_name=True,
    )

    app_env: str = Field('development')
    app_name: str = Field('HealthMind AI')
    app_version: str = Field('1.0.0')
    app_debug: bool = Field(True)
    render_service_id: str = Field('')

    database_url: str
    database_pool_size: int = Field(10)
    database_max_overflow: int = Field(20)
    database_pool_timeout: int = Field(30)

    redis_url: str
    redis_db: int = Field(0)

    # Supabase is the identity provider: Postgres lives on Supabase (via
    # database_url above) and Auth/session/password-reset are handled entirely
    # by Supabase, never by our own code. Session tokens are verified against
    # this project's published JWKS (app/core/security.py) — no local secret.
    supabase_url: str
    supabase_anon_key: SecretStr = Field(
        validation_alias=AliasChoices('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
    )
    supabase_service_role_key: SecretStr = Field(
        validation_alias=AliasChoices('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
    )
    supabase_jwks_url: str = Field('')

    gemini_api_key: SecretStr
    gemini_model: str = Field('gemini-3.6-flash')
    gemini_live_model: str = Field('gemini-3.8-live')
    gemini_max_tokens: int = Field(2048)
    gemini_temperature: float = Field(0.7)

    frontend_origins: str = Field(
        'http://localhost:8000,https://localhost,capacitor://localhost'
    )

    rate_limit_per_minute: int = Field(60)
    rate_limit_login_per_minute: int = Field(5)
    rate_limit_ai_per_minute: int = Field(20)
    rate_limit_emergency_per_minute: int = Field(3)

    celery_broker_url: str = Field('redis://redis:6379/1')
    celery_result_backend: str = Field('redis://redis:6379/2')

    log_level: str = Field('INFO')
    log_json: bool = Field(False)

    default_page_size: int = Field(20)
    max_page_size: int = Field(100)

    smtp_host: str = Field('smtp.gmail.com')

    smtp_port: int = Field(587)
    smtp_user: SecretStr = Field(SecretStr(''))
    smtp_password: SecretStr = Field(SecretStr(''))
    smtp_from: str = Field('no-reply@healthmind.ai')
    use_tls: bool = Field(True)

    # Where admin-facing notification emails go: emergency alerts, new
    # appointments, appointment status changes, new registrations. One
    # inbox for all operational notifications — MUST come from the
    # environment, never be hard-coded in source.
    emergency_recipient: str = Field('')

    # Public URL of the application, used to build links inside emails.
    frontend_url: str = Field('http://localhost:8000')

    # Filesystem directory in which uploaded medical-record files are stored.
    storage_dir: str = Field('./storage/medical_records')
    medical_records_storage_provider: Literal['local', 'supabase'] = Field('local')
    supabase_storage_bucket: str = Field('medical-records')
    max_upload_size_mb: int = Field(10)

    # On/off switches so the app degrades gracefully when an external service
    # (email provider, AI provider) is unavailable rather than failing hard.
    email_notifications_enabled: bool = Field(True)
    ai_provider_enabled: bool = Field(True)

    # Path to the Firebase service account JSON (optional; used only for push).
    firebase_credentials: str = Field('')

    # n8n Care Orchestrator — leave blank to disable outbound automation.
    # Example: https://n8n.example.com/webhook/healthmind-care
    n8n_webhook_url: str = Field('')
    # Shared secret for HMAC-SHA256 signatures (header X-HealthMind-Signature).
    n8n_webhook_secret: SecretStr = Field(SecretStr(''))

    @model_validator(mode='after')
    def require_durable_storage_in_production(self) -> 'Settings':
        if self.app_env.lower() in {'prod', 'production'} or self.render_service_id:
            if self.medical_records_storage_provider != 'supabase':
                raise ValueError(
                    'Production requires MEDICAL_RECORDS_STORAGE_PROVIDER=supabase.'
                )
            if not self.supabase_storage_bucket.strip():
                raise ValueError('SUPABASE_STORAGE_BUCKET must be configured in production.')
        return self

    @property
    def smtp_configured(self) -> bool:
        user = self.smtp_user.get_secret_value()
        password = self.smtp_password.get_secret_value()
        return bool(user and password and user != 'your_email@gmail.com' and password != 'your_app_password')

    @property
    def ai_available(self) -> bool:
        return bool(self.gemini_api_key.get_secret_value()) and self.ai_provider_enabled

    @staticmethod
    def _is_configured(value: str) -> bool:
        normalized = value.strip().lower()
        placeholders = ('example', 'your-project', 'replace-with', 'placeholder', 'change-me', 'changeme', '<')
        return bool(normalized) and not any(marker in normalized for marker in placeholders)

    @property
    def supabase_auth_configured(self) -> bool:
        return (
            self.supabase_url.startswith('https://')
            and self._is_configured(self.supabase_url)
            and self._is_configured(self.supabase_anon_key.get_secret_value())
        )

    @property
    def supabase_admin_configured(self) -> bool:
        return self.supabase_auth_configured and self._is_configured(
            self.supabase_service_role_key.get_secret_value()
        )

    @property
    def supabase_uses_new_api_keys(self) -> bool:
        return self.supabase_service_role_key.get_secret_value().startswith('sb_secret_')


settings = Settings()
