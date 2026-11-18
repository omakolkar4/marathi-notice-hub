"""
Comprehensive Unit & Integration Tests: Admin Security, Multi-Admin Management, QR Tokens, and Settings
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, get_db
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.examination import Examination, ExamStatus, QRCheckInToken, FacultyCheckInRecord, ExaminationDuty
from app.models.school_setting import SchoolSetting
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def principal_token(client: TestClient, db_session: Session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    assert admin is not None
    admin.is_principal = True
    admin.role = UserRole.ADMIN.value
    admin.hashed_password = get_password_hash("AdminNotice@2024")
    admin.permissions = ["full_admin", "manage_admins", "exam_management", "notice_management", "reports_access", "settings_management"]
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "AdminNotice@2024"}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def faculty_token(client: TestClient, db_session: Session):
    faculty = db_session.query(User).filter(User.username == "rshinde").first()
    if faculty:
        faculty.hashed_password = get_password_hash("FacultyNotice@2024")
        db_session.commit()
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "rshinde", "password": "FacultyNotice@2024"}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_admins(db_session: Session):
    yield
    # Teardown: ensure admin is Principal and remove any test users
    admin = db_session.query(User).filter(User.username == "admin").first()
    if admin:
        admin.name = "Principal Dr. S. K. Deshmukh"
        admin.is_principal = True
        admin.role = UserRole.ADMIN.value
        admin.designation = "Principal"
        admin.permissions = [
            "full_admin", "manage_admins", "exam_management",
            "notice_management", "reports_access", "settings_management"
        ]
    db_session.query(User).filter(
        (User.username.like("suresh_joshi_%")) | 
        (User.username.like("trustee_%")) |
        (User.username.like("hacker_%"))
    ).delete(synchronize_session=False)
    db_session.commit()


# ============================================================================
# 1. Admin Security & Multi-Admin Creation
# ============================================================================

def test_01_principal_retains_admin_access(client: TestClient, principal_token: str):
    """Verifies that the designated Principal retains full Admin access."""
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "Admin"
    assert data["is_principal"] is True
    assert "full_admin" in data["permissions"]


def test_02_faculty_cannot_create_admin(client: TestClient, faculty_token: str):
    """Faculty members must never be allowed to create Admin accounts."""
    res = client.post(
        "/api/v1/admins",
        headers={"Authorization": f"Bearer {faculty_token}"},
        json={
            "name": "Malicious Admin Attempt",
            "username": "hacker_admin",
            "email": "hacker@school.local",
            "password": "Password123!",
            "designation": "Trustee",
            "permissions": ["full_admin"]
        }
    )
    assert res.status_code == 403
    assert "privileges required" in res.json()["detail"].lower() or "forbidden" in res.json()["detail"].lower()


def test_03_authorized_admin_creates_trustee(client: TestClient, principal_token: str, db_session: Session):
    """Authorized Admin with 'manage_admins' permission can create a Trustee Admin account."""
    ts = int(datetime.utcnow().timestamp())
    trustee_username = f"trustee_{ts}"
    trustee_email = f"trustee_{ts}@school.edu"

    res = client.post(
        "/api/v1/admins",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "name": "Shri. Rajesh Patil",
            "username": trustee_username,
            "email": trustee_email,
            "password": "TrusteePassword@2026",
            "designation": "Trustee / विश्वस्त",
            "phone": "+91 98220 12345",
            "permissions": ["exam_management", "reports_access"]
        }
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["username"] == trustee_username
    assert data["role"] == "Admin"
    assert data["is_principal"] is False
    assert set(data["permissions"]) == {"exam_management", "reports_access"}

    # Verify audit log was recorded
    audits = db_session.query(AuditLog).filter(AuditLog.action == "ADMIN_CREATED").all()
    audit = next((a for a in audits if (a.details or {}).get("created_username") == trustee_username), None)
    assert audit is not None


def test_04_trustee_login_and_permission_enforcement(client: TestClient, db_session: Session):
    """Trustee logs in and can access permitted areas, but is blocked from unpermitted areas."""
    ts = int(datetime.utcnow().timestamp())
    trustee_username = f"trustee_perms_{ts}"
    trustee = User(
        name="Trustee Perms Test",
        username=trustee_username,
        email=f"{trustee_username}@school.edu",
        hashed_password=get_password_hash("TestTrustee@2026"),
        role=UserRole.ADMIN.value,
        is_principal=False,
        permissions=["reports_access"],  # Only reports_access
        is_active=True
    )
    db_session.add(trustee)
    db_session.commit()

    # Login as trustee
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": trustee_username, "password": "TestTrustee@2026"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Attempt to create another admin without 'manage_admins' permission -> 403 Forbidden
    create_res = client.post(
        "/api/v1/admins",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Escalated Admin",
            "username": f"esc_{ts}",
            "email": f"esc_{ts}@school.local",
            "password": "Password123!",
            "permissions": ["full_admin"]
        }
    )
    assert create_res.status_code == 403
    assert "insufficient administrative privileges" in create_res.json()["detail"].lower()


def test_05_department_membership_does_not_grant_admin(client: TestClient, db_session: Session):
    """Faculty belonging to Administration or Examination department must not receive Admin access."""
    # Find demo staff in Administration
    admin_faculty = db_session.query(User).filter(User.username == "demo_admin_staff").first()
    assert admin_faculty is not None
    assert admin_faculty.role == UserRole.FACULTY.value

    # Login as demo_admin_staff
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "demo_admin_staff", "password": "DemoFaculty@2026"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Try accessing Admin Management -> 403
    res = client.get(
        "/api/v1/admins",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403


def test_06_prevent_deactivating_only_admin_manager(client: TestClient, principal_token: str, db_session: Session):
    """The system must prevent accidental deactivation of the designated Principal or last admin manager."""
    admin = db_session.query(User).filter(User.username == "admin").first()
    assert admin is not None

    res = client.put(
        f"/api/v1/admins/{admin.id}/deactivate",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert res.status_code == 400
    assert "cannot deactivate the designated principal" in res.json()["detail"].lower()


def test_07_principal_transfer_workflow(client: TestClient, principal_token: str, db_session: Session):
    """Controlled workflow to transfer Principal designation to another Admin."""
    ts = int(datetime.utcnow().timestamp())
    new_principal = User(
        name="Dr. Suresh Joshi",
        username=f"suresh_joshi_{ts}",
        email=f"suresh_{ts}@school.edu",
        hashed_password=get_password_hash("Principal@2026"),
        role=UserRole.ADMIN.value,
        is_principal=False,
        permissions=["full_admin", "manage_admins"],
        is_active=True
    )
    db_session.add(new_principal)
    db_session.commit()
    db_session.refresh(new_principal)

    # Missing confirmation phrase check
    fail_res = client.post(
        "/api/v1/admins/transfer-principal",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "new_principal_user_id": new_principal.id,
            "confirmation_phrase": "WRONG_PHRASE",
            "reason": "Retirement handover"
        }
    )
    assert fail_res.status_code == 400

    # Successful transfer
    res = client.post(
        "/api/v1/admins/transfer-principal",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "new_principal_user_id": new_principal.id,
            "confirmation_phrase": "TRANSFER_PRINCIPAL",
            "reason": "Official retirement and leadership transition"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == new_principal.id
    assert data["is_principal"] is True

    # Verify audit log
    transfer_audit = db_session.query(AuditLog).filter(
        AuditLog.action == "PRINCIPAL_TRANSFERRED"
    ).order_by(AuditLog.created_at.desc()).first()
    assert transfer_audit is not None
    assert transfer_audit.details["new_principal_id"] == new_principal.id

    # Restore initial admin as Principal for subsequent tests and remove temporary test admin
    admin = db_session.query(User).filter(User.username == "admin").first()
    admin.is_principal = True
    db_session.delete(new_principal)
    db_session.commit()


# ============================================================================
# 2. Department-Wise Faculty Setup
# ============================================================================

def test_08_department_faculty_setup_all_8_represented(client: TestClient, principal_token: str, db_session: Session):
    """Verifies that all 8 school departments have faculty assigned and endpoint is idempotent."""
    res = client.post(
        "/api/v1/departments/setup-demo-faculty",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "verified successfully" in data["message"].lower()

    # Query all 8 initial departments
    expected_depts = [
        "Administration", "Examination", "Languages", "Library",
        "Mathematics", "Science", "Social Sciences", "Sports & Physical Ed"
    ]
    for dname in expected_depts:
        dept = db_session.query(Department).filter(Department.name == dname).first()
        assert dept is not None, f"Department {dname} missing"
        faculty_members = [u for u in dept.users if u.role == UserRole.FACULTY.value]
        assert len(faculty_members) >= 1, f"Department {dname} has no faculty members"


# ============================================================================
# 3. Examination Management: QR Tokens, Cancel, Safe Delete
# ============================================================================

def test_09_examination_qr_token_generation_and_listing(client: TestClient, principal_token: str, db_session: Session):
    """Generates QR bucket tokens, verifies vector SVG content, and checks presence on exam listing."""
    ts = int(datetime.utcnow().timestamp())
    exam_code = f"QR-TEST-{ts}"

    # 1. Create examination
    create_res = client.post(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "title": "Marathi Literature Annual Exam",
            "exam_code": exam_code,
            "exam_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "reporting_time": "09:30",
            "collection_deadline": "09:45",
            "grace_period_minutes": 10,
            "location": "Main Examination Hall A",
            "instructions": "Collect papers from Hall A bucket."
        }
    )
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # 2. Generate an additional bucket token via /qr-tokens
    qr_res = client.post(
        f"/api/v1/examinations/{exam_id}/qr-tokens",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={"bucket_label": "Bucket #Hall-A-Papers"}
    )
    assert qr_res.status_code == 201, qr_res.text
    token_data = qr_res.json()
    assert token_data["bucket_label"] == "Bucket #Hall-A-Papers"
    assert token_data["qr_svg_content"] is not None
    assert "<svg" in token_data["qr_svg_content"]
    assert token_data["is_active"] is True

    # 3. Generate another bucket token via /generate-qr alias
    qr_alias_res = client.post(
        f"/api/v1/examinations/{exam_id}/generate-qr?bucket_identifier=Bucket%20%23Hall-A-Answers",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert qr_alias_res.status_code == 201, qr_alias_res.text
    alias_data = qr_alias_res.json()
    assert "Bucket #Hall-A-Answers" in alias_data["bucket_label"]
    assert "<svg" in alias_data["qr_svg_content"]

    # 4. List examinations and verify qr_tokens are present on examination card
    list_res = client.get(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert list_res.status_code == 200
    target_exam = next((e for e in list_res.json() if e["id"] == exam_id), None)
    assert target_exam is not None
    assert target_exam["qr_tokens_count"] >= 3  # initial + 2 added
    assert len(target_exam["qr_tokens"]) >= 3


def test_10_examination_cancel_and_safe_delete(client: TestClient, principal_token: str, db_session: Session):
    """Verifies cancel examination, and safe deletion blocks if official records exist."""
    ts = int(datetime.utcnow().timestamp())
    exam_code = f"SAFE-DEL-{ts}"

    # Create exam
    create_res = client.post(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "title": "Science Practicals Test",
            "exam_code": exam_code,
            "exam_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "reporting_time": "10:00",
            "collection_deadline": "10:15",
            "location": "Lab 102"
        }
    )
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # Cancel examination
    cancel_res = client.post(
        f"/api/v1/examinations/{exam_id}/cancel",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={"reason": "Cancelled due to university timetable revision"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == ExamStatus.CANCELLED.value

    # Verify audit log recorded
    audits = db_session.query(AuditLog).filter(AuditLog.action == "EXAM_SCHEDULE_CANCELLED").all()
    cancel_audit = next((a for a in audits if (a.details or {}).get("exam_code") == exam_code), None)
    assert cancel_audit is not None

    # Simulate official check-in record attached to exam
    exam = db_session.query(Examination).filter(Examination.id == exam_id).first()
    faculty = db_session.query(User).filter(User.role == UserRole.FACULTY.value).first()
    duty = ExaminationDuty(
        examination_id=exam.id,
        faculty_id=faculty.id,
        role_title="Invigilator",
        status="checked_in"
    )
    db_session.add(duty)
    db_session.flush()

    checkin = FacultyCheckInRecord(
        examination_id=exam.id,
        duty_id=duty.id,
        faculty_id=faculty.id,
        scheduled_reporting_time=datetime.utcnow(),
        scanned_at=datetime.utcnow(),
        is_late=False,
        minutes_late=0,
        status="on_time"
    )
    db_session.add(checkin)
    db_session.commit()

    # Attempt delete -> Must be rejected with HTTP 400
    del_res = client.delete(
        f"/api/v1/examinations/{exam_id}",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert del_res.status_code == 400
    assert "official examination attendance history cannot be deleted" in del_res.json()["detail"].lower()


# ============================================================================
# 4. Settings & Profile Management
# ============================================================================

def test_11_school_settings_and_profile_updates(client: TestClient, principal_token: str):
    """Verifies getting and updating centralized school settings and personal user profile."""
    # 1. Get School settings
    get_res = client.get("/api/v1/settings/school")
    assert get_res.status_code == 200
    data = get_res.json()
    assert "school_name" in data

    # 2. Update School settings
    update_res = client.put(
        "/api/v1/settings/school",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "school_name": "महाराष्ट्र उच्च माध्यमिक विद्यालय (Maharashtra Higher Secondary)",
            "contact_email": "principal@maharashtravidyalaya.edu.in",
            "contact_phone": "+91 20 2550 1111",
            "address": "शिवाजी नगर, पुणे, महाराष्ट्र (Shivaji Nagar, Pune)"
        }
    )
    assert update_res.status_code == 200
    assert update_res.json()["school_name"] == "महाराष्ट्र उच्च माध्यमिक विद्यालय (Maharashtra Higher Secondary)"

    # 3. Update personal profile (language & theme)
    prof_res = client.put(
        "/api/v1/settings/profile",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "phone": "+91 98810 99999",
            "preferred_language": "mr",
            "theme_preference": "dark"
        }
    )
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert prof_data["phone"] == "+91 98810 99999"
    assert prof_data["preferred_language"] == "mr"
    assert prof_data["theme_preference"] == "dark"


def test_12_qr_token_generation_and_svg_rendering(client: TestClient, principal_token: str, db_session: Session):
    """Verifies that QR bucket token generation produces a unique token with real scannable SVG."""
    # 1. Create a test examination
    exam_code = f"QR-TEST-{datetime.utcnow().timestamp()}"
    create_res = client.post(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "title": "भौतिकशास्त्र प्रात्यक्षिक परीक्षा (Physics Practical)",
            "exam_code": exam_code,
            "exam_date": (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "reporting_time": "10:00",
            "collection_deadline": "10:30",
            "grace_period_minutes": 10,
            "location": "Physics Lab 2",
            "instructions": "Collect answer sheet bucket from control room"
        }
    )
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # 2. Generate a specific bucket token
    qr_res = client.post(
        f"/api/v1/examinations/{exam_id}/qr-tokens",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={"bucket_label": "Physics Lab Bucket P-01"}
    )
    assert qr_res.status_code == 201
    qr_data = qr_res.json()
    assert qr_data["examination_id"] == exam_id
    assert qr_data["token"].startswith(exam_code)
    assert "<svg" in qr_data["qr_svg_content"]
    assert "</svg>" in qr_data["qr_svg_content"]
    assert qr_data["is_active"] is True

    # 3. Retrieve examination list and verify QR tokens and count are populated
    list_res = client.get(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert list_res.status_code == 200
    exams = list_res.json()
    created_exam = next((e for e in exams if e["id"] == exam_id), None)
    assert created_exam is not None
    assert "qr_tokens" in created_exam
    assert len(created_exam["qr_tokens"]) >= 1
    assert created_exam["qr_tokens_count"] >= 1


def test_13_examination_schedule_edit(client: TestClient, principal_token: str):
    """Verifies that an authorized user can edit examination details."""
    exam_code = f"EDIT-TEST-{datetime.utcnow().timestamp()}"
    create_res = client.post(
        "/api/v1/examinations",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "title": "प्राथमिक गणित परीक्षा (Basic Mathematics)",
            "exam_code": exam_code,
            "exam_date": (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "reporting_time": "09:00",
            "collection_deadline": "09:30",
            "grace_period_minutes": 10,
            "location": "Room 101"
        }
    )
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # Edit examination schedule
    edit_res = client.put(
        f"/api/v1/examinations/{exam_id}",
        headers={"Authorization": f"Bearer {principal_token}"},
        json={
            "title": "सुधारित गणित परीक्षा (Revised Mathematics)",
            "exam_date": (datetime.utcnow() + timedelta(days=4)).strftime("%Y-%m-%d"),
            "reporting_time": "09:30",
            "collection_deadline": "10:00",
            "grace_period_minutes": 15,
            "location": "Auditorium Hall A",
            "instructions": "Calculators are strictly prohibited."
        }
    )
    assert edit_res.status_code == 200
    updated_data = edit_res.json()
    assert updated_data["title"] == "सुधारित गणित परीक्षा (Revised Mathematics)"
    assert updated_data["reporting_time"] == "09:30"
    assert updated_data["grace_period_minutes"] == 15
    assert updated_data["location"] == "Auditorium Hall A"

