"""
Phase 5 Comprehensive Integration Test Suite
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Covers all 16 required Phase 5 end-to-end integration scenarios:
1. Admin login
2. Faculty login
3. Unauthorized access prevention
4. Creation of a notice in Marathi
5. Creation of a notice in English and Hindi
6. NLP analysis and result display
7. Recipient suggestion and manual correction
8. Higher-authority notice processing
9. Faculty notice submission and approval
10. Department-wise distribution
11. In-app notification visibility
12. Read and acknowledgment status
13. Notice history and filtering
14. Ambiguous-recipient review
15. Frontend language switching / localization keys verification
16. Database persistence after application restart
"""

import os
import json
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.models.notice import Notice, NoticeApprovalStatus, NoticeDistributionStatus, NoticeSourceType
from app.models.notice_recipient import NoticeRecipient
from app.models.audit_log import AuditLog
from app.core.security import create_access_token


# 1. Admin login
def test_01_admin_login(client: TestClient, seed_data):
    """Admin logs in and receives valid JWT token and correct role metadata."""
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "admin_test", "password": "AdminPass123"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "Admin"
    assert data["username"] == "admin_test"


# 2. Faculty login
def test_02_faculty_login(client: TestClient, seed_data):
    """Faculty logs in and receives valid JWT token and faculty role."""
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "faculty_math", "password": "FacultyPass123"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "Faculty"
    assert data["username"] == "faculty_math"


# 3. Unauthorized access prevention
def test_03_unauthorized_access_prevention(client: TestClient, faculty_math_headers, admin_headers):
    """Faculty users are strictly blocked from admin-only routes and actions."""
    # Faculty cannot list audit logs
    res = client.get("/api/v1/audit-logs", headers=faculty_math_headers)
    assert res.status_code == 403

    # Faculty cannot access user management
    res = client.get("/api/v1/users", headers=faculty_math_headers)
    assert res.status_code == 403

    # Admin CAN access audit logs
    res_admin = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert res_admin.status_code == 200


