"""
User and Faculty Management API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.department import Department
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter(prefix="/users", tags=["Users & Faculty"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_faculty_account(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Admin-only: Registers a new faculty or admin account.
    Validates unique username, email, and valid role assignments.
    """
    # Validate role
    if user_in.role not in [UserRole.ADMIN.value, UserRole.FACULTY.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{user_in.role}'. Allowed roles are 'Admin' or 'Faculty'."
        )

    # Check username uniqueness
    if db.query(User).filter(User.username == user_in.username.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_in.username}' is already registered."
        )

    # Check email uniqueness
    if db.query(User).filter(User.email == user_in.email.strip().lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{user_in.email}' is already registered."
        )

    # Check department if provided
    if user_in.department_id:
        dept = db.query(Department).filter(Department.id == user_in.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {user_in.department_id} does not exist."
            )

    new_user = User(
        name=user_in.name.strip(),
        username=user_in.username.strip(),
        email=user_in.email.strip().lower(),
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        department_id=user_in.department_id,
        subject=user_in.subject.strip() if user_in.subject else None,
        designation=user_in.designation.strip() if user_in.designation else None,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("", response_model=List[UserResponse])
def list_faculty_accounts(
    role: Optional[str] = Query(None, description="Filter by role ('Admin' or 'Faculty')"),
    department_id: Optional[int] = Query(None, description="Filter by department"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Lists all faculty and administrator accounts with optional filters."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    return query.order_by(User.name.asc()).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves user profile by ID.
    Faculty can only view their own profile; Admin can view any profile.
    """
    if current_user.role != UserRole.ADMIN.value and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only view your own profile."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_faculty_account(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Updates faculty information, department assignment, or subject."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user_in.name:
        user.name = user_in.name.strip()

    if user_in.email:
        email_str = user_in.email.strip().lower()
        existing = db.query(User).filter(User.email == email_str, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{email_str}' is already taken by another user."
            )
        user.email = email_str

    if user_in.department_id is not None:
        if user_in.department_id > 0:
            dept = db.query(Department).filter(Department.id == user_in.department_id).first()
            if not dept:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with ID {user_in.department_id} does not exist."
                )
            user.department_id = user_in.department_id
        else:
            user.department_id = None

    if user_in.subject is not None:
        user.subject = user_in.subject.strip() if user_in.subject else None

    if user_in.designation is not None:
        user.designation = user_in.designation.strip() if user_in.designation else None

    if user_in.is_active is not None:
        # Prevent admin from deactivating themselves
        if user.id == admin.id and not user_in.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate their own active account."
            )
        user.is_active = user_in.is_active

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_account(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Deactivates a faculty member account."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/activate", response_model=UserResponse)
def activate_account(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Re-activates a deactivated user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.is_active = True
    db.commit()
    db.refresh(user)
    return user
