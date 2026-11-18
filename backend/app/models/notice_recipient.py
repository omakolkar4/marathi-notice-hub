"""
Notice Recipient Database Model
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class RecipientSelectionSource(str, enum.Enum):
    NLP_SUGGESTION = "nlp_suggestion"
    ADMIN_SELECTION = "admin_selection"
    SCHOOL_WIDE = "school_wide"
    DEPARTMENT = "department"


class DeliveryStatus(str, enum.Enum):
    QUEUED = "queued"
    DELIVERED = "delivered"
    FAILED = "failed"


class NoticeRecipient(Base):
    __tablename__ = "notice_recipients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    notice_id = Column(Integer, ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    selection_source = Column(String(50), nullable=False, default=RecipientSelectionSource.ADMIN_SELECTION.value)
    delivery_status = Column(String(30), nullable=False, default=DeliveryStatus.DELIVERED.value)

    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)

    is_acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('notice_id', 'recipient_id', name='uq_notice_recipient'),
    )

    # Relationships
    notice = relationship("Notice", back_populates="recipients")
    recipient = relationship("User", back_populates="received_notices")

    def __repr__(self) -> str:
        return f"<NoticeRecipient notice_id={self.notice_id} recipient_id={self.recipient_id} read={self.is_read}>"
