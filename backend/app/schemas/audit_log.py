"""
Audit Log Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserResponse


class AuditLogResponse(BaseModel):
    id: int
    notice_id: Optional[int] = None
    user_id: Optional[int] = None
    action: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
