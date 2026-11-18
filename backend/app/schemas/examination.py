"""
Examination Management Pydantic Schemas
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
Phase 6: QR-Based Examination Management and Faculty Punctuality Tracking
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


# 1. Base Examination
class ExaminationBase(BaseModel):
    title: str
    exam_code: str
    exam_date: str  # YYYY-MM-DD
    reporting_time: str  # HH:MM
    collection_deadline: str  # HH:MM
    grace_period_minutes: int = 10
    location: str
    instructions: Optional[str] = None


class ExaminationCreate(ExaminationBase):
    pass


class ExaminationUpdate(BaseModel):
    title: Optional[str] = None
    exam_date: Optional[str] = None
    reporting_time: Optional[str] = None
    collection_deadline: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    location: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


# 2. QR Token Schemas
class QRTokenGenerateRequest(BaseModel):
    bucket_label: str
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class QRCheckInTokenResponse(BaseModel):
    id: int
    examination_id: int
    token: str
    bucket_label: str
    qr_svg_content: Optional[str] = None
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExaminationCancelRequest(BaseModel):
    reason: str = Field(..., description="Auditable cancellation reason")


class ExaminationResponse(ExaminationBase):
    id: int
    status: str
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    assigned_faculty_count: int = 0
    checked_in_count: int = 0
    late_count: int = 0
    qr_tokens_count: int = 0
    qr_tokens: List[QRCheckInTokenResponse] = []

    model_config = ConfigDict(from_attributes=True)


# 3. Duty Assignment Schemas
class DutyAssignmentCreate(BaseModel):
    faculty_id: int
    role_title: Optional[str] = "Exam Invigilator / Paper Collector"
    notes: Optional[str] = None


class DutyAssignmentResponse(BaseModel):
    id: int
    examination_id: int
    faculty_id: int
    role_title: str
    status: str
    notes: Optional[str] = None
    created_at: datetime
    faculty: Optional[UserResponse] = None
    examination: Optional[ExaminationResponse] = None

    model_config = ConfigDict(from_attributes=True)


# 4. Check-In & Warning Schemas
class FacultyCheckInRequest(BaseModel):
    token: str = Field(..., description="Scanned QR token string")


class LateWarningResponse(BaseModel):
    id: int
    faculty_id: int
    examination_id: int
    checkin_record_id: int
    warning_level: int
    minutes_late: int
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    examination: Optional[ExaminationResponse] = None
    faculty: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ExaminationIncidentReportResponse(BaseModel):
    id: int
    faculty_id: int
    examination_id: int
    trigger_checkin_id: int
    total_late_occurrences: int
    incident_summary: str
    status: str
    admin_remarks: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    faculty: Optional[UserResponse] = None
    examination: Optional[ExaminationResponse] = None
    reviewed_by: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class FacultyCheckInResponse(BaseModel):
    id: int
    examination_id: int
    duty_id: int
    faculty_id: int
    scanned_at: datetime
    scheduled_reporting_time: datetime
    is_late: bool
    minutes_late: int
    status: str
    correction_reason: Optional[str] = None
    corrected_at: Optional[datetime] = None
    created_at: datetime
    warning: Optional[LateWarningResponse] = None
    incident_report: Optional[ExaminationIncidentReportResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CheckInCorrectionRequest(BaseModel):
    status: str = Field(..., description="Target status: 'excused' or 'corrected'")
    reason: str = Field(..., description="Auditable administrative correction reason")


class IncidentReviewRequest(BaseModel):
    status: str = Field(..., description="'reviewed', 'resolved', or 'dismissed'")
    remarks: str = Field(..., description="Administrative review remarks or decision notes")


class ExaminationDetailResponse(ExaminationResponse):
    duties: List[DutyAssignmentResponse] = []
    qr_tokens: List[QRCheckInTokenResponse] = []
    checkins: List[FacultyCheckInResponse] = []
    incident_reports: List[ExaminationIncidentReportResponse] = []
    creator: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


# 5. Examination Attendance Report Item
class ExaminationAttendanceReportItem(BaseModel):
    examination_id: int
    exam_title: str
    exam_code: str
    exam_date: str
    reporting_time: str
    location: str
    faculty_id: int
    faculty_name: str
    department_name: Optional[str] = None
    role_title: str
    duty_status: str
    scanned_at: Optional[datetime] = None
    is_late: bool = False
    minutes_late: int = 0
    active_warnings_count: int = 0
    incident_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
