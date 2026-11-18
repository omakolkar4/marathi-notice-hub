"""
Phase 6: Examination Management and QR Punctuality Tracking Test Suite
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

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
from app.models.audit_log import AuditLog
from app.services.qr_service import qr_service


def test_01_admin_creates_examination_schedule(client: TestClient, admin_headers):
    """Admin schedules an examination session; system generates default QR bucket token with SVG."""
    payload = {
        "title": "इयत्ता १० वी गणित वार्षिक परीक्षा २०२४",
        "exam_code": "SSC-2024-MATH-101",
        "exam_date": "2024-03-25",
        "reporting_time": "09:30",
        "collection_deadline": "10:00",
        "grace_period_minutes": 10,
        "location": "Main Exam Hall A (Room 101)",
        "instructions": "Collect exam paper bucket B-101 and student question papers."
    }

    res = client.post("/api/v1/examinations", json=payload, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()

    assert data["exam_code"] == payload["exam_code"]
    assert data["title"] == payload["title"]
    assert data["status"] == "scheduled"
    assert len(data["qr_tokens"]) >= 1
    assert data["qr_tokens"][0]["qr_svg_content"] is not None
    assert "<svg" in data["qr_tokens"][0]["qr_svg_content"].lower()


def test_02_faculty_cannot_create_examination(client: TestClient, faculty_math_headers):
    """Faculty users are blocked from scheduling examinations."""
    payload = {
        "title": "Unauthorized Exam Schedule",
        "exam_code": "UNAUTH-01",
        "exam_date": "2024-03-25",
        "reporting_time": "09:30",
        "collection_deadline": "10:00",
        "location": "Room 101"
    }
    res = client.post("/api/v1/examinations", json=payload, headers=faculty_math_headers)
    assert res.status_code == 403


def test_03_admin_assigns_duty(client: TestClient, admin_headers, seed_data):
    """Admin assigns faculty to examination duty."""
    # 1. Create exam
    exam_res = client.post(
        "/api/v1/examinations",
        json={
            "title": "विज्ञान प्रात्यक्षिक परीक्षा",
            "exam_code": "SCI-PRAC-2024",
            "exam_date": "2024-04-02",
            "reporting_time": "10:00",
            "collection_deadline": "10:15",
            "location": "Science Lab 2"
        },
        headers=admin_headers
    )
    exam_id = exam_res.json()["id"]

    # 2. Assign faculty_math
    duty_res = client.post(
        f"/api/v1/examinations/{exam_id}/duties",
        json={
            "faculty_id": seed_data["faculty_math"].id,
            "role_title": "Senior Supervisor",
            "notes": "Handle laboratory answer sheets"
        },
        headers=admin_headers
    )
    assert duty_res.status_code == 201
    duty = duty_res.json()
    assert duty["faculty_id"] == seed_data["faculty_math"].id
    assert duty["role_title"] == "Senior Supervisor"
    assert duty["status"] == "assigned"

    # Duplicate duty assignment prevention
    dup_res = client.post(
        f"/api/v1/examinations/{exam_id}/duties",
        json={"faculty_id": seed_data["faculty_math"].id},
        headers=admin_headers
    )
    assert dup_res.status_code == 400


def test_04_successful_on_time_qr_checkin(client: TestClient, admin_headers, faculty_math_headers, seed_data, db_session):
    """Faculty scans valid QR token on time; attendance recorded without late warnings."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Schedule exam with reporting time 10 minutes from now (so scan is on-time)
    future_reporting = (datetime.utcnow() + timedelta(minutes=10)).strftime("%H:%M")

    exam_res = client.post(
        "/api/v1/examinations",
        json={
            "title": "On-Time Exam Session",
            "exam_code": f"ONTIME-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": future_reporting,
            "collection_deadline": future_reporting,
            "grace_period_minutes": 15,
            "location": "Room 201"
        },
        headers=admin_headers
    )
    exam_id = exam_res.json()["id"]
    qr_token = exam_res.json()["qr_tokens"][0]["token"]

    # Assign faculty_math
    client.post(
        f"/api/v1/examinations/{exam_id}/duties",
        json={"faculty_id": seed_data["faculty_math"].id, "role_title": "Paper Collector"},
        headers=admin_headers
    )

    # Faculty scans QR token
    scan_res = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": qr_token},
        headers=faculty_math_headers
    )
    assert scan_res.status_code == 200
    scan_data = scan_res.json()

    assert scan_data["is_late"] is False
    assert scan_data["minutes_late"] == 0
    assert scan_data["status"] == "on_time"
    assert scan_data["warning"] is None
    assert scan_data["incident_report"] is None


