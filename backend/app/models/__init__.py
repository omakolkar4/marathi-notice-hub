"""
Database Models Package
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from app.core.database import Base
from app.models.department import Department
from app.models.user import User, UserRole
from app.models.notice import (
    Notice,
    NoticeSourceType,
    NoticeApprovalStatus,
    NoticeDistributionStatus,
    NoticePriority
)
from app.models.nlp_analysis import NLPAnalysis
from app.models.notice_recipient import (
    NoticeRecipient,
    RecipientSelectionSource,
    DeliveryStatus
)
from app.models.notice_approval import NoticeApproval, ApprovalDecision
from app.models.audit_log import AuditLog
from app.models.examination import (
    Examination,
    ExaminationDuty,
    QRCheckInToken,
    FacultyCheckInRecord,
    LateWarningRecord,
    ExaminationIncidentReport,
    ExamStatus,
    DutyStatus,
    CheckInStatus,
    WarningStatus,
    IncidentStatus,
)
from app.models.school_setting import SchoolSetting

__all__ = [
    "Base",
    "Department",
    "User",
    "UserRole",
    "SchoolSetting",
    "Notice",
    "NoticeSourceType",
    "NoticeApprovalStatus",
    "NoticeDistributionStatus",
    "NoticePriority",
    "NLPAnalysis",
    "NoticeRecipient",
    "RecipientSelectionSource",
    "DeliveryStatus",
    "NoticeApproval",
    "ApprovalDecision",
    "AuditLog",
    "Examination",
    "ExaminationDuty",
    "QRCheckInToken",
    "FacultyCheckInRecord",
    "LateWarningRecord",
    "ExaminationIncidentReport",
    "ExamStatus",
    "DutyStatus",
    "CheckInStatus",
    "WarningStatus",
    "IncidentStatus",
]
