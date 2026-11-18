"""
Notice Approval Database Model
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ApprovalDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"


class NoticeApproval(Base):
    __tablename__ = "notice_approvals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    notice_id = Column(Integer, ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    decision = Column(String(30), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    notice = relationship("Notice", back_populates="approvals")
    reviewer = relationship("User", back_populates="approvals_given")

    def __repr__(self) -> str:
        return f"<NoticeApproval id={self.id} notice_id={self.notice_id} decision='{self.decision}'>"
