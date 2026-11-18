"""
Pydantic Schemas Package
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from app.schemas.token import Token, TokenPayload
from app.schemas.department import (
    DepartmentBase,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse
)
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserPasswordChange,
    UserResponse
)
from app.schemas.nlp_analysis import NLPAnalysisResponse
from app.schemas.notice_recipient import (
    NoticeRecipientResponse,
    NoticeApprovalCreate,
    NoticeApprovalResponse
)
from app.schemas.notice import (
    NoticeBase,
    NoticeCreate,
    NoticeUpdate,
    NoticeDistributionRequest,
    NoticeResponse,
    NoticeDetailResponse
)
from app.schemas.audit_log import AuditLogResponse
from app.schemas.examination import (
    ExaminationCreate,
    ExaminationUpdate,
    ExaminationResponse,
    ExaminationDetailResponse,
    DutyAssignmentCreate,
    DutyAssignmentResponse,
    QRTokenGenerateRequest,
    QRCheckInTokenResponse,
    FacultyCheckInRequest,
    FacultyCheckInResponse,
    CheckInCorrectionRequest,
    LateWarningResponse,
    ExaminationIncidentReportResponse,
    IncidentReviewRequest,
    ExaminationAttendanceReportItem,
)

__all__ = [
    "Token",
    "TokenPayload",
    "DepartmentBase",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserPasswordChange",
    "UserResponse",
    "NLPAnalysisResponse",
    "NoticeRecipientResponse",
    "NoticeApprovalCreate",
    "NoticeApprovalResponse",
    "NoticeBase",
    "NoticeCreate",
    "NoticeUpdate",
    "NoticeDistributionRequest",
    "NoticeResponse",
    "NoticeDetailResponse",
    "AuditLogResponse",
    "ExaminationCreate",
    "ExaminationUpdate",
    "ExaminationResponse",
    "ExaminationDetailResponse",
    "DutyAssignmentCreate",
    "DutyAssignmentResponse",
    "QRTokenGenerateRequest",
    "QRCheckInTokenResponse",
    "FacultyCheckInRequest",
    "FacultyCheckInResponse",
    "CheckInCorrectionRequest",
    "LateWarningResponse",
    "ExaminationIncidentReportResponse",
    "IncidentReviewRequest",
    "ExaminationAttendanceReportItem",
]
