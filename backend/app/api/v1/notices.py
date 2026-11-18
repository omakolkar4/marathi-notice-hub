"""
Notice Management and NLP Integration API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import os
import uuid
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
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
from app.models.user import User, UserRole
from app.models.department import Department
from app.schemas.notice import (
    NoticeCreate,
    NoticeUpdate,
    NoticeDistributionRequest,
    NoticeResponse,
    NoticeDetailResponse
)
from app.schemas.notice_recipient import NoticeApprovalCreate, NoticeApprovalResponse
from app.schemas.audit_log import AuditLogResponse
from app.api.deps import get_current_user, get_current_active_admin, get_current_active_faculty
from app.services.nlp_service import nlp_service

router = APIRouter(prefix="/notices", tags=["Notices & Distribution"])


def log_audit(db: Session, action: str, user_id: Optional[int], notice_id: Optional[int], details: Optional[Dict[str, Any]] = None):
    """Utility to persist an immutable system audit event."""
    audit = AuditLog(
        action=action,
        user_id=user_id,
        notice_id=notice_id,
        details=details or {},
        created_at=datetime.utcnow()
    )
    db.add(audit)


@router.post("/upload-document")
async def upload_notice_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_faculty)
):
    """
    Uploads an official circular or document (PDF, TXT, DOCX, images).
    Attempts text extraction. If format is plain text/utf-8, returns extracted text.
    If extraction cannot be automated (binary/scanned), safely stores document,
    preserves attachment, and informs the user that manual entry is required.
    """
    upload_dir = os.path.join("data", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex[:12]}_{file.filename}"
    file_path = os.path.join(upload_dir, unique_filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    attachment_url = f"/uploads/{unique_filename}"
    extracted_text = ""
    extraction_status = "success"
    message = "Document uploaded successfully."

    # Plain text formats
    if file_ext in [".txt", ".csv", ".json", ".md"]:
        try:
            extracted_text = contents.decode("utf-8")
        except UnicodeDecodeError:
            try:
                extracted_text = contents.decode("cp1252", errors="ignore")
            except Exception:
                extraction_status = "manual_entry_required"
                message = "Could not decode text encoding. Please enter notice text manually."
    else:
        # Binary or scanned format (PDF, DOCX, Images, etc.)
        try:
            # Fallback simple text stream search
            text_candidates = re.findall(r'[\u0900-\u097F\w\s.,:;!?-]{4,}', contents.decode("latin1", errors="ignore"))
            clean_candidate = " ".join(t.strip() for t in text_candidates if len(t.strip()) > 3)
            if len(clean_candidate) > 40:
                extracted_text = clean_candidate[:4000]
            else:
                extraction_status = "manual_entry_required"
                message = "Document uploaded successfully. Automated text extraction is not available for this binary format without OCR. Please enter or verify notice text manually."
        except Exception:
            extraction_status = "manual_entry_required"
            message = "Document uploaded successfully. Please enter or verify notice text manually."

    return {
        "filename": file.filename,
        "attachment_url": attachment_url,
        "extracted_text": extracted_text,
        "extraction_status": extraction_status,
        "message": message
    }


@router.post("", response_model=NoticeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_notice(
    notice_in: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_faculty)
):
    """
    Creates a new school notice draft and executes the Marathi NLP pipeline.
    Stores the original notice text without silent modification.
    Stores the notice along with its automated category prediction, entity extraction,
    and recipient analysis.
    """
    if not notice_in.title.strip():
        raise HTTPException(status_code=400, detail="Notice title cannot be empty.")
    if not notice_in.original_text.strip():
        raise HTTPException(status_code=400, detail="Notice text cannot be empty.")

    # Determine source type
    source_type = notice_in.source_type or NoticeSourceType.FACULTY_SUBMITTED.value
    if current_user.role == UserRole.ADMIN.value and source_type == NoticeSourceType.HIGHER_AUTHORITY.value:
        source = NoticeSourceType.HIGHER_AUTHORITY.value
    elif current_user.role == UserRole.ADMIN.value:
        source = NoticeSourceType.MANAGEMENT.value
    else:
        source = NoticeSourceType.FACULTY_SUBMITTED.value

    # 1. Execute Marathi NLP Pipeline (preserving original text)
    try:
        nlp_res = nlp_service.process_notice(notice_in.original_text)
        predicted_cat = nlp_res["predicted_category"].get("category", "General")
        nlp_failed = False
    except Exception as exc:
        nlp_failed = True
        nlp_res = {
            "normalized_text": "",
            "predicted_category": {"category": "General", "confidence": 0.0},
            "extracted_entities": {},
            "suggested_recipients": [],
            "recipient_explanation": f"NLP pipeline error: {str(exc)}",
            "review_required": True,
            "review_reasons": ["Automated NLP analysis failed. Manual review required."]
        }
        predicted_cat = "General"

    # 2. Create Notice record in draft state
    notice = Notice(
        title=notice_in.title.strip(),
        original_text=notice_in.original_text.strip(),
        attachment_url=notice_in.attachment_url,
        creator_id=current_user.id,
        source_type=source,
        predicted_category=predicted_cat,
        approval_status=NoticeApprovalStatus.DRAFT.value,
        distribution_status=NoticeDistributionStatus.PENDING.value,
        priority=notice_in.priority or NoticePriority.NORMAL.value,
        target_audience=notice_in.target_audience,
        target_department_id=notice_in.target_department_id,
        target_subject=notice_in.target_subject,
        notice_language=notice_in.notice_language or "mr",
        source_organization=notice_in.source_organization,
        source_date=notice_in.source_date
    )
    db.add(notice)
    db.flush()  # generates notice.id

    # 3. Create NLP Analysis record
    nlp_analysis = NLPAnalysis(
        notice_id=notice.id,
        normalized_text=nlp_res.get("normalized_text", ""),
        predicted_category=predicted_cat,
        confidence=float(nlp_res["predicted_category"].get("confidence", 0.0)),
        extracted_entities=nlp_res.get("extracted_entities", {}),
        suggested_recipients=nlp_res.get("suggested_recipients", []),
        recipient_explanation=nlp_res.get("recipient_explanation", ""),
        review_required=bool(nlp_res.get("review_required", False)),
        review_reasons=nlp_res.get("review_reasons", []),
        model_version="0.1.0-tfidf-logreg"
    )
    db.add(nlp_analysis)

    # 4. Audit Logging
    log_audit(
        db,
        "NOTICE_CREATED",
        current_user.id,
        notice.id,
        {
            "title": notice.title,
            "source_type": source,
            "language": notice.notice_language,
            "source_org": notice.source_organization
        }
    )
    if nlp_failed:
        log_audit(
            db,
            "NLP_ANALYSIS_FAILED",
            current_user.id,
            notice.id,
            {"error": "NLP pipeline raised an exception"}
        )
    else:
        log_audit(
            db,
            "NLP_ANALYSIS_COMPLETED",
            current_user.id,
            notice.id,
            {
                "predicted_category": predicted_cat,
                "confidence": float(nlp_res["predicted_category"].get("confidence", 0.0)),
                "review_required": bool(nlp_res.get("review_required", False))
            }
        )

    db.commit()
    db.refresh(notice)
    return notice


@router.get("", response_model=List[NoticeResponse])
def list_notices(
    category: Optional[str] = Query(None, description="Filter by category"),
    department_id: Optional[int] = Query(None, description="Filter by target department"),
    source_type: Optional[str] = Query(None, description="Filter by notice source"),
    approval_status: Optional[str] = Query(None, description="Filter by approval status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    distribution_status: Optional[str] = Query(None, description="Filter by distribution status"),
    start_date: Optional[str] = Query(None, description="Filter notices created on or after YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter notices created on or before YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Search notice title or text"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists notices accessible to the authenticated user.
    - Admin: can view all notices across all statuses.
    - Faculty: can view notices they authored OR notices distributed to them as recipients.
    Enriches faculty response with read and acknowledgment states.
    Supports filtering by category, department, source, status, date range, and text search.
    """
    query = db.query(Notice)

    if current_user.role != UserRole.ADMIN.value:
        # Faculty role: see own notices OR distributed notices where user is a recipient
        received_query = db.query(NoticeRecipient.notice_id).filter(
            NoticeRecipient.recipient_id == current_user.id
        )

        query = query.filter(
            or_(
                Notice.creator_id == current_user.id,
                Notice.id.in_(received_query)
            )
        )

    # Apply filters
    if category:
        query = query.filter(Notice.predicted_category == category)
    if department_id:
        query = query.filter(Notice.target_department_id == department_id)
    if source_type:
        query = query.filter(Notice.source_type == source_type)
    if approval_status:
        query = query.filter(Notice.approval_status == approval_status)
    if distribution_status:
        query = query.filter(Notice.distribution_status == distribution_status)
    if priority:
        query = query.filter(Notice.priority == priority)

    if start_date:
        try:
            s_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            query = query.filter(Notice.created_at >= s_dt)
        except ValueError:
            pass

    if end_date:
        try:
            e_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Notice.created_at <= e_dt)
        except ValueError:
            pass

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(Notice.title.ilike(search_fmt), Notice.original_text.ilike(search_fmt))
        )

    notices = query.order_by(Notice.created_at.desc()).all()

    # If faculty, enrich with read / acknowledgment status
    if current_user.role != UserRole.ADMIN.value and notices:
        notice_ids = [n.id for n in notices]
        recips = db.query(NoticeRecipient).filter(
            NoticeRecipient.notice_id.in_(notice_ids),
            NoticeRecipient.recipient_id == current_user.id
        ).all()
        recip_map = {r.notice_id: r for r in recips}

        response_list = []
        for n in notices:
            item = NoticeResponse.model_validate(n)
            if n.id in recip_map:
                item.is_read = recip_map[n.id].is_read
                item.is_acknowledged = recip_map[n.id].is_acknowledged
            response_list.append(item)
        return response_list

    return notices


