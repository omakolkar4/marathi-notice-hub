"""
Notice Lifecycle, Approval, Distribution, and Acknowledgment Tests
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest


def test_notice_creation_with_nlp_trigger(client, faculty_math_headers):
    payload = {
        "title": "वार्षिक क्रीडा स्पर्धा २०२४ बाबत सूचना",
        "original_text": "सर्व शिक्षक व विद्यार्थ्यांना सूचित करण्यात येते की, शाळेच्या वार्षिक क्रीडा स्पर्धा दिनांक १५ व १६ डिसेंबर रोजी आयोजित करण्यात आल्या आहेत. सर्व वर्गशिक्षकांनी आपापल्या वर्गातील खेळाडूंची यादी क्रीडा शिक्षकांकडे १२ डिसेंबर पर्यंत सादर करावी.",
        "priority": "normal"
    }
    response = client.post("/api/v1/notices", json=payload, headers=faculty_math_headers)
    assert response.status_code == 201
    data = response.json()

    assert data["title"] == payload["title"]
    assert data["approval_status"] == "draft"
    assert data["distribution_status"] == "pending"

    # Verify automated NLP analysis was executed and attached
    assert data["nlp_analysis"] is not None
    nlp = data["nlp_analysis"]
    assert nlp["predicted_category"] != ""
    assert len(nlp["suggested_recipients"]) >= 1
    assert "dates" in nlp["extracted_entities"]
    assert "deadlines" in nlp["extracted_entities"]


def test_notice_update_and_nlp_reanalysis(client, faculty_math_headers):
    # 1. Create notice draft
    create_res = client.post(
        "/api/v1/notices",
        json={"title": "Original Draft", "original_text": "प्राथमिक मसुदा मजकूर."},
        headers=faculty_math_headers
    )
    notice_id = create_res.json()["id"]

    # 2. Update notice text
    updated_text = "सर्व गणित शिक्षकांनी शुक्रवार रोजी दुपारी २:०० वाजता बैठकीस उपस्थित राहावे."
    update_res = client.put(
        f"/api/v1/notices/{notice_id}",
        json={"title": "Updated Meeting Notice", "original_text": updated_text},
        headers=faculty_math_headers
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["title"] == "Updated Meeting Notice"
    assert data["nlp_analysis"]["normalized_text"] == updated_text
    assert any(r["recipient_type"] == "SUBJECT_TEACHER" for r in data["nlp_analysis"]["suggested_recipients"])


def test_notice_submission_and_lock(client, faculty_math_headers):
    # 1. Create draft
    create_res = client.post(
        "/api/v1/notices",
        json={"title": "Draft to Submit", "original_text": "सर्व शिक्षकांची मासिक बैठक उद्या होईल."},
        headers=faculty_math_headers
    )
    notice_id = create_res.json()["id"]
    assert create_res.json()["approval_status"] == "draft"

    # 2. Submit notice
    submit_res = client.post(f"/api/v1/notices/{notice_id}/submit", headers=faculty_math_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["approval_status"] == "submitted"

    # 3. Verify cannot edit while submitted
    edit_res = client.put(
        f"/api/v1/notices/{notice_id}",
        json={"title": "Attempt to edit submitted notice"},
        headers=faculty_math_headers
    )
    assert edit_res.status_code == 400
    assert "Only drafts or returned notices can be edited" in edit_res.json()["detail"]


def test_notice_approval_and_rejection_by_admin(client, admin_headers, faculty_math_headers):
    # 1. Faculty creates and submits notice
    res = client.post(
        "/api/v1/notices",
        json={"title": "Exam Duty Notice", "original_text": "सर्व परीक्षा पर्यवेक्षकांनी परीक्षा कक्षात वेळेवर पोहोचावे."},
        headers=faculty_math_headers
    )
    notice_id = res.json()["id"]
    client.post(f"/api/v1/notices/{notice_id}/submit", headers=faculty_math_headers)

    # 2. Faculty cannot approve notice
    fac_approve_res = client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Faculty trying to self-approve"},
        headers=faculty_math_headers
    )
    assert fac_approve_res.status_code == 403

    # 3. Admin approves notice
    admin_approve_res = client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Approved by Principal for immediate distribution."},
        headers=admin_headers
    )
    assert admin_approve_res.status_code == 200
    data = admin_approve_res.json()
    assert data["approval_status"] == "approved"
    assert len(data["approvals"]) == 1
    assert data["approvals"][0]["decision"] == "approved"
    assert "Principal" in data["approvals"][0]["comment"]


def test_notice_distribution_and_acknowledgment(client, admin_headers, faculty_math_headers, faculty_sci_headers, seed_data):
    # 1. Admin creates and approves notice
    create_res = client.post(
        "/api/v1/notices",
        json={"title": "School Closure", "original_text": "उद्या अतिवृष्टीमुळे शाळा बंद राहील."},
        headers=admin_headers
    )
    notice_id = create_res.json()["id"]

    # Direct approval
    client.post(
        f"/api/v1/notices/{notice_id}/approve",
        json={"decision": "approved", "comment": "Emergency school order."},
        headers=admin_headers
    )

    # 2. Distribute to all faculty
    dist_res = client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "all_faculty"},
        headers=admin_headers
    )
    assert dist_res.status_code == 200
    assert dist_res.json()["distribution_status"] == "distributed"
    assert dist_res.json()["recipient_count"] >= 2

    # 3. Faculty Math can now see this distributed notice in their notice list
    list_res = client.get("/api/v1/notices", headers=faculty_math_headers)
    assert list_res.status_code == 200
    notice_ids = [n["id"] for n in list_res.json()]
    assert notice_id in notice_ids

    # 4. Faculty Math marks as read
    read_res = client.post(f"/api/v1/notices/{notice_id}/read", headers=faculty_math_headers)
    assert read_res.status_code == 200
    assert read_res.json()["read_at"] is not None

    # 5. Faculty Math acknowledges receipt
    ack_res = client.post(f"/api/v1/notices/{notice_id}/acknowledge", headers=faculty_math_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged_at"] is not None

    # 6. Admin checks notice detail stats
    detail_res = client.get(f"/api/v1/notices/{notice_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    stats = detail_res.json()
    assert stats["recipient_count"] >= 2
    assert stats["read_count"] >= 1
    assert stats["acknowledged_count"] >= 1


def test_cannot_distribute_unapproved_notice(client, admin_headers):
    # Create draft notice
    res = client.post(
        "/api/v1/notices",
        json={"title": "Draft Notice", "original_text": "सूचना मजकूर"},
        headers=admin_headers
    )
    notice_id = res.json()["id"]

    # Attempt distribution without approval
    dist_res = client.post(
        f"/api/v1/notices/{notice_id}/distribute",
        json={"target_audience": "all_faculty"},
        headers=admin_headers
    )
    assert dist_res.status_code == 400
    assert "Notice must be 'approved' before distribution" in dist_res.json()["detail"]


def test_notice_validation_empty_inputs(client, faculty_math_headers):
    res_empty_title = client.post(
        "/api/v1/notices",
        json={"title": "   ", "original_text": "काही मजकूर"},
        headers=faculty_math_headers
    )
    assert res_empty_title.status_code == 400

    res_empty_text = client.post(
        "/api/v1/notices",
        json={"title": "Valid Title", "original_text": "   "},
        headers=faculty_math_headers
    )
    assert res_empty_text.status_code == 400
