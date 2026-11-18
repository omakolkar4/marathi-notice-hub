"""
Centralized Settings and User Profile API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.school_setting import SchoolSetting
from app.models.audit_log import AuditLog
from app.schemas.school_setting import (
    SchoolSettingResponse,
    SchoolSettingUpdate,
    ProfileUpdateRequest
)
from app.schemas.user import UserResponse
from app.api.deps import (
    get_current_user,
    require_permission
)

router = APIRouter(prefix="/settings", tags=["Application Settings & Profile Management"])


@router.get("/school", response_model=SchoolSettingResponse)
def get_school_settings(
    db: Session = Depends(get_db)
):
    """Retrieves school metadata (name, address, official contact email, phone, logo)."""
    setting = db.query(SchoolSetting).first()
    if not setting:
        setting = SchoolSetting(
            school_name="महाराष्ट्र विद्यालय व कनिष्ठ महाविद्यालय (Maharashtra Vidyalaya & Junior College)",
            school_code="MV-PUNE-01",
            address="पुणे, महाराष्ट्र (Pune, Maharashtra)",
            contact_email="contact@maharashtravidyalaya.edu.in",
            contact_phone="+91 20 2550 0000",
            principal_name="मा. प्राचार्य (Designated Principal)",
            academic_year="2026-2027"
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.put("/school", response_model=SchoolSettingResponse)
def update_school_settings(
    setting_in: SchoolSettingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("settings_management"))
):
    """
    Updates school details (name, code, address, email, phone, logo, academic year).
    Protected by 'settings_management' permission.
    """
    setting = db.query(SchoolSetting).first()
    if not setting:
        setting = SchoolSetting()
        db.add(setting)

    if setting_in.school_name is not None:
        setting.school_name = setting_in.school_name.strip()
    if setting_in.school_code is not None:
        setting.school_code = setting_in.school_code.strip()
    if setting_in.address is not None:
        setting.address = setting_in.address.strip()
    if setting_in.contact_email is not None:
        setting.contact_email = str(setting_in.contact_email).strip().lower()
    if setting_in.contact_phone is not None:
        setting.contact_phone = setting_in.contact_phone.strip()
    if setting_in.principal_name is not None:
        setting.principal_name = setting_in.principal_name.strip()
    if setting_in.logo_url is not None:
        setting.logo_url = setting_in.logo_url.strip()
    if setting_in.academic_year is not None:
        setting.academic_year = setting_in.academic_year.strip()

    setting.updated_at = datetime.utcnow()

    # Audit log
    audit = AuditLog(
        action="SCHOOL_SETTINGS_UPDATED",
        user_id=admin.id,
        details={
            "school_name": setting.school_name,
            "school_code": setting.school_code,
            "updated_by": admin.username
        },
        created_at=datetime.utcnow()
    )
    db.add(audit)

    db.commit()
    db.refresh(setting)
    return setting


@router.get("/profile", response_model=UserResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Retrieves profile information for the authenticated user."""
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_user_profile(
    profile_in: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates permitted profile fields for the authenticated user:
    Full name, email, phone, designation, preferred interface language, theme preference.
    """
    if profile_in.name is not None:
        current_user.name = profile_in.name.strip()

    if profile_in.email is not None:
        email_str = str(profile_in.email).strip().lower()
        existing = db.query(User).filter(User.email == email_str, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="This email address is already in use by another user.")
        current_user.email = email_str

    if profile_in.phone is not None:
        current_user.phone = profile_in.phone.strip()

    if profile_in.designation is not None:
        # Changing designation does not transfer principal or alter administrative permissions
        current_user.designation = profile_in.designation.strip()

    if profile_in.preferred_language is not None:
        lang = profile_in.preferred_language.strip().lower()
        if lang in ["mr", "en", "hi"]:
            current_user.preferred_language = lang

    if profile_in.theme_preference is not None:
        theme = profile_in.theme_preference.strip().lower()
        if theme in ["light", "dark"]:
            current_user.theme_preference = theme

    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user
