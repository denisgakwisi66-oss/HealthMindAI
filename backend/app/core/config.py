from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr
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
    app_secret_key: SecretStr
    app_debug: bool = Field(True)

    database_url: str
    database_pool_size: int = Field(10)
    database_max_overflow: int = Field(20)
    database_pool_timeout: int = Field(30)

    redis_url: str
    redis_db: int = Field(0)

    jwt_secret_key: SecretStr
    jwt_access_expire_minutes: int = Field(30)
    jwt_refresh_expire_days: int = Field(7)
    jwt_algorithm: str = Field('HS256')

    gemini_api_key: SecretStr
    gemini_model: str = Field('gemini-1.5-pro')
    gemini_max_tokens: int = Field(2048)
    gemini_temperature: float = Field(0.7)

    frontend_origins: str = Field('http://localhost:8000')

    rate_limit_per_minute: int = Field(60)
    rate_limit_login_per_minute: int = Field(5)
    rate_limit_ai_per_minute: int = Field(20)
    rate_limit_emergency_per_minute: int = Field(3)

    celery_broker_url: str = Field('redis://redis:6379/1')
    celery_result_backend: str = Field('redis://redis:6379/2')

    log_level: str = Field('INFO')
    log_json: bool = Field(False)

    bcrypt_rounds: int = Field(12)

    default_page_size: int = Field(20)
    max_page_size: int = Field(100)

    smtp_host: str = Field('smtp.gmail.com')
    smtp_port: int = Field(587)
    smtp_user: SecretStr = Field(SecretStr(''))
    smtp_password: SecretStr = Field(SecretStr(''))
    smtp_from: str = Field('no-reply@healthmind.ai')
    use_tls: bool = Field(True)

    # Where in-app / email notifications for system-wide emergency alerts go.
    # MUST come from the environment, never be hard-coded in source.
    emergency_recipient: str = Field('')

    # Public URL of the application, used to build links inside emails.
    frontend_url: str = Field('http://localhost:8000')

    # Filesystem directory in which uploaded medical-record files are stored.
    storage_dir: str = Field('./storage/medical_records')
    max_upload_size_mb: int = Field(10)

    # On/off switches so the app degrades gracefully when an external service
    # (email provider, AI provider) is unavailable rather than failing hard.
    email_notifications_enabled: bool = Field(True)
    ai_provider_enabled: bool = Field(True)

    # Path to the Firebase service account JSON (optional; used only for push).
    firebase_credentials: str = Field('')

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_publishable_key: str | None = None

    @property
    def smtp_configured(self) -> bool:
        user = self.smtp_user.get_secret_value()
        password = self.smtp_password.get_secret_value()
        return bool(user and password and user != 'your_email@gmail.com' and password != 'your_app_password')

    @property
    def ai_available(self) -> bool:
        return bool(self.gemini_api_key.get_secret_value()) and self.ai_provider_enabled


settings = Settings()