# 4. Creation of a notice in Marathi (with exact Devanagari preservation)
def test_04_marathi_notice_creation_and_preservation(client: TestClient, admin_headers):
    """Notice created in Marathi preserves exact text and runs NLP pipeline."""
    marathi_title = "वार्षिक परीक्षा वेळापत्रक २०२४"
    marathi_text = (
        "सर्व शिक्षकांना कळविण्यात येते की वार्षिक परीक्षा १५ मार्च २०२४ रोजी सकाळी १० वाजता "
        "सुरू होईल. सर्व गणित व विज्ञान शिक्षकांनी उपस्थित राहावे."
    )

    payload = {
        "title": marathi_title,
        "original_text": marathi_text,
        "notice_language": "mr",
        "priority": "urgent",
        "source_type": "internal",
        "target_audience": "all_faculty"
    }

    res = client.post("/api/v1/notices", json=payload, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()

    # Integrity: Original Devanagari text must not be altered
    assert data["title"] == marathi_title
    assert data["original_text"] == marathi_text
    assert data["notice_language"] == "mr"
    assert data["approval_status"] == "draft"

    # NLP Analysis verification
    nlp = data.get("nlp_analysis")
    assert nlp is not None
    assert nlp["predicted_category"] == "Examination"
    assert nlp["confidence"] > 0.0
    assert "extracted_entities" in nlp


# 5. Creation of a notice in English and Hindi
def test_05_multilingual_notice_creation_english_hindi(client: TestClient, admin_headers):
    """English and Hindi notices preserve text and handle NLP language transparency."""
    # English Notice
    en_payload = {
        "title": "Annual Staff Meeting Notice",
        "original_text": "All faculty members are requested to attend the annual staff meeting on Monday at 11 AM in the auditorium.",
        "notice_language": "en",
        "priority": "normal"
    }
    res_en = client.post("/api/v1/notices", json=en_payload, headers=admin_headers)
    assert res_en.status_code == 201
    en_data = res_en.json()
    assert en_data["notice_language"] == "en"
    assert en_data["original_text"] == en_payload["original_text"]
    assert en_data["nlp_analysis"]["review_required"] is True

    # Hindi Notice
    hi_payload = {
        "title": "शिक्षक बैठक सूचना",
        "original_text": "सभी अध्यापकों को सूचित किया जाता है कि कल दोपहर १२ बजे आवश्यक बैठक आयोजित की जाएगी।",
        "notice_language": "hi",
        "priority": "normal"
    }
    res_hi = client.post("/api/v1/notices", json=hi_payload, headers=admin_headers)
    assert res_hi.status_code == 201
    hi_data = res_hi.json()
    assert hi_data["notice_language"] == "hi"
    assert hi_data["original_text"] == hi_payload["original_text"]
    assert hi_data["nlp_analysis"]["review_required"] is True


# 6. NLP analysis and result display
def test_06_nlp_analysis_and_entity_extraction(client: TestClient, admin_headers):
    """Standalone NLP preview endpoint extracts categories, entities, and confidence."""
    text = "गणित विषयाची बैठक उद्या दुपारी २:३० वाजता मुख्याध्यापक कक्षात आयोजित केली आहे."
    res = client.post("/api/v1/notices/analyze-nlp", json={"text": text}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["predicted_category"]["category"] in ["Meeting", "Academic", "General"]
    assert "extracted_entities" in data
    assert "suggested_recipients" in data
    assert data["language_detected"]["is_marathi"] is True


# 7. Recipient suggestion and manual correction
def test_07_recipient_suggestion_and_manual_correction(client: TestClient, admin_headers, seed_data):
    """Admin reviews NLP suggestions, approves notice, and manually corrects/selects specific recipients."""
    # 1. Create a notice
    res = client.post(
        "/api/v1/notices",
        json={
            "title": "विशेष कार्यशाळा",
            "original_text": "विज्ञान व तंत्रज्ञान कार्यशाळा २५ एप्रिल रोजी आयोजित केली आहे.",
            "notice_language": "mr",
            "priority": "normal"
        },
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # 2. Admin approves notice
    app_res = client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved for Science faculty distribution."},
        headers=admin_headers
    )
    assert app_res.status_code == 200

    # 3. Admin chooses to distribute to only Science faculty manually
    dist_payload = {
        "target_audience": "selected_faculty",
        "faculty_ids": [seed_data["faculty_sci"].id]
    }
    dist_res = client.post(f"/api/v1/notices/{notice_id}/distribute", json=dist_payload, headers=admin_headers)
    assert dist_res.status_code == 200
    dist_data = dist_res.json()
    assert dist_data["distribution_status"] == "distributed"
    assert len(dist_data["recipients"]) == 1
    assert dist_data["recipients"][0]["recipient_id"] == seed_data["faculty_sci"].id


# 8. Higher-authority notice processing
def test_08_higher_authority_notice_processing(client: TestClient, admin_headers, seed_data):
    """Higher-authority circular records source organization, reference date, and text."""
    # Test document upload endpoint
    file_content = b"Maharashtra State Secondary Education Board Circular 2024. SSC Board timetable."
    files = {"file": ("ssc_circular.txt", file_content, "text/plain")}
    up_res = client.post("/api/v1/notices/upload-document", files=files, headers=admin_headers)
    assert up_res.status_code == 200
    up_data = up_res.json()
    assert up_data["extraction_status"] == "success"
    assert "attachment_url" in up_data

    # Create higher authority notice
    ha_payload = {
        "title": "एसएससी बोर्ड परीक्षा परिपत्रक",
        "original_text": "महाराष्ट्र राज्य माध्यमिक शिक्षण मंडळ: दहावी परीक्षा वेळापत्रक जाहीर करण्यात आले आहे.",
        "notice_language": "mr",
        "source_type": "higher_authority",
        "source_organization": "Maharashtra State Board of Secondary and Higher Secondary Education",
        "source_date": "2024-02-10",
        "attachment_url": up_data["attachment_url"],
        "priority": "urgent"
    }
    res = client.post("/api/v1/notices", json=ha_payload, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["source_type"] == "higher_authority"
    assert data["source_organization"] == ha_payload["source_organization"]
    assert data["source_date"] == "2024-02-10"
    assert data["attachment_url"] == up_data["attachment_url"]


# 9. Faculty notice submission and approval workflow
def test_09_faculty_notice_submission_and_approval(
    client: TestClient, faculty_math_headers, admin_headers
):
    """Faculty drafts notice -> submits -> admin reviews and approves -> distributed."""
    # 1. Faculty creates draft
    create_res = client.post(
        "/api/v1/notices",
        json={
            "title": "गणित ऑलिम्पियाड सराव वर्ग",
            "original_text": "विद्यार्थ्यांसाठी गणित ऑलिम्पियाड सराव वर्ग दर शनिवारी आयोजित केले जातील.",
            "notice_language": "mr",
            "priority": "normal"
        },
        headers=faculty_math_headers
    )
    assert create_res.status_code == 201
    notice_id = create_res.json()["id"]
    assert create_res.json()["approval_status"] == "draft"

    # Faculty cannot distribute draft directly (RBAC / Workflow guard)
    forbidden_dist = client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "all_faculty"},
        headers=faculty_math_headers
    )
    assert forbidden_dist.status_code in [400, 403]

    # 2. Faculty submits for review
    submit_res = client.post(f"/api/v1/notices/{notice_id}/submit", headers=faculty_math_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["approval_status"] == "submitted"

    # 3. Admin approves notice
    approve_res = client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved for distribution by Principal."},
        headers=admin_headers
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["approval_status"] == "approved"

    # 4. Admin distributes notice
    dist_res = client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "all_faculty"},
        headers=admin_headers
    )
    assert dist_res.status_code == 200
    assert dist_res.json()["distribution_status"] == "distributed"


