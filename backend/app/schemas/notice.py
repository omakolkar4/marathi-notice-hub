"""
Notice Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserResponse
from app.schemas.department import DepartmentResponse
from app.schemas.nlp_analysis import NLPAnalysisResponse
from app.schemas.notice_recipient import NoticeRecipientResponse, NoticeApprovalResponse
from app.schemas.audit_log import AuditLogResponse


class NoticeBase(BaseModel):
    title: str
    original_text: str
    attachment_url: Optional[str] = None
    priority: str = "normal"
    target_audience: Optional[str] = None
    target_department_id: Optional[int] = None
    target_subject: Optional[str] = None
    notice_language: Optional[str] = "mr"
    source_organization: Optional[str] = None
    source_date: Optional[str] = None


class NoticeCreate(NoticeBase):
    source_type: Optional[str] = "faculty_submitted"


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    original_text: Optional[str] = None
    attachment_url: Optional[str] = None
    priority: Optional[str] = None
    target_audience: Optional[str] = None
    target_department_id: Optional[int] = None
    target_subject: Optional[str] = None
    notice_language: Optional[str] = None
    source_organization: Optional[str] = None
    source_date: Optional[str] = None


class NoticeDistributionRequest(BaseModel):
    target_audience: str  # "all_faculty", "department", "subject", "selected_faculty"
    department_id: Optional[int] = None
    subject: Optional[str] = None
    faculty_ids: Optional[List[int]] = None


class NoticeResponse(NoticeBase):
    id: int
    creator_id: int
    source_type: str
    predicted_category: Optional[str] = None
    approval_status: str
    distribution_status: str
    created_at: datetime
    updated_at: datetime
    is_read: Optional[bool] = None
    is_acknowledged: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class NoticeDetailResponse(NoticeResponse):
    creator: Optional[UserResponse] = None
    target_department: Optional[DepartmentResponse] = None
    nlp_analysis: Optional[NLPAnalysisResponse] = None
    approvals: List[NoticeApprovalResponse] = []
    recipient_count: int = 0
    read_count: int = 0
    acknowledged_count: int = 0
    recipients: List[NoticeRecipientResponse] = []
    audit_logs: List[AuditLogResponse] = []

    model_config = ConfigDict(from_attributes=True)
