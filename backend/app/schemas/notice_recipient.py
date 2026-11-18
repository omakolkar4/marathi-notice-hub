"""
Notice Recipient and Approval Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserResponse


class NoticeRecipientResponse(BaseModel):
    id: int
    notice_id: int
    recipient_id: int
    selection_source: str
    delivery_status: str
    is_read: bool
    read_at: Optional[datetime] = None
    is_acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    recipient: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class NoticeApprovalCreate(BaseModel):
    decision: str  # "approved", "rejected", "returned"
    comment: Optional[str] = None


class NoticeApprovalResponse(BaseModel):
    id: int
    notice_id: int
    reviewer_id: int
    decision: str
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
