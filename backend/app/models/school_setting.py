"""
School Setting Database Model
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base


class SchoolSetting(Base):
    __tablename__ = "school_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    school_name = Column(String(255), nullable=False, default="महाराष्ट्र विद्यालय व कनिष्ठ महाविद्यालय (Maharashtra Vidyalaya & Junior College)")
    school_code = Column(String(50), nullable=True, default="MV-PUNE-01")
    address = Column(Text, nullable=True, default="पुणे, महाराष्ट्र (Pune, Maharashtra)")
    contact_email = Column(String(100), nullable=True, default="contact@maharashtravidyalaya.edu.in")
    contact_phone = Column(String(30), nullable=True, default="+91 20 2550 0000")
    principal_name = Column(String(100), nullable=True, default="मा. प्राचार्य (Principal)")
    logo_url = Column(String(255), nullable=True)
    academic_year = Column(String(20), nullable=True, default="2026-2027")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SchoolSetting id={self.id} name='{self.school_name}'>"
