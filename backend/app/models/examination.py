"""
Examination Management Database Models
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
Phase 6: QR-Based Examination Management and Faculty Punctuality Tracking
"""

from datetime import datetime
import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ExamStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DutyStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    CHECKED_IN = "checked_in"
    LATE = "late"
    ABSENT = "absent"
    EXCUSED = "excused"


class CheckInStatus(str, enum.Enum):
    ON_TIME = "on_time"
    LATE = "late"
    EXCUSED = "excused"
    CORRECTED = "corrected"


class WarningStatus(str, enum.Enum):
    ACTIVE = "active"
    EXCUSED = "excused"
    DISMISSED = "dismissed"


class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWED = "reviewed"
    EXCUSED = "excused"
    RESOLVED = "resolved"


class Examination(Base):
    """Represents a scheduled examination session (date, reporting time, location, collection instructions)."""
    __tablename__ = "examinations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    exam_code = Column(String(50), unique=True, index=True, nullable=False)
    exam_date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    reporting_time = Column(String(10), nullable=False)          # HH:MM (24-hour)
    collection_deadline = Column(String(10), nullable=False)     # HH:MM (24-hour)
    grace_period_minutes = Column(Integer, default=10, nullable=False)
    location = Column(String(255), nullable=False)
    instructions = Column(Text, nullable=True)
    status = Column(String(30), default=ExamStatus.SCHEDULED.value, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by_id])
    duties = relationship("ExaminationDuty", back_populates="examination", cascade="all, delete-orphan")
    qr_tokens = relationship("QRCheckInToken", back_populates="examination", cascade="all, delete-orphan")
    checkins = relationship("FacultyCheckInRecord", back_populates="examination", cascade="all, delete-orphan")
    incident_reports = relationship("ExaminationIncidentReport", back_populates="examination", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Examination id={self.id} code='{self.exam_code}' date='{self.exam_date}'>"


class ExaminationDuty(Base):
    """Faculty duty assignment for an examination session."""
    __tablename__ = "examination_duties"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    examination_id = Column(Integer, ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_title = Column(String(100), default="Exam Invigilator", nullable=False)
    status = Column(String(30), default=DutyStatus.ASSIGNED.value, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("examination_id", "faculty_id", name="uq_exam_faculty_duty"),
    )

    # Relationships
    examination = relationship("Examination", back_populates="duties")
    faculty = relationship("User", foreign_keys=[faculty_id])
    checkin_record = relationship("FacultyCheckInRecord", back_populates="duty", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ExaminationDuty id={self.id} exam_id={self.examination_id} faculty_id={self.faculty_id} status='{self.status}'>"


class QRCheckInToken(Base):
    """Secure, unique QR token associated with an examination paper or bucket collection point."""
    __tablename__ = "qr_checkin_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    examination_id = Column(Integer, ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(128), unique=True, index=True, nullable=False)
    bucket_label = Column(String(100), nullable=False)
    qr_svg_content = Column(Text, nullable=True)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    examination = relationship("Examination", back_populates="qr_tokens")
    checkins = relationship("FacultyCheckInRecord", back_populates="qr_token")

    def __repr__(self) -> str:
        return f"<QRCheckInToken id={self.id} exam_id={self.examination_id} bucket='{self.bucket_label}'>"


class FacultyCheckInRecord(Base):
    """Server-timestamped check-in record when faculty scans QR bucket token."""
    __tablename__ = "faculty_checkin_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    examination_id = Column(Integer, ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    duty_id = Column(Integer, ForeignKey("examination_duties.id", ondelete="CASCADE"), unique=True, nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    qr_token_id = Column(Integer, ForeignKey("qr_checkin_tokens.id", ondelete="SET NULL"), nullable=True)

    scanned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    scheduled_reporting_time = Column(DateTime, nullable=False)
    is_late = Column(Boolean, default=False, nullable=False)
    minutes_late = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default=CheckInStatus.ON_TIME.value, nullable=False)

    correction_reason = Column(Text, nullable=True)
    corrected_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    corrected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    examination = relationship("Examination", back_populates="checkins")
    duty = relationship("ExaminationDuty", back_populates="checkin_record")
    faculty = relationship("User", foreign_keys=[faculty_id])
    qr_token = relationship("QRCheckInToken", back_populates="checkins")
    corrected_by = relationship("User", foreign_keys=[corrected_by_id])
    warning = relationship("LateWarningRecord", back_populates="checkin_record", uselist=False, cascade="all, delete-orphan")
    incident_report = relationship("ExaminationIncidentReport", back_populates="trigger_checkin", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<FacultyCheckInRecord id={self.id} duty_id={self.duty_id} is_late={self.is_late} minutes={self.minutes_late}>"


class LateWarningRecord(Base):
    """Tracks Warning 1 and Warning 2 issued for late arrivals."""
    __tablename__ = "late_warning_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    examination_id = Column(Integer, ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_record_id = Column(Integer, ForeignKey("faculty_checkin_records.id", ondelete="CASCADE"), unique=True, nullable=False)

    warning_level = Column(Integer, nullable=False)  # 1 or 2
    minutes_late = Column(Integer, nullable=False)
    status = Column(String(30), default=WarningStatus.ACTIVE.value, nullable=False)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    faculty = relationship("User", foreign_keys=[faculty_id])
    examination = relationship("Examination")
    checkin_record = relationship("FacultyCheckInRecord", back_populates="warning")

    def __repr__(self) -> str:
        return f"<LateWarningRecord id={self.id} faculty_id={self.faculty_id} level={self.warning_level} status='{self.status}'>"


class ExaminationIncidentReport(Base):
    """Formal incident report generated automatically upon the 3rd verified late occurrence."""
    __tablename__ = "examination_incident_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    examination_id = Column(Integer, ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_checkin_id = Column(Integer, ForeignKey("faculty_checkin_records.id", ondelete="CASCADE"), unique=True, nullable=False)

    total_late_occurrences = Column(Integer, nullable=False)
    incident_summary = Column(Text, nullable=False)
    status = Column(String(30), default=IncidentStatus.OPEN.value, nullable=False)
    admin_remarks = Column(Text, nullable=True)

    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    faculty = relationship("User", foreign_keys=[faculty_id])
    examination = relationship("Examination", back_populates="incident_reports")
    trigger_checkin = relationship("FacultyCheckInRecord", back_populates="incident_report")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

    def __repr__(self) -> str:
        return f"<ExaminationIncidentReport id={self.id} faculty_id={self.faculty_id} status='{self.status}'>"
