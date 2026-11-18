"""
Notice Database Model
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class NoticeSourceType(str, enum.Enum):
    FACULTY_SUBMITTED = "faculty_submitted"
    HIGHER_AUTHORITY = "higher_authority"
    MANAGEMENT = "management"


class NoticeApprovalStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"
    ARCHIVED = "archived"


class NoticeDistributionStatus(str, enum.Enum):
    PENDING = "pending"
    DISTRIBUTED = "distributed"


class NoticePriority(str, enum.Enum):
    NORMAL = "normal"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    original_text = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)

    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(String(50), nullable=False, default=NoticeSourceType.FACULTY_SUBMITTED.value)
    predicted_category = Column(String(50), nullable=True)

    approval_status = Column(String(30), nullable=False, default=NoticeApprovalStatus.DRAFT.value)
    distribution_status = Column(String(30), nullable=False, default=NoticeDistributionStatus.PENDING.value)
    priority = Column(String(20), nullable=False, default=NoticePriority.NORMAL.value)

    target_audience = Column(String(50), nullable=True)
    target_department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    target_subject = Column(String(100), nullable=True)

    notice_language = Column(String(10), default="mr", nullable=False)
    source_organization = Column(String(255), nullable=True)
    source_date = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", back_populates="created_notices")
    target_department = relationship("Department", back_populates="notices")
    nlp_analysis = relationship("NLPAnalysis", back_populates="notice", uselist=False, cascade="all, delete-orphan")
    recipients = relationship("NoticeRecipient", back_populates="notice", cascade="all, delete-orphan")
    approvals = relationship("NoticeApproval", back_populates="notice", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="notice", cascade="all, delete-orphan")

    @property
    def recipient_count(self) -> int:
        return len(self.recipients) if self.recipients else 0

    @property
    def read_count(self) -> int:
        return sum(1 for r in self.recipients if r.is_read) if self.recipients else 0

    @property
    def acknowledged_count(self) -> int:
        return sum(1 for r in self.recipients if r.is_acknowledged) if self.recipients else 0

    def __repr__(self) -> str:
        return f"<Notice id={self.id} title='{self.title[:30]}' status='{self.approval_status}'>"
