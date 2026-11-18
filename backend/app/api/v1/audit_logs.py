"""
Audit Logs API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.api.deps import get_current_active_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit & Accountability"])


@router.get("", response_model=List[AuditLogResponse])
def get_system_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name"),
    notice_id: Optional[int] = Query(None, description="Filter by notice ID"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    start_date: Optional[str] = Query(None, description="Filter logs on or after YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter logs on or before YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Administrative endpoint to inspect immutable system audit records.
    Restricted to School Administrator / Principal.
    """
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if notice_id:
        query = query.filter(AuditLog.notice_id == notice_id)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if start_date:
        try:
            s_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            query = query.filter(AuditLog.created_at >= s_dt)
        except ValueError:
            pass
    if end_date:
        try:
            e_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(AuditLog.created_at <= e_dt)
        except ValueError:
            pass

    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
