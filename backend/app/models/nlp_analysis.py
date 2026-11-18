"""
NLP Analysis Database Model
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class NLPAnalysis(Base):
    __tablename__ = "nlp_analyses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    notice_id = Column(Integer, ForeignKey("notices.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    normalized_text = Column(Text, nullable=False)
    predicted_category = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)

    extracted_entities = Column(JSON, nullable=False)
    suggested_recipients = Column(JSON, nullable=False)
    recipient_explanation = Column(Text, nullable=True)

    review_required = Column(Boolean, default=False, nullable=False)
    review_reasons = Column(JSON, nullable=True)
    model_version = Column(String(50), default="0.1.0-tfidf-logreg", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    notice = relationship("Notice", back_populates="nlp_analysis")

    def __repr__(self) -> str:
        return f"<NLPAnalysis id={self.id} notice_id={self.notice_id} category='{self.predicted_category}' review={self.review_required}>"
