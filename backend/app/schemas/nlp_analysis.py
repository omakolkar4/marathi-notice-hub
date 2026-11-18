"""
NLP Analysis Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, ConfigDict


class NLPAnalysisResponse(BaseModel):
    id: int
    notice_id: int
    normalized_text: str
    predicted_category: str
    confidence: float
    extracted_entities: Dict[str, Any]
    suggested_recipients: List[Dict[str, Any]]
    recipient_explanation: Optional[str] = None
    review_required: bool
    review_reasons: Optional[List[str]] = None
    model_version: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
