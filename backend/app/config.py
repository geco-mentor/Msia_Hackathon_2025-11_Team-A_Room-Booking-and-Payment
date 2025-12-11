"""Configuration settings for the booking agent backend."""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App settings
    APP_NAME: str = "Infinity8 Booking Agent"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # API settings
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # Service role key for backend operations
    SUPABASE_JWT_SECRET: str = ""  # For JWT validation (optional)

    # Stripe
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""

    # Resend (email)
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = ""

    # Email / SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Service timeouts
    DB_TIMEOUT_SECONDS: int = 15  # Increased from 10 to handle Supabase connection issues

    class Config:
        # Prefer ENV_FILE override, otherwise pick backend/.env when running from repo root,
        # and fall back to .env in the current working directory.
        _env_file_override = os.getenv("ENV_FILE")
        if _env_file_override:
            env_file = _env_file_override
        elif os.path.exists("backend/.env"):
            env_file = "backend/.env"
        else:
            env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
