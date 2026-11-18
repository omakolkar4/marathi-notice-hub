"""
FastAPI Request Dependencies
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Authenticates and returns the current user from the JWT access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: Optional[str] = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact school administrator."
        )

    return user


def get_current_active_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user possesses the Admin role."""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required."
        )
    return current_user


def get_current_active_faculty(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user is either a Faculty member or an Admin."""
    if current_user.role not in [UserRole.ADMIN.value, UserRole.FACULTY.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Valid faculty credentials required."
        )
    return current_user


def require_permission(perm: str):
    """Dependency factory that verifies the authenticated Admin user possesses the specified permission."""
    def permission_checker(current_user: User = Depends(get_current_active_admin)) -> User:
        if not current_user.has_permission(perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Insufficient administrative privileges. '{perm}' permission required."
            )
        return current_user
    return permission_checker


def get_current_principal(
    current_user: User = Depends(get_current_active_admin)
) -> User:
    """Verifies that the authenticated admin user is the designated Principal."""
    if not current_user.is_principal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Designated Principal authorization required."
        )
    return current_user