def test_05_unassigned_faculty_rejected(client: TestClient, admin_headers, faculty_sci_headers):
    """Faculty who is NOT assigned to the examination duty is blocked with 403 Forbidden."""
    exam_res = client.post(
        "/api/v1/examinations",
        json={
            "title": "Strict Duty Exam",
            "exam_code": f"STRICT-{datetime.utcnow().timestamp()}",
            "exam_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "reporting_time": "11:00",
            "collection_deadline": "11:30",
            "location": "Room 303"
        },
        headers=admin_headers
    )
    qr_token = exam_res.json()["qr_tokens"][0]["token"]

    # Faculty Science attempts to scan without assignment
    scan_res = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": qr_token},
        headers=faculty_sci_headers
    )
    assert scan_res.status_code == 403
    assert "not assigned to this examination duty" in scan_res.json()["detail"].lower()


def test_06_duplicate_scan_prevention(client: TestClient, admin_headers, faculty_math_headers, seed_data):
    """Subsequent scan attempts for the same duty are rejected to prevent duplicate recording."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    reporting = (datetime.utcnow() + timedelta(minutes=5)).strftime("%H:%M")

    exam_res = client.post(
        "/api/v1/examinations",
        json={
            "title": "Duplicate Test Exam",
            "exam_code": f"DUP-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": reporting,
            "collection_deadline": reporting,
            "location": "Room 105"
        },
        headers=admin_headers
    )
    exam_id = exam_res.json()["id"]
    qr_token = exam_res.json()["qr_tokens"][0]["token"]

    client.post(
        f"/api/v1/examinations/{exam_id}/duties",
        json={"faculty_id": seed_data["faculty_math"].id},
        headers=admin_headers
    )

    # First scan succeeds
    res1 = client.post("/api/v1/examinations/scan-checkin", json={"token": qr_token}, headers=faculty_math_headers)
    assert res1.status_code == 200

    # Second scan fails
    res2 = client.post("/api/v1/examinations/scan-checkin", json={"token": qr_token}, headers=faculty_math_headers)
    assert res2.status_code == 400
    assert "already been recorded" in res2.json()["detail"]


def test_07_invalid_and_expired_qr_code(client: TestClient, faculty_math_headers):
    """Non-existent QR token is rejected cleanly."""
    res = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": "NON_EXISTENT_QR_TOKEN_XYZ_123"},
        headers=faculty_math_headers
    )
    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()


def test_08_late_arrival_policy_warnings_and_incident(
    client: TestClient, admin_headers, faculty_sci_headers, seed_data, db_session
):
    """
    Exhaustively tests the three-strike punctuality policy:
    - 1st Late Arrival -> Warning 1 (warning_level=1)
    - 2nd Late Arrival -> Warning 2 (warning_level=2)
    - 3rd Late Arrival -> Automatic Incident Report generation
    """
    faculty_id = seed_data["faculty_sci"].id
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    # Reporting time 2 hours ago (so scan is verified late)
    past_reporting = (datetime.utcnow() - timedelta(hours=2)).strftime("%H:%M")

    # --- Strike 1: First Late Occurrence ---
    exam1 = client.post(
        "/api/v1/examinations",
        json={
            "title": "Late Exam Strike 1",
            "exam_code": f"LATE-1-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": past_reporting,
            "collection_deadline": past_reporting,
            "grace_period_minutes": 5,
            "location": "Room L1"
        },
        headers=admin_headers
    ).json()

    client.post(f"/api/v1/examinations/{exam1['id']}/duties", json={"faculty_id": faculty_id}, headers=admin_headers)

    scan1 = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": exam1["qr_tokens"][0]["token"]},
        headers=faculty_sci_headers
    )
    assert scan1.status_code == 200
    data1 = scan1.json()
    assert data1["is_late"] is True
    assert data1["minutes_late"] > 0
    assert data1["warning"] is not None
    assert data1["warning"]["warning_level"] == 1
    assert data1["incident_report"] is None

    # --- Strike 2: Second Late Occurrence ---
    exam2 = client.post(
        "/api/v1/examinations",
        json={
            "title": "Late Exam Strike 2",
            "exam_code": f"LATE-2-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": past_reporting,
            "collection_deadline": past_reporting,
            "grace_period_minutes": 5,
            "location": "Room L2"
        },
        headers=admin_headers
    ).json()

    client.post(f"/api/v1/examinations/{exam2['id']}/duties", json={"faculty_id": faculty_id}, headers=admin_headers)

    scan2 = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": exam2["qr_tokens"][0]["token"]},
        headers=faculty_sci_headers
    )
    assert scan2.status_code == 200
    data2 = scan2.json()
    assert data2["is_late"] is True
    assert data2["warning"] is not None
    assert data2["warning"]["warning_level"] == 2
    assert data2["incident_report"] is None

    # --- Strike 3: Third Late Occurrence -> Generates Incident Report ---
    exam3 = client.post(
        "/api/v1/examinations",
        json={
            "title": "Late Exam Strike 3",
            "exam_code": f"LATE-3-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": past_reporting,
            "collection_deadline": past_reporting,
            "grace_period_minutes": 5,
            "location": "Room L3"
        },
        headers=admin_headers
    ).json()

    client.post(f"/api/v1/examinations/{exam3['id']}/duties", json={"faculty_id": faculty_id}, headers=admin_headers)

    scan3 = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": exam3["qr_tokens"][0]["token"]},
        headers=faculty_sci_headers
    )
    assert scan3.status_code == 200
    data3 = scan3.json()
    assert data3["is_late"] is True
    assert data3["incident_report"] is not None
    assert data3["incident_report"]["total_late_occurrences"] >= 3
    assert data3["incident_report"]["status"] == "open"
    assert "verified late arrivals" in data3["incident_report"]["incident_summary"].lower()


def test_09_administrative_correction_and_excuse_workflow(
    client: TestClient, admin_headers, faculty_math_headers, seed_data, db_session
):
    """
    Admin reviews and excuses a late check-in record.
    System updates checkin status to 'excused', updates duty, and marks warning excused with audit reason.
    """
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    past_reporting = (datetime.utcnow() - timedelta(hours=1)).strftime("%H:%M")

    # Create exam, duty, and record a late check-in
    exam = client.post(
        "/api/v1/examinations",
        json={
            "title": "Exam For Correction",
            "exam_code": f"CORRECT-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": past_reporting,
            "collection_deadline": past_reporting,
            "location": "Room 501"
        },
        headers=admin_headers
    ).json()

    client.post(
        f"/api/v1/examinations/{exam['id']}/duties",
        json={"faculty_id": seed_data["faculty_math"].id},
        headers=admin_headers
    )

    scan_res = client.post(
        "/api/v1/examinations/scan-checkin",
        json={"token": exam["qr_tokens"][0]["token"]},
        headers=faculty_math_headers
    )
    checkin_id = scan_res.json()["id"]

    correct_payload = {
        "status": "excused",
        "reason": "Official medical emergency approved by Principal."
    }

    correct_res = client.post(
        f"/api/v1/examinations/checkins/{checkin_id}/correct",
        json=correct_payload,
        headers=admin_headers
    )
    assert correct_res.status_code == 200
    corrected_data = correct_res.json()
    assert corrected_data["status"] == "excused"
    assert corrected_data["correction_reason"] == correct_payload["reason"]

    # Verify audit log recorded
    audit_item = db_session.query(AuditLog).filter(
        AuditLog.action == "EXAM_CHECKIN_CORRECTED"
    ).order_by(AuditLog.created_at.desc()).first()
    assert audit_item is not None
    assert audit_item.details["new_status"] == "excused"


def test_10_admin_incident_review_workflow(
    client: TestClient, admin_headers, faculty_sci_headers, seed_data, db_session
):
    """Admin reviews an incident report, records management notes, and updates status to resolved."""
    faculty_id = seed_data["faculty_sci"].id
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    past_reporting = (datetime.utcnow() - timedelta(hours=2)).strftime("%H:%M")

    # Generate 3 strikes to trigger an incident report
    for i in range(3):
        exam = client.post(
            "/api/v1/examinations",
            json={
                "title": f"Incident Exam {i}",
                "exam_code": f"INC-{i}-{datetime.utcnow().timestamp()}",
                "exam_date": today_str,
                "reporting_time": past_reporting,
                "collection_deadline": past_reporting,
                "location": f"Room {i}"
            },
            headers=admin_headers
        ).json()
        client.post(f"/api/v1/examinations/{exam['id']}/duties", json={"faculty_id": faculty_id}, headers=admin_headers)
        client.post("/api/v1/examinations/scan-checkin", json={"token": exam["qr_tokens"][0]["token"]}, headers=faculty_sci_headers)

    incident = db_session.query(ExaminationIncidentReport).filter(ExaminationIncidentReport.status == "open").first()
    assert incident is not None

    review_payload = {
        "status": "resolved",
        "remarks": "Reviewed in academic committee meeting. Faculty counseled and schedule adjusted."
    }
    res = client.post(
        f"/api/v1/examinations/incidents/{incident.id}/review",
        json=review_payload,
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "resolved"
    assert data["admin_remarks"] == review_payload["remarks"]


def test_11_faculty_views_my_duties_and_warnings(
    client: TestClient, admin_headers, faculty_sci_headers, seed_data
):
    """Faculty retrieves their personal assigned duties and punctuality status."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    exam = client.post(
        "/api/v1/examinations",
        json={
            "title": "Faculty Duty Test Exam",
            "exam_code": f"DUTY-TEST-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": "09:00",
            "collection_deadline": "09:30",
            "location": "Room 101"
        },
        headers=admin_headers
    ).json()

    client.post(
        f"/api/v1/examinations/{exam['id']}/duties",
        json={"faculty_id": seed_data["faculty_sci"].id, "role_title": "Invigilator"},
        headers=admin_headers
    )

    duties_res = client.get("/api/v1/examinations/my-duties", headers=faculty_sci_headers)
    assert duties_res.status_code == 200
    duties = duties_res.json()
    assert len(duties) >= 1
    assert any(d["examination_id"] == exam["id"] for d in duties)

    warnings_res = client.get("/api/v1/examinations/my-warnings", headers=faculty_sci_headers)
    assert warnings_res.status_code == 200
    warnings_data = warnings_res.json()
    assert "active_warning_count" in warnings_data
    assert "warnings" in warnings_data
    assert "incidents" in warnings_data


def test_12_examination_attendance_report(
    client: TestClient, admin_headers, faculty_math_headers, seed_data
):
    """Admin generates comprehensive examination attendance report."""
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    exam = client.post(
        "/api/v1/examinations",
        json={
            "title": "Report Test Exam",
            "exam_code": f"REP-TEST-{datetime.utcnow().timestamp()}",
            "exam_date": today_str,
            "reporting_time": "10:00",
            "collection_deadline": "10:30",
            "location": "Auditorium"
        },
        headers=admin_headers
    ).json()

    client.post(
        f"/api/v1/examinations/{exam['id']}/duties",
        json={"faculty_id": seed_data["faculty_math"].id, "role_title": "Supervisor"},
        headers=admin_headers
    )

    res = client.get("/api/v1/examinations/attendance-report", headers=admin_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1

    first = items[0]
    assert "examination_id" in first
    assert "exam_title" in first
    assert "faculty_name" in first
    assert "duty_status" in first
    assert "is_late" in first

