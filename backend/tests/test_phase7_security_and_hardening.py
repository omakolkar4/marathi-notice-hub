"""
Phase 7: Comprehensive Security Audit, Role-Based Access, and Hardening Test Suite
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application Name: Marathi Notice Hub
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
    get_password_hash
)
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.examination import (
    Examination,
    ExaminationDuty,
    DutyStatus
)
from app.services.qr_service import qr_service


def test_sec_01_expired_token_rejected(client: TestClient):
    """Expired JWT tokens are rejected with 401 Unauthorized."""
    expired_token = create_access_token(
        subject="admin_test",
        role="Admin",
        user_id=1,
        expires_delta=timedelta(seconds=-10)  # already expired 10s ago
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "could not validate credentials" in res.json()["detail"].lower() or "expired" in res.json()["detail"].lower()


def test_sec_02_deactivated_account_rejected(client: TestClient, seed_data):
    """Deactivated accounts cannot authenticate or access endpoints even with a signed token."""
    inactive_user = seed_data["faculty_inactive"]
    token = create_access_token(
        subject=inactive_user.username,
        role=inactive_user.role,
        user_id=inactive_user.id
    )
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 403
    assert "deactivated" in res.json()["detail"].lower()


def test_sec_03_faculty_blocked_from_all_admin_only_endpoints(
    client: TestClient, faculty_math_headers
):
    """Faculty users are strictly blocked with 403 Forbidden on all administrative endpoints."""
    # 1. Audit Logs
    res_audit = client.get("/api/v1/audit-logs", headers=faculty_math_headers)
    assert res_audit.status_code == 403

    # 2. Examination Creation
    res_exam_create = client.post(
        "/api/v1/examinations",
        json={"title": "Hacked Exam", "exam_code": "HACK-01", "exam_date": "2024-05-01", "reporting_time": "09:00", "collection_deadline": "09:30", "location": "Room 1"},
        headers=faculty_math_headers
    )
    assert res_exam_create.status_code == 403

    # 3. Duty Assignment
    res_assign = client.post("/api/v1/examinations/1/duties", json={"faculty_id": 2}, headers=faculty_math_headers)
    assert res_assign.status_code == 403

    # 4. QR Tokens List
    res_qr = client.get("/api/v1/examinations/1/qr-tokens", headers=faculty_math_headers)
    assert res_qr.status_code == 403

    # 5. Check-In Administrative Correction
    res_correct = client.post("/api/v1/examinations/checkins/1/correct", json={"status": "excused", "reason": "Self-excuse attempt"}, headers=faculty_math_headers)
    assert res_correct.status_code == 403

    # 6. Incident Review
    res_review = client.post("/api/v1/examinations/incidents/1/review", json={"status": "dismissed", "remarks": "Self-dismiss attempt"}, headers=faculty_math_headers)
    assert res_review.status_code == 403

    # 7. Examination Attendance Report
    res_rep = client.get("/api/v1/examinations/attendance-report", headers=faculty_math_headers)
    assert res_rep.status_code == 403


def test_sec_04_faculty_cannot_view_or_access_other_faculty_duties(
    client: TestClient, admin_headers, faculty_math_headers, faculty_sci_headers, seed_data
):
    """Strict horizontal authorization: Faculty A cannot see Faculty B's duties or warnings."""
    # 1. Admin creates exam and assigns duty exclusively to faculty_sci
    exam = client.post(
        "/api/v1/examinations",
        json={
            "title": "Confidential Science Lab Exam",
            "exam_code": f"SEC-EXAM-{datetime.now(timezone.utc).timestamp()}",
            "exam_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "reporting_time": "14:00",
            "collection_deadline": "14:30",
            "location": "Physics Lab"
        },
        headers=admin_headers
    ).json()

    client.post(
        f"/api/v1/examinations/{exam['id']}/duties",
        json={"faculty_id": seed_data["faculty_sci"].id, "role_title": "Lab Incharge"},
        headers=admin_headers
    )

    # 2. faculty_math requests /my-duties -> must NOT see faculty_sci's duty
    duties_math = client.get("/api/v1/examinations/my-duties", headers=faculty_math_headers).json()
    assert not any(d["examination_id"] == exam["id"] for d in duties_math)

    # 3. faculty_sci requests /my-duties -> sees their assigned duty
    duties_sci = client.get("/api/v1/examinations/my-duties", headers=faculty_sci_headers).json()
    assert any(d["examination_id"] == exam["id"] for d in duties_sci)


def test_sec_05_qr_tokens_are_cryptographically_unpredictable():
    """QR tokens have high entropy (>= 40 characters) and cannot be guessed."""
    token1 = qr_service.generate_secure_token(prefix="EXAM")
    token2 = qr_service.generate_secure_token(prefix="EXAM")

    assert len(token1) >= 40
    assert len(token2) >= 40
    assert token1 != token2
    assert token1.startswith("EXAM_")


def test_sec_06_password_hashing_robustness():
    """Password hashing enforces bcrypt salting, non-empty validation, and correct verification."""
    # Non-empty validation
    with pytest.raises(ValueError):
        get_password_hash("")

    # Unique salts
    pwd = "StrongAcademicPassword@2024"
    h1 = get_password_hash(pwd)
    h2 = get_password_hash(pwd)
    assert h1 != h2  # bcrypt salt ensures distinct hashes

    # Verification
    assert verify_password(pwd, h1) is True
    assert verify_password(pwd, h2) is True
    assert verify_password("WrongPassword123", h1) is False
    assert verify_password("", h1) is False
    assert verify_password(pwd, "") is False


def test_sec_07_tampered_jwt_signature_rejected(client: TestClient):
    """Tampered or invalid JWT signatures are rejected with 401."""
    valid_token = create_access_token(subject="admin_test", role="Admin", user_id=1)
    # Tamper with the payload string
    tampered_token = valid_token[:-4] + "ABCD"
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
    assert res.status_code == 401
