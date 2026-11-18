"""
User Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict

from app.schemas.department import DepartmentResponse


class UserBase(BaseModel):
    name: str
    username: str
    email: EmailStr
    department_id: Optional[int] = None
    subject: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: str = "Faculty"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    department_id: Optional[int] = None
    subject: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role: str
    department_id: Optional[int] = None
    department: Optional[DepartmentResponse] = None
    subject: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_principal: bool = False
    permissions: Optional[List[str]] = None
    preferred_language: str = "mr"
    theme_preference: str = "light"
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Admin Management & Privileged Accounts Schemas
# ============================================================================

class AdminCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    password: str
    designation: Optional[str] = "Trustee"
    phone: Optional[str] = None
    permissions: List[str] = ["exam_management", "notice_management", "reports_access"]
    is_principal: bool = False


class AdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class PrincipalTransferRequest(BaseModel):
    new_principal_user_id: int
    confirmation_phrase: str  # Must match "TRANSFER_PRINCIPAL"
    reason: str
    former_principal_permissions: Optional[List[str]] = None
