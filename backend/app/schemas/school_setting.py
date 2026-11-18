"""
School Setting Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr


class SchoolSettingBase(BaseModel):
    school_name: str
    school_code: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    principal_name: Optional[str] = None
    logo_url: Optional[str] = None
    academic_year: Optional[str] = None


class SchoolSettingUpdate(BaseModel):
    school_name: Optional[str] = None
    school_code: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    principal_name: Optional[str] = None
    logo_url: Optional[str] = None
    academic_year: Optional[str] = None


class SchoolSettingResponse(SchoolSettingBase):
    id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    preferred_language: Optional[str] = None  # "mr", "en", "hi"
    theme_preference: Optional[str] = None    # "light", "dark"
