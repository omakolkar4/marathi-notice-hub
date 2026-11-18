"""
Department Management API Router
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse
)
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter(prefix="/departments", tags=["Departments"])


INITIAL_DEPARTMENTS_CONFIG = [
    {
        "dept_name": "Administration",
        "description": "General School Administration, Governance and Records",
        "demo_user": {
            "name": "Demo Staff - Administration (डेमो प्रशासन)",
            "username": "demo_admin_staff",
            "email": "demo.admin.staff@school.local",
            "subject": "Institutional Operations",
            "designation": "Assistant Registrar (Demo)"
        }
    },
    {
        "dept_name": "Examination",
        "description": "Examination Coordination, Scheduling and Evaluation",
        "demo_user": {
            "name": "Demo Faculty - Examination (डेमो परीक्षा विभाग)",
            "username": "demo_exam_coord",
            "email": "demo.exam.coord@school.local",
            "subject": "Examination Conduct",
            "designation": "Assistant Exam Superintendent (Demo)"
        }
    },
    {
        "dept_name": "Languages",
        "description": "Marathi, Hindi, English and Modern Languages",
        "demo_user": {
            "name": "Demo Faculty - Languages (डेमो भाषा शिक्षक)",
            "username": "demo_marathi_teacher",
            "email": "demo.marathi@school.local",
            "subject": "Marathi Literature & Language",
            "designation": "Senior Language Teacher (Demo)"
        }
    },
    {
        "dept_name": "Library",
        "description": "School Library, Digital Catalog and Learning Resources",
        "demo_user": {
            "name": "Demo Faculty - Library (डेमो ग्रंथपाल)",
            "username": "demo_librarian",
            "email": "demo.librarian@school.local",
            "subject": "Library & Information Science",
            "designation": "Assistant Librarian (Demo)"
        }
    },
    {
        "dept_name": "Mathematics",
        "description": "Mathematics and Applied Statistics",
        "demo_user": {
            "name": "Demo Faculty - Mathematics (डेमो गणित)",
            "username": "demo_math_faculty",
            "email": "demo.math@school.local",
            "subject": "Mathematics",
            "designation": "Lecturer in Mathematics (Demo)"
        }
    },
    {
        "dept_name": "Science",
        "description": "Physics, Chemistry and Biology",
        "demo_user": {
            "name": "Demo Faculty - Science (डेमो विज्ञान)",
            "username": "demo_science_faculty",
            "email": "demo.science@school.local",
            "subject": "General Science",
            "designation": "Science Lecturer (Demo)"
        }
    },
    {
        "dept_name": "Social Sciences",
        "description": "History, Geography and Political Science",
        "demo_user": {
            "name": "Demo Faculty - Social Sciences (डेमो सामाजिक शास्त्रे)",
            "username": "demo_social_teacher",
            "email": "demo.social@school.local",
            "subject": "History & Civics",
            "designation": "Social Science Teacher (Demo)"
        }
    },
    {
        "dept_name": "Sports & Physical Ed",
        "description": "Sports, Physical Training and Health Education",
        "demo_user": {
            "name": "Demo Faculty - Sports (डेमो शारीरिक शिक्षण)",
            "username": "demo_sports_coach",
            "email": "demo.sports@school.local",
            "subject": "Physical Education & Athletics",
            "designation": "Physical Education Director (Demo)"
        }
    }
]


@router.post("/setup-demo-faculty", response_model=Dict[str, Any])
def setup_department_demo_faculty(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """
    Ensures that every initial school department has at least one faculty member assigned.
    - Reuses existing departments (does not create duplicates).
    - Preserves existing faculty records.
    - If a department has no assigned faculty, provisions a clearly identified synthetic demonstration faculty account.
    - Demonstrations strictly have the 'Faculty' role (never Admin).
    - Department membership never grants Admin privileges.
    - Idempotent: Can be run multiple times safely.
    """
    created_departments = []
    created_faculty = []
    skipped_departments = []

    for item in INITIAL_DEPARTMENTS_CONFIG:
        name = item["dept_name"]
        desc = item["description"]
        demo_info = item["demo_user"]

        dept = db.query(Department).filter(Department.name == name).first()
        if not dept:
            dept = Department(name=name, description=desc)
            db.add(dept)
            db.flush()
            created_departments.append(dept.name)

        # Check if department already has faculty members
        existing_faculty = db.query(User).filter(
            User.department_id == dept.id,
            User.role == UserRole.FACULTY.value
        ).all()

        if len(existing_faculty) > 0:
            skipped_departments.append({
                "department": dept.name,
                "reason": f"Already has {len(existing_faculty)} faculty member(s)"
            })
            continue

        # If no faculty in this department, create a demo faculty member if username not taken
        existing_user = db.query(User).filter(
            (User.username == demo_info["username"]) | (User.email == demo_info["email"])
        ).first()

        if existing_user:
            # If user already exists, assign to this department if needed
            if existing_user.department_id != dept.id:
                existing_user.department_id = dept.id
            skipped_departments.append({
                "department": dept.name,
                "reason": f"Account '{existing_user.username}' already exists and assigned"
            })
            continue

        demo_faculty = User(
            name=demo_info["name"],
            username=demo_info["username"],
            email=demo_info["email"],
            hashed_password=get_password_hash("DemoFaculty@2026"),
            role=UserRole.FACULTY.value,  # Never Admin!
            department_id=dept.id,
            subject=demo_info["subject"],
            designation=demo_info["designation"],
            is_active=True,
            is_principal=False,
            permissions=[]
        )
        db.add(demo_faculty)
        created_faculty.append({
            "department": dept.name,
            "username": demo_faculty.username,
            "name": demo_faculty.name,
            "designation": demo_faculty.designation
        })

    db.commit()

    return {
        "message": "Department demo faculty setup verified successfully.",
        "created_departments": created_departments,
        "created_faculty": created_faculty,
        "skipped_departments": skipped_departments
    }


from app.models.audit_log import AuditLog
from app.models.notice import Notice
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentDetailResponse,
    DepartmentAssignHead,
    FacultyMemberSummary
)


def _enrich_department(dept: Department, db: Session) -> DepartmentResponse:
    faculty_users = [u for u in dept.users if u.role == UserRole.FACULTY.value]
    active_faculty = [u for u in faculty_users if u.is_active]
    head_user = None
    if dept.head_id:
        head_user = db.query(User).filter(User.id == dept.head_id).first()

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        head_id=dept.head_id,
        head_name=head_user.name if head_user else None,
        faculty_count=len(faculty_users),
        active_faculty_count=len(active_faculty),
        created_at=dept.created_at
    )


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Create a new academic or administrative school department."""
    existing = db.query(Department).filter(Department.name == dept_in.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department '{dept_in.name}' already exists."
        )

    dept = Department(
        name=dept_in.name.strip(),
        description=dept_in.description.strip() if dept_in.description else None
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _enrich_department(dept, db)


@router.get("", response_model=List[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all school departments with real-time faculty counts (Available to all authenticated staff)."""
    depts = db.query(Department).order_by(Department.name.asc()).all()
    return [_enrich_department(d, db) for d in depts]


@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves department details by ID."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found."
        )
    return _enrich_department(dept, db)


@router.get("/{department_id}/details", response_model=DepartmentDetailResponse)
def get_department_details(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves comprehensive department details including assigned faculty, head, and recent notices."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found."
        )

    faculty_users = [u for u in dept.users if u.role == UserRole.FACULTY.value]
    active_faculty = [u for u in faculty_users if u.is_active]
    head_user = None
    if dept.head_id:
        head_user = db.query(User).filter(User.id == dept.head_id).first()

    faculty_summaries = [
        FacultyMemberSummary(
            id=u.id,
            name=u.name,
            username=u.username,
            email=u.email,
            subject=u.subject,
            designation=u.designation,
            is_active=u.is_active
        )
        for u in sorted(faculty_users, key=lambda x: x.name)
    ]

    dept_notices = db.query(Notice).filter(
        Notice.target_department_id == dept.id
    ).order_by(Notice.created_at.desc()).limit(10).all()

    recent_notices = [
        {
            "id": n.id,
            "title": n.title,
            "category": n.category,
            "status": n.status,
            "priority": n.priority,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "creator_name": n.creator.name if n.creator else None
        }
        for n in dept_notices
    ]

    recent_activities = []
    audits = db.query(AuditLog).filter(
        AuditLog.action.in_(["DEPARTMENT_HEAD_ASSIGNED", "DEPARTMENT_HEAD_REMOVED", "DEPARTMENT_CREATED", "DEPARTMENT_UPDATED"])
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

    for a in audits:
        if a.details and str(dept.id) in str(a.details):
            recent_activities.append({
                "id": a.id,
                "action": a.action,
                "details": a.details,
                "user_name": a.user.name if a.user else "System",
                "created_at": a.created_at.isoformat() if a.created_at else None
            })

    return DepartmentDetailResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        head_id=dept.head_id,
        head_name=head_user.name if head_user else None,
        faculty_count=len(faculty_users),
        active_faculty_count=len(active_faculty),
        created_at=dept.created_at,
        faculty=faculty_summaries,
        notices_count=len(dept_notices),
        recent_notices=recent_notices,
        recent_activities=recent_activities
    )


@router.put("/{department_id}/head", response_model=DepartmentResponse)
def assign_department_head(
    department_id: int,
    payload: DepartmentAssignHead,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Designate or remove Department Head."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found."
        )

    if payload.head_user_id is not None:
        faculty = db.query(User).filter(User.id == payload.head_user_id).first()
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected faculty user not found."
            )
        if faculty.role != UserRole.FACULTY.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Faculty members can be designated as Department Head."
            )
        if faculty.department_id != dept.id:
            faculty.department_id = dept.id

        if not faculty.designation or "Head" not in faculty.designation:
            faculty.designation = f"Department Head ({dept.name})"

        dept.head_id = faculty.id

        audit = AuditLog(
            user_id=admin.id,
            action="DEPARTMENT_HEAD_ASSIGNED",
            details={
                "department_id": dept.id,
                "department_name": dept.name,
                "head_user_id": faculty.id,
                "head_user_name": faculty.name
            }
        )
        db.add(audit)
    else:
        dept.head_id = None
        audit = AuditLog(
            user_id=admin.id,
            action="DEPARTMENT_HEAD_REMOVED",
            details={
                "department_id": dept.id,
                "department_name": dept.name
            }
        )
        db.add(audit)

    db.commit()
    db.refresh(dept)
    return _enrich_department(dept, db)


@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    dept_in: DepartmentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Update department name or description."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found."
        )

    if dept_in.name and dept_in.name.strip() != dept.name:
        existing = db.query(Department).filter(Department.name == dept_in.name.strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department '{dept_in.name}' already exists."
            )
        dept.name = dept_in.name.strip()

    if dept_in.description is not None:
        dept.description = dept_in.description.strip() if dept_in.description else None

    db.commit()
    db.refresh(dept)
    return _enrich_department(dept, db)


@router.delete("/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    """Admin-only: Delete department if no faculty members are attached."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found."
        )

    user_count = len(dept.users)
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {user_count} assigned faculty members. Reassign them first."
        )

    db.delete(dept)
    db.commit()
    return {"message": f"Department '{dept.name}' deleted successfully."}