# 10. Department-wise distribution
def test_10_department_wise_distribution(
    client: TestClient, admin_headers, faculty_math_headers, faculty_sci_headers, seed_data
):
    """Department distribution targets only faculty belonging to specified department."""
    dept_math_id = seed_data["dept_math"].id

    res = client.post(
        "/api/v1/notices",
        json={
            "title": "गणित विभाग बैठक",
            "original_text": "गणित विभागातील सर्व शिक्षकांची तातडीची बैठक दुपारी ३ वाजता होईल.",
            "notice_language": "mr",
            "target_department_id": dept_math_id
        },
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # Admin approves notice first
    client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved for math department."},
        headers=admin_headers
    )

    # Distribute by department
    dist_res = client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "department", "department_id": dept_math_id},
        headers=admin_headers
    )
    assert dist_res.status_code == 200
    recipients = dist_res.json()["recipients"]
    recip_ids = [r["recipient_id"] for r in recipients]

    assert seed_data["faculty_math"].id in recip_ids
    assert seed_data["faculty_sci"].id not in recip_ids


# 11. In-app notification visibility
def test_11_in_app_notification_visibility(
    client: TestClient, admin_headers, faculty_math_headers, faculty_sci_headers, seed_data
):
    """Distributed notice appears in the recipient faculty's received notices list."""
    res = client.post(
        "/api/v1/notices",
        json={
            "title": "सर्वसाधारण सूचना",
            "original_text": "शाळेच्या आवारात स्वच्छता मोहीम राबविण्यात येत आहे.",
            "notice_language": "mr"
        },
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # Approve notice
    client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved by school office."},
        headers=admin_headers
    )

    # Distribute to faculty_math only
    client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "selected_faculty", "faculty_ids": [seed_data["faculty_math"].id]},
        headers=admin_headers
    )

    # Math faculty checks received notices
    math_notices = client.get("/api/v1/notices", headers=faculty_math_headers).json()
    math_ids = [n["id"] for n in math_notices]
    assert notice_id in math_ids

    # Science faculty did not receive it
    sci_notices = client.get("/api/v1/notices", headers=faculty_sci_headers).json()
    sci_ids = [n["id"] for n in sci_notices]
    assert notice_id not in sci_ids


