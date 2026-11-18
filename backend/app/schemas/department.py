"""
Department Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class FacultyMemberSummary(BaseModel):
    id: int
    name: str
    username: str
    email: str
    subject: Optional[str] = None
    designation: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class DepartmentResponse(DepartmentBase):
    id: int
    head_id: Optional[int] = None
    head_name: Optional[str] = None
    faculty_count: int = 0
    active_faculty_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentDetailResponse(DepartmentResponse):
    faculty: List[FacultyMemberSummary] = []
    notices_count: int = 0
    recent_notices: List[Dict[str, Any]] = []
    recent_activities: List[Dict[str, Any]] = []


class DepartmentAssignHead(BaseModel):
    head_user_id: Optional[int] = None
