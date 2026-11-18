"""
API v1 Router Aggregator
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.admins import router as admins_router
from app.api.v1.departments import router as departments_router
from app.api.v1.notices import router as notices_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.examinations import router as examinations_router
from app.api.v1.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(admins_router)
api_router.include_router(departments_router)
api_router.include_router(notices_router)
api_router.include_router(audit_logs_router)
api_router.include_router(examinations_router)
api_router.include_router(settings_router)