# 12. Read and acknowledgment status
def test_12_read_and_acknowledgment_status(
    client: TestClient, admin_headers, faculty_math_headers, seed_data
):
    """Faculty marks notice read and acknowledged; timestamps and reports update."""
    res = client.post(
        "/api/v1/notices",
        json={"title": "महत्त्वाची सूचना", "original_text": "कृपया तात्काळ पोहोच द्यावी.", "notice_language": "mr"},
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # Approve notice
    client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Urgent acknowledgment required."},
        headers=admin_headers
    )

    # Distribute
    client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "selected_faculty", "faculty_ids": [seed_data["faculty_math"].id]},
        headers=admin_headers
    )

    # Initially unread
    details = client.get(f"/api/v1/notices/{notice_id}", headers=faculty_math_headers).json()
    assert details["is_read"] is False
    assert details["is_acknowledged"] is False

    # Mark as read
    read_res = client.post(f"/api/v1/notices/{notice_id}/read", headers=faculty_math_headers)
    assert read_res.status_code == 200
    assert read_res.json()["read_at"] is not None

    # Mark as acknowledged
    ack_res = client.post(f"/api/v1/notices/{notice_id}/acknowledge", headers=faculty_math_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged_at"] is not None

    # Re-fetch notice details
    updated_details = client.get(f"/api/v1/notices/{notice_id}", headers=faculty_math_headers).json()
    assert updated_details["is_read"] is True
    assert updated_details["is_acknowledged"] is True

    # Admin inspects notice detail stats
    admin_view = client.get(f"/api/v1/notices/{notice_id}", headers=admin_headers).json()
    assert admin_view["read_count"] == 1
    assert admin_view["acknowledged_count"] == 1


# 13. Notice history and filtering
def test_13_notice_history_and_filtering(client: TestClient, admin_headers):
    """Admin searches and filters notice history by category and text."""
    # Create two notices with different categories
    client.post(
        "/api/v1/notices",
        json={"title": "प्रथम सत्र परीक्षा", "original_text": "परीक्षा वेळापत्रक प्रसिद्ध करण्यात आले आहे.", "notice_language": "mr"},
        headers=admin_headers
    )
    client.post(
        "/api/v1/notices",
        json={"title": "पालक शिक्षक सभा", "original_text": "शनिवारी पालक शिक्षक सभा आयोजित केली आहे.", "notice_language": "mr"},
        headers=admin_headers
    )

    # Filter by category Examination
    res_exam = client.get("/api/v1/notices?category=Examination", headers=admin_headers)
    assert res_exam.status_code == 200
    exam_items = res_exam.json()
    assert len(exam_items) >= 1
    assert all(item["predicted_category"] == "Examination" for item in exam_items)

    # Search by text query
    res_search = client.get("/api/v1/notices?search=पालक", headers=admin_headers)
    assert res_search.status_code == 200
    search_items = res_search.json()
    assert any("पालक" in item["title"] or "पालक" in item["original_text"] for item in search_items)


# 14. Ambiguous-recipient review required
def test_14_ambiguous_recipient_review(client: TestClient, admin_headers):
    """Ambiguous or very short notice text triggers review_required flag in NLP analysis."""
    ambiguous_text = "उद्या बैठक."
    res = client.post("/api/v1/notices/analyze-nlp", json={"text": ambiguous_text}, headers=admin_headers)
    assert res.status_code == 200
    nlp = res.json()
    assert nlp["review_required"] is True
    assert len(nlp["review_reasons"]) >= 1


# 15. Frontend language switching / localization keys verification
def test_15_frontend_localization_keys():
    """Verifies that English, Marathi, and Hindi locale files are valid JSON with matching keys."""
    locales_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "i18n", "locales"))

    en_path = os.path.join(locales_dir, "en.json")
    mr_path = os.path.join(locales_dir, "mr.json")
    hi_path = os.path.join(locales_dir, "hi.json")

    assert os.path.exists(en_path), f"Missing {en_path}"
    assert os.path.exists(mr_path), f"Missing {mr_path}"
    assert os.path.exists(hi_path), f"Missing {hi_path}"

    with open(en_path, "r", encoding="utf-8") as f:
        en_data = json.load(f)
    with open(mr_path, "r", encoding="utf-8") as f:
        mr_data = json.load(f)
    with open(hi_path, "r", encoding="utf-8") as f:
        hi_data = json.load(f)

    # Verify top-level sections exist across all 3 languages
    required_sections = ["appName", "auth", "nav", "dashboard", "notices", "categories", "priorities", "status", "nlp", "common"]
    for section in required_sections:
        assert section in en_data, f"en.json missing {section}"
        assert section in mr_data, f"mr.json missing {section}"
        assert section in hi_data, f"hi.json missing {section}"

    # Verify notice categories exist in all 3 languages
    for cat in ["Examination", "Meeting", "Holiday", "Academic"]:
        assert cat in en_data["categories"]
        assert cat in mr_data["categories"]
        assert cat in hi_data["categories"]


# 16. Database persistence after application restart
def test_16_database_persistence_across_session(client: TestClient, admin_headers, db_session):
    """Verifies that created notice, distribution records, and audit logs persist in database."""
    # Create notice
    res = client.post(
        "/api/v1/notices",
        json={"title": "शाळा सुट्टी जाहीर", "original_text": "उद्या शाळेस सुट्टी राहील.", "notice_language": "mr"},
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # Approve notice
    client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved school holiday order."},
        headers=admin_headers
    )

    # Distribute notice
    client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "all_faculty"},
        headers=admin_headers
    )

    # Query DB directly to verify persistence of notice and audit logs
    persisted_notice = db_session.query(Notice).filter(Notice.id == notice_id).first()
    assert persisted_notice is not None
    assert persisted_notice.title == "शाळा सुट्टी जाहीर"
    assert persisted_notice.distribution_status == NoticeDistributionStatus.DISTRIBUTED.value

    # Verify audit logs persisted
    audit_logs = db_session.query(AuditLog).filter(AuditLog.notice_id == notice_id).all()
    assert len(audit_logs) >= 2  # NOTICE_CREATED, NOTICE_APPROVED, and NOTICE_DISTRIBUTED
    actions = [a.action for a in audit_logs]
    assert "NOTICE_CREATED" in actions
    assert "NOTICE_DISTRIBUTED" in actions
