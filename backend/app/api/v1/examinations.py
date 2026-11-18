"""
Examination Management, QR Check-In, and Punctuality Tracking API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
Phase 6: QR-Based Examination Management and Faculty Punctuality Tracking
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.user import User, UserRole
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
    IncidentStatus
)
from app.schemas.examination import (
    ExaminationCreate,
    ExaminationUpdate,
    ExaminationCancelRequest,
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
    ExaminationAttendanceReportItem
)
from app.api.deps import (
    get_current_user,
    get_current_active_admin,
    get_current_active_faculty
)
from app.services.qr_service import qr_service

router = APIRouter(prefix="/examinations", tags=["Examination Management & QR Tracking"])


def log_exam_audit(
    db: Session,
    action: str,
    user_id: Optional[int],
    details: Optional[Dict[str, Any]] = None,
    notice_id: Optional[int] = None
):
    """Utility to persist an immutable examination audit event in AuditLog."""
    audit = AuditLog(
        action=action,
        user_id=user_id,
        notice_id=notice_id,
        details=details or {},
        created_at=datetime.utcnow()
    )
    db.add(audit)


# ===========================================================================
# 1. Fixed Sub-paths (MUST be declared before /{examination_id})
# ===========================================================================

@router.get("/my-duties", response_model=List[DutyAssignmentResponse])
def get_my_examination_duties(
    db: Session = Depends(get_db),
    faculty: User = Depends(get_current_active_faculty)
):
    """Faculty: Retrieves examination duties assigned to the authenticated user."""
    duties = db.query(ExaminationDuty).filter(
        ExaminationDuty.faculty_id == faculty.id
    ).order_by(ExaminationDuty.created_at.desc()).all()
    return duties


@router.get("/my-warnings", response_model=Dict[str, Any])
def get_my_warnings_and_incidents(
    db: Session = Depends(get_db),
    faculty: User = Depends(get_current_active_faculty)
):
    """Faculty: Retrieves their personal warning records and incident reports."""
    warnings = db.query(LateWarningRecord).filter(
        LateWarningRecord.faculty_id == faculty.id
    ).order_by(LateWarningRecord.created_at.desc()).all()

    incidents = db.query(ExaminationIncidentReport).filter(
        ExaminationIncidentReport.faculty_id == faculty.id
    ).order_by(ExaminationIncidentReport.created_at.desc()).all()

    return {
        "active_warning_count": sum(1 for w in warnings if w.status == WarningStatus.ACTIVE.value),
        "warnings": [LateWarningResponse.model_validate(w) for w in warnings],
        "incidents": [ExaminationIncidentReportResponse.model_validate(i) for i in incidents]
    }


@router.post("/scan-checkin", response_model=FacultyCheckInResponse)
def scan_examination_qr(
    scan_req: FacultyCheckInRequest,
    db: Session = Depends(get_db),
    faculty: User = Depends(get_current_active_faculty)
):
    """
    Faculty QR Check-In:
    1. Validates the QR token authenticity and validity window.
    2. Validates faculty is assigned to the examination duty.
    3. Prevents duplicate check-in.
    4. Evaluates punctuality using server-side time vs. scheduled reporting time + grace period.
    5. Issues Warning 1 on first late occurrence, Warning 2 on second, and automatically generates an
       Incident Report on the third verified late occurrence for authorized Admin review.
    """
    raw_token = scan_req.token.strip()
    now_utc = datetime.utcnow()

    # 1. Validate QR Token
    qr_token = db.query(QRCheckInToken).filter(QRCheckInToken.token == raw_token).first()
    if not qr_token:
        log_exam_audit(
            db,
            "EXAM_CHECKIN_INVALID_TOKEN",
            faculty.id,
            {"reason": "Token does not exist"}
        )
        raise HTTPException(status_code=400, detail="Invalid QR code. The scanned QR token was not found.")

    if not qr_token.is_active:
        raise HTTPException(status_code=400, detail="This QR code has been deactivated by the administrator.")

    exam = qr_token.examination
    if not exam or exam.status == ExamStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="The examination associated with this QR code has been cancelled.")

    # 2. Verify Faculty Duty Assignment
    duty = db.query(ExaminationDuty).filter(
        ExaminationDuty.examination_id == exam.id,
        ExaminationDuty.faculty_id == faculty.id
    ).first()

    if not duty:
        log_exam_audit(
            db,
            "EXAM_CHECKIN_UNAUTHORIZED_DUTY",
            faculty.id,
            {"examination_id": exam.id, "exam_code": exam.exam_code}
        )
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: You are not assigned to this examination duty."
        )

    # 3. Check Validity Window (with 1 hour buffer around window)
    if now_utc < (qr_token.valid_from - timedelta(hours=1)) or now_utc > (qr_token.valid_until + timedelta(hours=2)):
        raise HTTPException(
            status_code=400,
            detail="This QR code has expired or is not yet valid for today's session."
        )

    # 4. Prevent Duplicate Check-In
    existing_checkin = db.query(FacultyCheckInRecord).filter(
        FacultyCheckInRecord.duty_id == duty.id
    ).first()
    if existing_checkin or duty.status in [DutyStatus.CHECKED_IN.value, DutyStatus.LATE.value, DutyStatus.EXCUSED.value]:
        raise HTTPException(
            status_code=400,
            detail="Check-in has already been recorded for this examination duty. Duplicate scan prevented."
        )

    # 5. Compute Punctuality vs Server Time
    try:
        scheduled_reporting_dt = datetime.strptime(
            f"{exam.exam_date.strip()} {exam.reporting_time.strip()}",
            "%Y-%m-%d %H:%M"
        )
    except Exception:
        scheduled_reporting_dt = now_utc

    grace_deadline = scheduled_reporting_dt + timedelta(minutes=exam.grace_period_minutes)

    is_late = False
    minutes_late = 0

    if now_utc > grace_deadline:
        is_late = True
        minutes_late = max(1, int((now_utc - grace_deadline).total_seconds() / 60))
        checkin_status = CheckInStatus.LATE.value
        duty.status = DutyStatus.LATE.value
    else:
        is_late = False
        minutes_late = 0
        checkin_status = CheckInStatus.ON_TIME.value
        duty.status = DutyStatus.CHECKED_IN.value

    # Create Check-In Record
    checkin_record = FacultyCheckInRecord(
        examination_id=exam.id,
        duty_id=duty.id,
        faculty_id=faculty.id,
        qr_token_id=qr_token.id,
        scanned_at=now_utc,
        scheduled_reporting_time=scheduled_reporting_dt,
        is_late=is_late,
        minutes_late=minutes_late,
        status=checkin_status
    )
    db.add(checkin_record)
    db.flush()

    warning_record = None
    incident_report = None

    # 6. Late-Arrival Policy: Warning 1, Warning 2, or Incident Report (3rd Occurrence)
    if is_late:
        active_warnings_count = db.query(LateWarningRecord).filter(
            LateWarningRecord.faculty_id == faculty.id,
            LateWarningRecord.status == WarningStatus.ACTIVE.value
        ).count()

        if active_warnings_count == 0:
            warning_record = LateWarningRecord(
                faculty_id=faculty.id,
                examination_id=exam.id,
                checkin_record_id=checkin_record.id,
                warning_level=1,
                minutes_late=minutes_late,
                status=WarningStatus.ACTIVE.value,
                admin_notes=f"Warning 1 issued: Arrived {minutes_late} minutes past permitted grace period."
            )
            db.add(warning_record)
            log_exam_audit(
                db,
                "EXAM_WARNING_1_ISSUED",
                faculty.id,
                {"checkin_id": checkin_record.id, "minutes_late": minutes_late, "exam_code": exam.exam_code}
            )

        elif active_warnings_count == 1:
            warning_record = LateWarningRecord(
                faculty_id=faculty.id,
                examination_id=exam.id,
                checkin_record_id=checkin_record.id,
                warning_level=2,
                minutes_late=minutes_late,
                status=WarningStatus.ACTIVE.value,
                admin_notes=f"Warning 2 issued: Repeated late arrival of {minutes_late} minutes past permitted grace period."
            )
            db.add(warning_record)
            log_exam_audit(
                db,
                "EXAM_WARNING_2_ISSUED",
                faculty.id,
                {"checkin_id": checkin_record.id, "minutes_late": minutes_late, "exam_code": exam.exam_code}
            )

        else:
            total_late_count = active_warnings_count + 1
            incident_summary = (
                f"Faculty member {faculty.name} ({faculty.username}) has accumulated {total_late_count} "
                f"verified late arrivals for examination duties. Latest late arrival: {minutes_late} minutes "
                f"for exam '{exam.title}' ({exam.exam_code}) on {exam.exam_date}. Formal incident report "
                f"generated for administrative review."
            )

            incident_report = ExaminationIncidentReport(
                faculty_id=faculty.id,
                examination_id=exam.id,
                trigger_checkin_id=checkin_record.id,
                total_late_occurrences=total_late_count,
                incident_summary=incident_summary,
                status=IncidentStatus.OPEN.value,
                admin_remarks=None
            )
            db.add(incident_report)
            log_exam_audit(
                db,
                "EXAM_INCIDENT_REPORT_GENERATED",
                faculty.id,
                {"checkin_id": checkin_record.id, "total_late": total_late_count, "exam_code": exam.exam_code}
            )
    else:
        log_exam_audit(
            db,
            "EXAM_CHECKIN_ON_TIME",
            faculty.id,
            {"checkin_id": checkin_record.id, "exam_code": exam.exam_code}
        )

    db.commit()
    db.refresh(checkin_record)
    return checkin_record


@router.post("/checkins/{checkin_id}/correct", response_model=FacultyCheckInResponse)
def correct_checkin_record(
    checkin_id: int,
    correction: CheckInCorrectionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Corrects or excuses a check-in record through an auditable administrative action.
    Updates the check-in status, associated duty status, and any linked warning or incident report.
    """
    checkin = db.query(FacultyCheckInRecord).filter(FacultyCheckInRecord.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found.")

    target_status = correction.status.strip().lower()
    if target_status not in [CheckInStatus.EXCUSED.value, CheckInStatus.CORRECTED.value]:
        raise HTTPException(status_code=400, detail="Target status must be 'excused' or 'corrected'.")

    previous_status = checkin.status
    checkin.status = target_status
    checkin.correction_reason = correction.reason.strip()
    checkin.corrected_by_id = admin.id
    checkin.corrected_at = datetime.utcnow()

    if checkin.duty:
        checkin.duty.status = DutyStatus.EXCUSED.value if target_status == "excused" else DutyStatus.CHECKED_IN.value

    if checkin.warning:
        checkin.warning.status = WarningStatus.EXCUSED.value
        checkin.warning.admin_notes = f"Excused by Admin {admin.username}: {correction.reason.strip()}"

    if checkin.incident_report:
        checkin.incident_report.status = IncidentStatus.EXCUSED.value
        checkin.incident_report.admin_remarks = f"Excused by Admin {admin.username}: {correction.reason.strip()}"
        checkin.incident_report.reviewed_by_id = admin.id
        checkin.incident_report.reviewed_at = datetime.utcnow()

    log_exam_audit(
        db,
        "EXAM_CHECKIN_CORRECTED",
        admin.id,
        {
            "checkin_id": checkin.id,
            "previous_status": previous_status,
            "new_status": target_status,
            "reason": correction.reason.strip()
        }
    )

    db.commit()
    db.refresh(checkin)
    return checkin


@router.get("/incidents", response_model=List[ExaminationIncidentReportResponse])
def list_incident_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Lists all examination incident reports across the school."""
    query = db.query(ExaminationIncidentReport)
    if status_filter:
        query = query.filter(ExaminationIncidentReport.status == status_filter.strip())
    return query.order_by(ExaminationIncidentReport.created_at.desc()).all()


@router.post("/incidents/{incident_id}/review", response_model=ExaminationIncidentReportResponse)
def review_incident_report(
    incident_id: int,
    review_req: IncidentReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Reviews and resolves or dismisses an incident report with management notes."""
    incident = db.query(ExaminationIncidentReport).filter(ExaminationIncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident report not found.")

    valid_statuses = [IncidentStatus.REVIEWED.value, IncidentStatus.RESOLVED.value, "dismissed", IncidentStatus.EXCUSED.value]
    if review_req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    incident.status = review_req.status
    incident.admin_remarks = review_req.remarks.strip()
    incident.reviewed_by_id = admin.id
    incident.reviewed_at = datetime.utcnow()

    log_exam_audit(
        db,
        "EXAM_INCIDENT_REVIEWED",
        admin.id,
        {
            "incident_id": incident.id,
            "new_status": incident.status,
            "remarks": incident.admin_remarks
        }
    )

    db.commit()
    db.refresh(incident)
    return incident


@router.get("/warnings", response_model=List[LateWarningResponse])
def list_all_warnings(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Lists all late warnings issued across faculty."""
    return db.query(LateWarningRecord).order_by(LateWarningRecord.created_at.desc()).all()


@router.get("/attendance-report", response_model=List[ExaminationAttendanceReportItem])
def get_examination_attendance_report(
    examination_id: Optional[int] = Query(None, description="Optional filter by specific exam ID"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Comprehensive report on examination attendance, punctuality, and incident status.
    """
    query = db.query(ExaminationDuty).join(
        Examination, ExaminationDuty.examination_id == Examination.id
    ).join(
        User, ExaminationDuty.faculty_id == User.id
    )

    if examination_id:
        query = query.filter(ExaminationDuty.examination_id == examination_id)

    duties = query.all()
    report_items = []

    for d in duties:
        exam = d.examination
        faculty = d.faculty
        checkin = d.checkin_record

        warn_count = db.query(LateWarningRecord).filter(
            LateWarningRecord.faculty_id == faculty.id,
            LateWarningRecord.status == WarningStatus.ACTIVE.value
        ).count()

        inc_status = None
        if checkin and checkin.incident_report:
            inc_status = checkin.incident_report.status

        item = ExaminationAttendanceReportItem(
            examination_id=exam.id,
            exam_title=exam.title,
            exam_code=exam.exam_code,
            exam_date=exam.exam_date,
            reporting_time=exam.reporting_time,
            location=exam.location,
            faculty_id=faculty.id,
            faculty_name=faculty.name,
            department_name=faculty.department.name if faculty.department else None,
            role_title=d.role_title,
            duty_status=d.status,
            scanned_at=checkin.scanned_at if checkin else None,
            is_late=checkin.is_late if checkin else False,
            minutes_late=checkin.minutes_late if checkin else 0,
            active_warnings_count=warn_count,
            incident_status=inc_status
        )
        report_items.append(item)

    return report_items


# ===========================================================================
# 2. Main Examination Schedule CRUD & ID Endpoints
# ===========================================================================

@router.post("", response_model=ExaminationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_examination(
    exam_in: ExaminationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Schedules an examination session and generates the primary QR collection token.
    Records scheduled date, reporting time, collection deadline, and permitted grace period.
    """
    existing = db.query(Examination).filter(Examination.exam_code == exam_in.exam_code.strip()).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An examination with code '{exam_in.exam_code}' already exists."
        )

    exam = Examination(
        title=exam_in.title.strip(),
        exam_code=exam_in.exam_code.strip(),
        exam_date=exam_in.exam_date.strip(),
        reporting_time=exam_in.reporting_time.strip(),
        collection_deadline=exam_in.collection_deadline.strip(),
        grace_period_minutes=exam_in.grace_period_minutes,
        location=exam_in.location.strip(),
        instructions=exam_in.instructions.strip() if exam_in.instructions else None,
        status=ExamStatus.SCHEDULED.value,
        created_by_id=admin.id
    )
    db.add(exam)
    db.flush()

    token_str = qr_service.generate_secure_token(prefix=exam.exam_code.replace(" ", "_"))
    svg_content = qr_service.generate_qr_svg(token_str)
    valid_from, valid_until = qr_service.compute_default_validity_window(exam.exam_date, exam.reporting_time)

    qr_token = QRCheckInToken(
        examination_id=exam.id,
        token=token_str,
        bucket_label=f"Bucket #{exam.exam_code}-MAIN",
        qr_svg_content=svg_content,
        valid_from=valid_from,
        valid_until=valid_until,
        is_active=True
    )
    db.add(qr_token)

    log_exam_audit(
        db,
        "EXAM_SCHEDULE_CREATED",
        admin.id,
        {
            "examination_id": exam.id,
            "exam_code": exam.exam_code,
            "title": exam.title,
            "exam_date": exam.exam_date,
            "reporting_time": exam.reporting_time
        }
    )

    db.commit()
    db.refresh(exam)
    return exam


@router.get("", response_model=List[ExaminationResponse])
def list_examinations(
    date: Optional[str] = Query(None, description="Filter by YYYY-MM-DD"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search title, exam_code, or location"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists examination schedules.
    - Admin: view all scheduled examinations across the school.
    - Faculty: view all scheduled examinations or those assigned to them.
    """
    query = db.query(Examination)

    if date:
        query = query.filter(Examination.exam_date == date.strip())
    if status_filter:
        query = query.filter(Examination.status == status_filter.strip())
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Examination.title.ilike(search_fmt),
                Examination.exam_code.ilike(search_fmt),
                Examination.location.ilike(search_fmt)
            )
        )

    exams = query.order_by(Examination.exam_date.desc(), Examination.reporting_time.asc()).all()

    response_items = []
    for exam in exams:
        item = ExaminationResponse.model_validate(exam)
        item.assigned_faculty_count = len(exam.duties)
        item.checked_in_count = sum(1 for d in exam.duties if d.status in [DutyStatus.CHECKED_IN.value, DutyStatus.LATE.value, DutyStatus.EXCUSED.value])
        item.late_count = sum(1 for d in exam.duties if d.status == DutyStatus.LATE.value)
        item.qr_tokens = [QRCheckInTokenResponse.model_validate(t) for t in exam.qr_tokens]
        item.qr_tokens_count = len(exam.qr_tokens)
        response_items.append(item)

    return response_items


@router.get("/{examination_id}", response_model=ExaminationDetailResponse)
def get_examination_details(
    examination_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full details of an examination session, assigned duties, QR tokens, and check-in records."""
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    res = ExaminationDetailResponse.model_validate(exam)
    res.assigned_faculty_count = len(exam.duties)
    res.checked_in_count = sum(1 for d in exam.duties if d.status in [DutyStatus.CHECKED_IN.value, DutyStatus.LATE.value, DutyStatus.EXCUSED.value])
    res.late_count = sum(1 for d in exam.duties if d.status == DutyStatus.LATE.value)
    return res


@router.put("/{examination_id}", response_model=ExaminationDetailResponse)
def update_examination(
    examination_id: int,
    exam_in: ExaminationUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Updates examination details, reporting time, location, or status."""
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    if exam_in.title is not None:
        exam.title = exam_in.title.strip()
    if exam_in.exam_date is not None:
        exam.exam_date = exam_in.exam_date.strip()
    if exam_in.reporting_time is not None:
        exam.reporting_time = exam_in.reporting_time.strip()
    if exam_in.collection_deadline is not None:
        exam.collection_deadline = exam_in.collection_deadline.strip()
    if exam_in.grace_period_minutes is not None:
        exam.grace_period_minutes = exam_in.grace_period_minutes
    if exam_in.location is not None:
        exam.location = exam_in.location.strip()
    if exam_in.instructions is not None:
        exam.instructions = exam_in.instructions.strip()
    if exam_in.status is not None:
        exam.status = exam_in.status.strip()

    exam.updated_at = datetime.utcnow()

    log_exam_audit(
        db,
        "EXAM_SCHEDULE_UPDATED",
        admin.id,
        {"examination_id": exam.id, "exam_code": exam.exam_code}
    )

    db.commit()
    db.refresh(exam)
    return exam


@router.post("/{examination_id}/cancel", response_model=ExaminationResponse)
def cancel_examination(
    examination_id: int,
    cancel_req: ExaminationCancelRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Cancels an examination session with an auditable reason.
    - Marks examination status as 'cancelled'.
    - Prevents new faculty check-ins.
    - Preserves all attendance, warning, incident, and audit records.
    - Keeps cancelled examinations available in history.
    """
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    exam.status = ExamStatus.CANCELLED.value
    exam.updated_at = datetime.utcnow()

    log_exam_audit(
        db,
        "EXAM_SCHEDULE_CANCELLED",
        admin.id,
        {
            "examination_id": exam.id,
            "exam_code": exam.exam_code,
            "title": exam.title,
            "reason": cancel_req.reason.strip()
        }
    )

    db.commit()
    db.refresh(exam)

    item = ExaminationResponse.model_validate(exam)
    item.assigned_faculty_count = len(exam.duties)
    item.checked_in_count = sum(1 for d in exam.duties if d.status in [DutyStatus.CHECKED_IN.value, DutyStatus.LATE.value, DutyStatus.EXCUSED.value])
    item.late_count = sum(1 for d in exam.duties if d.status == DutyStatus.LATE.value)
    item.qr_tokens = [QRCheckInTokenResponse.model_validate(t) for t in exam.qr_tokens]
    item.qr_tokens_count = len(exam.qr_tokens)
    return item


@router.delete("/{examination_id}")
def cancel_or_delete_examination(
    examination_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Permanently deletes an examination schedule ONLY when safe.
    Safety guard:
    - If official records (faculty check-ins or incident reports) exist,
      deletion is blocked with HTTP 400. The administrator is guided to cancel the examination
      instead to preserve audit and punctuality history.
    """
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    if len(exam.checkins) > 0 or len(exam.incident_reports) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete examination '{exam.exam_code}' because it contains {len(exam.checkins)} "
                f"check-in record(s) and {len(exam.incident_reports)} incident report(s). "
                f"Official examination attendance history cannot be deleted. Please cancel the examination instead."
            )
        )

    exam_code = exam.exam_code
    db.delete(exam)

    log_exam_audit(
        db,
        "EXAM_SCHEDULE_DELETED",
        admin.id,
        {"examination_id": examination_id, "exam_code": exam_code}
    )

    db.commit()
    return {"message": f"Examination '{exam_code}' deleted successfully."}


@router.post("/{examination_id}/duties", response_model=DutyAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_faculty_duty(
    examination_id: int,
    duty_in: DutyAssignmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Assigns a registered faculty member to an examination duty."""
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    faculty = db.query(User).filter(User.id == duty_in.faculty_id).first()
    if not faculty or faculty.role != UserRole.FACULTY.value:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    if not faculty.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign duty to a deactivated faculty account.")

    existing_duty = db.query(ExaminationDuty).filter(
        ExaminationDuty.examination_id == examination_id,
        ExaminationDuty.faculty_id == duty_in.faculty_id
    ).first()
    if existing_duty:
        raise HTTPException(status_code=400, detail="This faculty member is already assigned to this examination.")

    duty = ExaminationDuty(
        examination_id=examination_id,
        faculty_id=duty_in.faculty_id,
        role_title=duty_in.role_title.strip() if duty_in.role_title else "Exam Invigilator",
        status=DutyStatus.ASSIGNED.value,
        notes=duty_in.notes.strip() if duty_in.notes else None
    )
    db.add(duty)

    log_exam_audit(
        db,
        "EXAM_DUTY_ASSIGNED",
        admin.id,
        {
            "examination_id": examination_id,
            "faculty_id": faculty.id,
            "faculty_username": faculty.username,
            "role_title": duty.role_title
        }
    )

    db.commit()
    db.refresh(duty)
    return duty


@router.delete("/{examination_id}/duties/{duty_id}")
def remove_faculty_duty(
    examination_id: int,
    duty_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Removes an assigned duty before examination."""
    duty = db.query(ExaminationDuty).filter(
        ExaminationDuty.id == duty_id,
        ExaminationDuty.examination_id == examination_id
    ).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Examination duty assignment not found.")

    faculty_id = duty.faculty_id
    db.delete(duty)

    log_exam_audit(
        db,
        "EXAM_DUTY_REMOVED",
        admin.id,
        {"examination_id": examination_id, "faculty_id": faculty_id, "duty_id": duty_id}
    )

    db.commit()
    return {"message": "Duty assignment removed successfully."}


@router.post("/{examination_id}/qr-tokens", response_model=QRCheckInTokenResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{examination_id}/generate-qr", response_model=QRCheckInTokenResponse, status_code=status.HTTP_201_CREATED)
def generate_examination_qr_token(
    examination_id: int,
    token_req: Optional[QRTokenGenerateRequest] = None,
    bucket_identifier: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Generates an additional secure QR token and vector SVG for a paper/answer bucket.
    Supports label via JSON body or query parameter bucket_identifier.
    """
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    label = "Bucket #1"
    if token_req and token_req.bucket_label:
        label = token_req.bucket_label.strip()
    elif bucket_identifier:
        label = bucket_identifier.strip()
    else:
        current_token_count = len(exam.qr_tokens)
        label = f"Bucket #{exam.exam_code}-{current_token_count + 1}"

    token_str = qr_service.generate_secure_token(prefix=exam.exam_code.replace(" ", "_"))
    svg_content = qr_service.generate_qr_svg(token_str)

    default_valid_from, default_valid_until = qr_service.compute_default_validity_window(exam.exam_date, exam.reporting_time)
    valid_from = (token_req.valid_from if token_req else None) or default_valid_from
    valid_until = (token_req.valid_until if token_req else None) or default_valid_until

    qr_token = QRCheckInToken(
        examination_id=examination_id,
        token=token_str,
        bucket_label=label,
        qr_svg_content=svg_content,
        valid_from=valid_from,
        valid_until=valid_until,
        is_active=True
    )
    db.add(qr_token)

    log_exam_audit(
        db,
        "EXAM_QR_TOKEN_GENERATED",
        admin.id,
        {"examination_id": examination_id, "bucket_label": qr_token.bucket_label}
    )

    db.commit()
    db.refresh(qr_token)
    return qr_token


@router.get("/{examination_id}/qr-tokens", response_model=List[QRCheckInTokenResponse])
def list_examination_qr_tokens(
    examination_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Lists all active QR tokens and SVG images for an examination."""
    exam = db.query(Examination).filter(Examination.id == examination_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found.")

    return exam.qr_tokens
