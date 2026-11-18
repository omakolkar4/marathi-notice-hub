"""
Application Configuration
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application Name: Marathi Notice Hub
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


# Workspace Root Directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

    APP_NAME: str = "Marathi Notice Hub"
    PROJECT_TITLE: str = "Marathi NLP-Based Intelligent Notice Management System"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("APP_ENV", "development")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "marathi-notice-hub-insecure-dev-secret-key-change-in-prod-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    # Production: PostgreSQL (e.g. postgresql+psycopg2://user:password@localhost:5432/marathi_notice_hub)
    # Local development fallback: SQLite inside designated workspace
    DEFAULT_SQLITE_PATH: str = str(PROJECT_ROOT / "marathi_notice_hub.db")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DEFAULT_SQLITE_PATH}"
    )

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS")
        if raw:
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return self.BACKEND_CORS_ORIGINS

    # NLP Policy Settings
    NLP_CONFIDENCE_THRESHOLD: float = 0.30
    REQUIRE_ADMIN_APPROVAL_FOR_FACULTY_NOTICES: bool = True


settings = Settings()