@router.get("/{notice_id}", response_model=NoticeDetailResponse)
def get_notice_details(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves full details of a notice, including NLP analysis, approvals, and recipient stats.
    Verifies that the user is the creator, an authorized admin, or an assigned recipient.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    is_recip = None
    if current_user.role != UserRole.ADMIN.value:
        is_recip = db.query(NoticeRecipient).filter(
            NoticeRecipient.notice_id == notice_id,
            NoticeRecipient.recipient_id == current_user.id
        ).first()
        if not is_recip and notice.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access forbidden: You are not authorized to view this notice.")

    # Calculate recipient statistics
    recipient_count = len(notice.recipients)
    read_count = sum(1 for r in notice.recipients if r.is_read)
    ack_count = sum(1 for r in notice.recipients if r.is_acknowledged)

    res = NoticeDetailResponse.model_validate(notice)
    res.recipient_count = recipient_count
    res.read_count = read_count
    res.acknowledged_count = ack_count

    if is_recip:
        res.is_read = is_recip.is_read
        res.is_acknowledged = is_recip.is_acknowledged

    return res


@router.put("/{notice_id}", response_model=NoticeDetailResponse)
def update_notice_draft(
    notice_id: int,
    notice_in: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_faculty)
):
    """
    Updates a notice draft.
    Can only be edited while in 'draft' or 'returned' state.
    Re-runs NLP analysis if the notice text has changed.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    # Authorization check
    if current_user.role != UserRole.ADMIN.value and notice.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the notice author or an administrator can modify this draft.")

    if notice.approval_status not in [NoticeApprovalStatus.DRAFT.value, NoticeApprovalStatus.RETURNED.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit notice with status '{notice.approval_status}'. Only drafts or returned notices can be edited."
        )

    if notice_in.title:
        notice.title = notice_in.title.strip()

    text_changed = False
    if notice_in.original_text and notice_in.original_text.strip() != notice.original_text:
        notice.original_text = notice_in.original_text.strip()
        text_changed = True

    if notice_in.attachment_url is not None:
        notice.attachment_url = notice_in.attachment_url
    if notice_in.priority:
        notice.priority = notice_in.priority

    recipient_changed = False
    if notice_in.target_audience is not None and notice_in.target_audience != notice.target_audience:
        notice.target_audience = notice_in.target_audience
        recipient_changed = True
    if notice_in.target_department_id is not None and notice_in.target_department_id != notice.target_department_id:
        notice.target_department_id = notice_in.target_department_id
        recipient_changed = True
    if notice_in.target_subject is not None and notice_in.target_subject != notice.target_subject:
        notice.target_subject = notice_in.target_subject
        recipient_changed = True

    if notice_in.notice_language:
        notice.notice_language = notice_in.notice_language
    if notice_in.source_organization is not None:
        notice.source_organization = notice_in.source_organization
    if notice_in.source_date is not None:
        notice.source_date = notice_in.source_date

    # Re-run NLP analysis if text changed
    if text_changed:
        nlp_res = nlp_service.process_notice(notice.original_text)
        notice.predicted_category = nlp_res["predicted_category"].get("category", "General")

        if notice.nlp_analysis:
            notice.nlp_analysis.normalized_text = nlp_res.get("normalized_text", "")
            notice.nlp_analysis.predicted_category = notice.predicted_category
            notice.nlp_analysis.confidence = float(nlp_res["predicted_category"].get("confidence", 0.0))
            notice.nlp_analysis.extracted_entities = nlp_res.get("extracted_entities", {})
            notice.nlp_analysis.suggested_recipients = nlp_res.get("suggested_recipients", [])
            notice.nlp_analysis.recipient_explanation = nlp_res.get("recipient_explanation", "")
            notice.nlp_analysis.review_required = bool(nlp_res.get("review_required", False))
            notice.nlp_analysis.review_reasons = nlp_res.get("review_reasons", [])

    if recipient_changed:
        log_audit(
            db,
            "RECIPIENTS_UPDATED",
            current_user.id,
            notice.id,
            {
                "target_audience": notice.target_audience,
                "department_id": notice.target_department_id,
                "subject": notice.target_subject
            }
        )
    else:
        log_audit(
            db,
            "NOTICE_UPDATED",
            current_user.id,
            notice.id,
            {"title": notice.title, "text_changed": text_changed}
        )

    db.commit()
    db.refresh(notice)
    return notice


@router.post("/{notice_id}/submit", response_model=NoticeResponse)
def submit_notice_for_review(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_faculty)
):
    """
    Submits a faculty-created draft notice for administrative review and approval.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    if current_user.role != UserRole.ADMIN.value and notice.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the notice author can submit this notice.")

    if notice.approval_status not in [NoticeApprovalStatus.DRAFT.value, NoticeApprovalStatus.RETURNED.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Notice is already '{notice.approval_status}' and cannot be resubmitted."
        )

    notice.approval_status = NoticeApprovalStatus.SUBMITTED.value

    log_audit(
        db,
        "NOTICE_SUBMITTED",
        current_user.id,
        notice.id,
        {"submitted_by": current_user.username}
    )

    db.commit()
    db.refresh(notice)
    return notice


