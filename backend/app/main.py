"""
Marathi Notice Hub - Main FastAPI Application
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application Name: Marathi Notice Hub
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
import app.models  # noqa: F401 - ensures all SQLAlchemy models are registered
from app.api.v1.api import api_router

# Auto-create tables for local development / testing
Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join("data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description=f"Backend API and NLP Services for {settings.PROJECT_TITLE}",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for notice attachments
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include v1 API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "app_name": settings.APP_NAME,
        "project": settings.PROJECT_TITLE,
        "version": "1.0.0",
        "status": "online",
        "phase": "Phase 7 — Production & Academic Demonstration",
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "disabled in production"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }
