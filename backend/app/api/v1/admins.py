"""
Privileged Admin Management API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.school_setting import SchoolSetting
from app.schemas.user import (
    UserResponse,
    AdminCreate,
    AdminUpdate,
    PrincipalTransferRequest
)
from app.api.deps import (
    get_current_active_admin,
    require_permission
)

router = APIRouter(prefix="/admins", tags=["Admin Management & Privileged Security"])

AVAILABLE_PERMISSIONS = [
    "full_admin",
    "manage_admins",
    "exam_management",
    "notice_management",
    "reports_access",
    "settings_management"
]


def log_admin_audit(
    db: Session,
    action: str,
    user_id: int,
    details: Dict[str, Any]
):
    """Logs an auditable admin action without recording passwords or secrets."""
    audit = AuditLog(
        action=action,
        user_id=user_id,
        details=details,
        created_at=datetime.utcnow()
    )
    db.add(audit)


@router.get("", response_model=List[UserResponse])
def list_admin_accounts(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Lists all privileged Admin accounts (Principal, Trustees, and Management Admins).
    Separated from ordinary faculty records.
    """
    admins = db.query(User).filter(
        User.role == UserRole.ADMIN.value
    ).order_by(User.is_principal.desc(), User.created_at.asc()).all()
    return admins


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_admin_account(
    admin_in: AdminCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_admins"))
):
    """
    Creates a new privileged Admin account (e.g., Trustee or Additional Administrator).
    Strictly protected: Only an authenticated Admin with 'manage_admins' permission can create Admins.
    Faculty members can never access this endpoint.
    """
    # 1. Prevent duplicate username
    if db.query(User).filter(User.username == admin_in.username.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with username '{admin_in.username}' already exists."
        )

    # 2. Prevent duplicate email
    if db.query(User).filter(User.email == admin_in.email.strip().lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{admin_in.email}' already exists."
        )

    # 3. Validate permissions
    invalid_perms = [p for p in admin_in.permissions if p not in AVAILABLE_PERMISSIONS]
    if invalid_perms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions specified: {invalid_perms}. Allowed: {AVAILABLE_PERMISSIONS}"
        )

    # 4. Prevent unauthorized privilege escalation
    # Unless caller is Principal or has full_admin, caller cannot grant permissions they do not have
    if not current_admin.is_principal and "full_admin" not in (current_admin.permissions or []):
        caller_perms = set(current_admin.permissions or [])
        unauthorized_grants = [p for p in admin_in.permissions if p not in caller_perms]
        if unauthorized_grants:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilege escalation prevented: You cannot grant permissions you do not hold: {unauthorized_grants}"
            )

    # 5. Create the Admin account (Principal cannot be set directly here; use transfer workflow)
    new_admin = User(
        name=admin_in.name.strip(),
        username=admin_in.username.strip(),
        email=admin_in.email.strip().lower(),
        hashed_password=get_password_hash(admin_in.password),
        role=UserRole.ADMIN.value,
        department_id=None,
        subject=None,
        designation=admin_in.designation.strip() if admin_in.designation else "Trustee",
        phone=admin_in.phone.strip() if admin_in.phone else None,
        is_active=True,
        is_principal=False,
        permissions=list(set(admin_in.permissions)),
        created_by_id=current_admin.id
    )
    db.add(new_admin)
    db.flush()

    # 6. Audit Trail: Record who created, which permissions granted, when
    log_admin_audit(
        db,
        "ADMIN_CREATED",
        current_admin.id,
        {
            "created_admin_id": new_admin.id,
            "created_username": new_admin.username,
            "designation": new_admin.designation,
            "granted_permissions": new_admin.permissions,
            "creator_username": current_admin.username
        }
    )

    db.commit()
    db.refresh(new_admin)
    return new_admin


@router.put("/{admin_id}", response_model=UserResponse)
def update_admin_account(
    admin_id: int,
    admin_in: AdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_admins"))
):
    """
    Updates profile details and permissions for an Admin account.
    Validates permissions, prevents privilege escalation, and records an audit log.
    """
    target = db.query(User).filter(User.id == admin_id).first()
    if not target or target.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    previous_permissions = list(target.permissions or [])
    changes = {}

    if admin_in.name is not None:
        target.name = admin_in.name.strip()
        changes["name"] = target.name
    if admin_in.email is not None:
        existing = db.query(User).filter(User.email == admin_in.email.strip().lower(), User.id != target.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use by another account.")
        target.email = admin_in.email.strip().lower()
        changes["email"] = target.email
    if admin_in.designation is not None:
        target.designation = admin_in.designation.strip()
        changes["designation"] = target.designation
    if admin_in.phone is not None:
        target.phone = admin_in.phone.strip()
        changes["phone"] = target.phone

    if admin_in.permissions is not None:
        # Prevent privilege escalation
        if not current_admin.is_principal and "full_admin" not in (current_admin.permissions or []):
            caller_perms = set(current_admin.permissions or [])
            new_perms = set(admin_in.permissions)
            escalated = new_perms - caller_perms
            if escalated:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Privilege escalation prevented: Cannot grant permissions you do not hold: {list(escalated)}"
                )

        target.permissions = list(set(admin_in.permissions))
        changes["permissions"] = target.permissions

    target.updated_at = datetime.utcnow()

    log_admin_audit(
        db,
        "ADMIN_UPDATED",
        current_admin.id,
        {
            "target_admin_id": target.id,
            "target_username": target.username,
            "previous_permissions": previous_permissions,
            "changes": changes,
            "updated_by": current_admin.username
        }
    )

    db.commit()
    db.refresh(target)
    return target


@router.put("/{admin_id}/deactivate", response_model=UserResponse)
def deactivate_admin_account(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_admins"))
):
    """
    Deactivates an Admin account with safety guards:
    - Cannot deactivate the designated Principal.
    - Cannot deactivate the last remaining active admin with 'manage_admins' permission.
    """
    target = db.query(User).filter(User.id == admin_id).first()
    if not target or target.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    if target.is_principal:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate the designated Principal. Please transfer Principal designation first."
        )

    # Count other active admins who can manage admins
    active_admin_managers = db.query(User).filter(
        User.role == UserRole.ADMIN.value,
        User.is_active == True,
        User.id != target.id
    ).all()

    has_other_manager = any(
        u.is_principal or (u.permissions and ("full_admin" in u.permissions or "manage_admins" in u.permissions))
        for u in active_admin_managers
    )

    if not has_other_manager:
        raise HTTPException(
            status_code=400,
            detail="Safety guard: Cannot deactivate the only remaining active Administrator capable of managing admins."
        )

    target.is_active = False
    target.updated_at = datetime.utcnow()

    log_admin_audit(
        db,
        "ADMIN_DEACTIVATED",
        current_admin.id,
        {
            "target_admin_id": target.id,
            "target_username": target.username,
            "deactivated_by": current_admin.username
        }
    )

    db.commit()
    db.refresh(target)
    return target


@router.put("/{admin_id}/activate", response_model=UserResponse)
def activate_admin_account(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_admins"))
):
    """Reactivates a deactivated Admin account."""
    target = db.query(User).filter(User.id == admin_id).first()
    if not target or target.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    target.is_active = True
    target.updated_at = datetime.utcnow()

    log_admin_audit(
        db,
        "ADMIN_ACTIVATED",
        current_admin.id,
        {
            "target_admin_id": target.id,
            "target_username": target.username,
            "activated_by": current_admin.username
        }
    )

    db.commit()
    db.refresh(target)
    return target


@router.post("/transfer-principal", response_model=UserResponse)
def transfer_principal_designation(
    req: PrincipalTransferRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_admins"))
):
    """
    Controlled Principal Replacement Workflow:
    1. Verifies caller authorization and explicit confirmation phrase 'TRANSFER_PRINCIPAL'.
    2. Identifies current designated Principal and verifies target active Admin account.
    3. Transfers Principal designation atomically.
    4. Former Principal retains Admin role with configured or full permissions.
    5. Updates school settings record with new Principal's name.
    6. Preserves all previous notices, examination schedules, attendance records, and audit history intact.
    7. Records an immutable audit log.
    """
    if req.confirmation_phrase.strip() != "TRANSFER_PRINCIPAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation phrase mismatch. Enter 'TRANSFER_PRINCIPAL' to confirm this sensitive action."
        )

    target_user = db.query(User).filter(
        User.id == req.new_principal_user_id,
        User.role == UserRole.ADMIN.value
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user is not an active Admin account. Please add or promote them to Admin first."
        )

    if not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer Principal role to a deactivated account."
        )

    if target_user.is_principal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already the designated Principal."
        )

    # Find former principal
    former_principal = db.query(User).filter(
        User.role == UserRole.ADMIN.value,
        User.is_principal == True
    ).first()

    former_principal_id = former_principal.id if former_principal else None
    former_principal_name = former_principal.name if former_principal else "Unknown"

    # Execute transfer atomically
    if former_principal:
        former_principal.is_principal = False
        if req.former_principal_permissions is not None:
            former_principal.permissions = list(set(req.former_principal_permissions))
        else:
            # By default former principal retains full permissions as Trustee/Advisor
            former_principal.permissions = list(AVAILABLE_PERMISSIONS)
        former_principal.designation = "Former Principal / Trustee"
        former_principal.updated_at = datetime.utcnow()

    target_user.is_principal = True
    target_user.permissions = list(AVAILABLE_PERMISSIONS)
    target_user.designation = "Principal / प्राचार्य"
    target_user.updated_at = datetime.utcnow()

    # Update SchoolSetting
    school_setting = db.query(SchoolSetting).first()
    if school_setting:
        school_setting.principal_name = f"मा. {target_user.name} (Principal)"
        school_setting.updated_at = datetime.utcnow()

    # Log audit
    log_admin_audit(
        db,
        "PRINCIPAL_TRANSFERRED",
        current_admin.id,
        {
            "former_principal_id": former_principal_id,
            "former_principal_name": former_principal_name,
            "new_principal_id": target_user.id,
            "new_principal_name": target_user.name,
            "new_principal_username": target_user.username,
            "reason": req.reason.strip(),
            "authorized_by": current_admin.username
        }
    )

    db.commit()
    db.refresh(target_user)
    return target_user


@router.get("/history", response_model=List[Dict[str, Any]])
def get_admin_audit_history(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Returns the audit trail for privileged admin actions:
    Admin creations, permission updates, deactivations, and Principal transfers.
    """
    logs = db.query(AuditLog).filter(
        or_(
            AuditLog.action.like("ADMIN_%"),
            AuditLog.action == "PRINCIPAL_TRANSFERRED"
        )
    ).order_by(AuditLog.created_at.desc()).limit(100).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "action": log.action,
            "user_id": log.user_id,
            "user_name": log.user.name if log.user else "System",
            "user_username": log.user.username if log.user else "system",
            "details": log.details or {},
            "created_at": log.created_at
        })
    return result