@router.post("/{notice_id}/approve", response_model=NoticeDetailResponse)
def review_notice(
    notice_id: int,
    approval_in: NoticeApprovalCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Approves, rejects, or returns a submitted notice.
    Records an immutable audit entry in NoticeApproval and AuditLog.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    valid_decisions = [
        ApprovalDecision.APPROVED.value,
        ApprovalDecision.REJECTED.value,
        ApprovalDecision.RETURNED.value
    ]
    if approval_in.decision not in valid_decisions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{approval_in.decision}'. Allowed decisions: {valid_decisions}."
        )

    notice.approval_status = approval_in.decision

    # Record approval audit log
    approval = NoticeApproval(
        notice_id=notice.id,
        reviewer_id=admin.id,
        decision=approval_in.decision,
        comment=approval_in.comment.strip() if approval_in.comment else None
    )
    db.add(approval)

    action_name = f"NOTICE_{approval_in.decision.upper()}"
    log_audit(
        db,
        action_name,
        admin.id,
        notice.id,
        {
            "decision": approval_in.decision,
            "comment": approval_in.comment.strip() if approval_in.comment else None
        }
    )

    db.commit()
    db.refresh(notice)
    return notice


@router.post("/{notice_id}/distribute", response_model=NoticeDetailResponse)
def distribute_notice(
    notice_id: int,
    dist_req: NoticeDistributionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Distributes an approved notice to targeted recipients.
    Generates NoticeRecipient tracking records for all eligible faculty members.
    Validates recipient list, prevents duplicate distribution, and enforces safety review.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    if notice.approval_status != NoticeApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Notice must be 'approved' before distribution. Current status is '{notice.approval_status}'."
        )

    # Resolve target recipient users
    target_users: List[User] = []
    source = RecipientSelectionSource.ADMIN_SELECTION.value

    if dist_req.target_audience == "all_faculty":
        target_users = db.query(User).filter(
            User.role == UserRole.FACULTY.value,
            User.is_active == True
        ).all()
        source = RecipientSelectionSource.SCHOOL_WIDE.value

    elif dist_req.target_audience == "department":
        if not dist_req.department_id:
            raise HTTPException(status_code=400, detail="Department ID required for department distribution.")
        dept = db.query(Department).filter(Department.id == dist_req.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department with ID {dist_req.department_id} does not exist.")
        target_users = db.query(User).filter(
            User.department_id == dist_req.department_id,
            User.is_active == True
        ).all()
        source = RecipientSelectionSource.DEPARTMENT.value

    elif dist_req.target_audience == "subject":
        if not dist_req.subject or not dist_req.subject.strip():
            raise HTTPException(status_code=400, detail="Subject name required for subject-wise distribution.")
        target_users = db.query(User).filter(
            User.subject.ilike(f"%{dist_req.subject.strip()}%"),
            User.is_active == True
        ).all()
        source = RecipientSelectionSource.NLP_SUGGESTION.value

    elif dist_req.target_audience == "selected_faculty":
        if not dist_req.faculty_ids or len(dist_req.faculty_ids) == 0:
            raise HTTPException(status_code=400, detail="faculty_ids list required for selected faculty distribution.")
        valid_faculty = db.query(User).filter(
            User.id.in_(dist_req.faculty_ids),
            User.role == UserRole.FACULTY.value,
            User.is_active == True
        ).all()
        found_ids = {u.id for u in valid_faculty}
        missing_ids = [fid for fid in dist_req.faculty_ids if fid not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid or inactive faculty IDs provided: {missing_ids}."
            )
        target_users = valid_faculty
        source = RecipientSelectionSource.ADMIN_SELECTION.value
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported target_audience '{dist_req.target_audience}'.")

    if not target_users:
        raise HTTPException(status_code=400, detail="No active faculty members matched the distribution criteria.")

    # Check for duplicate distribution
    new_recipients = []
    for u in target_users:
        existing = db.query(NoticeRecipient).filter(
            NoticeRecipient.notice_id == notice.id,
            NoticeRecipient.recipient_id == u.id
        ).first()
        if not existing:
            recip = NoticeRecipient(
                notice_id=notice.id,
                recipient_id=u.id,
                selection_source=source,
                delivery_status=DeliveryStatus.DELIVERED.value,
                is_read=False,
                is_acknowledged=False
            )
            db.add(recip)
            new_recipients.append(u.id)

    if notice.distribution_status == NoticeDistributionStatus.DISTRIBUTED.value and len(new_recipients) == 0:
        raise HTTPException(
            status_code=400,
            detail="Notice has already been distributed to all specified recipients. Duplicate distribution prevented."
        )

    notice.distribution_status = NoticeDistributionStatus.DISTRIBUTED.value
    notice.target_audience = dist_req.target_audience
    if dist_req.department_id:
        notice.target_department_id = dist_req.department_id
    if dist_req.subject:
        notice.target_subject = dist_req.subject

    log_audit(
        db,
        "NOTICE_DISTRIBUTED",
        admin.id,
        notice.id,
        {
            "target_audience": dist_req.target_audience,
            "department_id": dist_req.department_id,
            "subject": dist_req.subject,
            "recipients_count": len(target_users),
            "new_recipients_count": len(new_recipients)
        }
    )

    db.commit()
    db.refresh(notice)
    return notice


@router.post("/{notice_id}/cancel", response_model=NoticeDetailResponse)
def cancel_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancels / archives a notice.
    Permitted for Admin or for notice author (if notice is still in draft or returned state).
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    is_admin = current_user.role == UserRole.ADMIN.value
    is_author = notice.creator_id == current_user.id

    if not is_admin and not is_author:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this notice.")

    if not is_admin and notice.approval_status not in [NoticeApprovalStatus.DRAFT.value, NoticeApprovalStatus.RETURNED.value]:
        raise HTTPException(status_code=400, detail="Faculty authors can only cancel drafts or returned notices.")

    notice.approval_status = NoticeApprovalStatus.ARCHIVED.value
    log_audit(
        db,
        "NOTICE_CANCELLED",
        current_user.id,
        notice.id,
        {"actor": current_user.username, "role": current_user.role}
    )
    db.commit()
    db.refresh(notice)
    return notice


@router.post("/{notice_id}/read")
def mark_notice_as_read(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks notice as read by the authenticated faculty recipient."""
    recip = db.query(NoticeRecipient).filter(
        NoticeRecipient.notice_id == notice_id,
        NoticeRecipient.recipient_id == current_user.id
    ).first()

    if not recip:
        raise HTTPException(status_code=404, detail="Notice delivery record not found for this user.")

    if not recip.is_read:
        recip.is_read = True
        recip.read_at = datetime.utcnow()
        log_audit(
            db,
            "NOTICE_READ",
            current_user.id,
            notice_id,
            {"recipient_username": current_user.username}
        )
        db.commit()

    return {"message": "Notice marked as read.", "read_at": recip.read_at}


@router.post("/{notice_id}/acknowledge")
def acknowledge_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Records explicit acknowledgment of notice receipt by faculty member."""
    recip = db.query(NoticeRecipient).filter(
        NoticeRecipient.notice_id == notice_id,
        NoticeRecipient.recipient_id == current_user.id
    ).first()

    if not recip:
        raise HTTPException(status_code=404, detail="Notice delivery record not found for this user.")

    recip.is_acknowledged = True
    recip.acknowledged_at = datetime.utcnow()
    if not recip.is_read:
        recip.is_read = True
        recip.read_at = recip.acknowledged_at

    log_audit(
        db,
        "NOTICE_ACKNOWLEDGED",
        current_user.id,
        notice_id,
        {"recipient_username": current_user.username}
    )

    db.commit()
    return {"message": "Notice acknowledged successfully.", "acknowledged_at": recip.acknowledged_at}


@router.get("/{notice_id}/audit-trail", response_model=List[AuditLogResponse])
def get_notice_audit_trail(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns audit trail events for a notice.
    Admin can view all; faculty can view only for notices they authored or received.
    """
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")

    if current_user.role != UserRole.ADMIN.value and notice.creator_id != current_user.id:
        is_recip = db.query(NoticeRecipient).filter(
            NoticeRecipient.notice_id == notice_id,
            NoticeRecipient.recipient_id == current_user.id
        ).first()
        if not is_recip:
            raise HTTPException(status_code=403, detail="Not authorized to view audit logs for this notice.")

    logs = db.query(AuditLog).filter(AuditLog.notice_id == notice_id).order_by(AuditLog.created_at.asc()).all()
    return logs


@router.post("/analyze-nlp")
def analyze_marathi_notice_text(
    payload: dict,
    current_user: User = Depends(get_current_active_faculty)
):
    """
    Direct endpoint to preview Marathi NLP analysis for text without persisting a notice.
    Useful for draft authoring and immediate UI feedback.
    """
    text = payload.get("text", "")
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Notice text is required for NLP analysis.")

    return nlp_service.process_notice(text)
