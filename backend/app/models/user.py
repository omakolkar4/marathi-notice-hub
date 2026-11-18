"""
User Database Model and Roles
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    FACULTY = "Faculty"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default=UserRole.FACULTY.value)
    
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Admin Security & Multi-Admin Permissions
    is_principal = Column(Boolean, default=False, nullable=False)
    permissions = Column(JSON, nullable=True)  # List of permission strings
    phone = Column(String(30), nullable=True)
    preferred_language = Column(String(10), default="mr", nullable=False)
    theme_preference = Column(String(10), default="light", nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    created_notices = relationship("Notice", back_populates="creator", cascade="all, delete-orphan")
    received_notices = relationship("NoticeRecipient", back_populates="recipient", cascade="all, delete-orphan")
    approvals_given = relationship("NoticeApproval", back_populates="reviewer")
    audit_logs = relationship("AuditLog", back_populates="user")
    creator_admin = relationship("User", remote_side=[id], foreign_keys=[created_by_id])

    def has_permission(self, perm: str) -> bool:
        """Evaluates whether the user possesses a given administrative permission."""
        if self.role != UserRole.ADMIN.value:
            return False
        if self.is_principal:
            return True
        perms = self.permissions or []
        if "full_admin" in perms:
            return True
        return perm in perms

    def __repr__(self) -> str:
        return f"<User id={self.id} username='{self.username}' role='{self.role}' is_principal={self.is_principal}>"
