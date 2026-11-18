"""
Backend NLP Integration and Analysis Tests
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest


def test_analyze_nlp_preview_endpoint(client, faculty_math_headers):
    payload = {
        "text": "सर्व गणित शिक्षकांनी शुक्रवार रोजी दुपारी २:०० वाजता मुख्याध्यापक कार्यालयात बैठकीस उपस्थित राहावे."
    }
    response = client.post("/api/v1/notices/analyze-nlp", json=payload, headers=faculty_math_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["language_detected"]["is_marathi"] is True
    assert data["predicted_category"]["category"] != ""
    assert any(r["recipient_type"] == "SUBJECT_TEACHER" for r in data["suggested_recipients"])
    assert "2:00" in [t["time"] for t in data["extracted_entities"]["times"]]


def test_analyze_nlp_empty_payload(client, faculty_math_headers):
    response = client.post("/api/v1/notices/analyze-nlp", json={"text": "   "}, headers=faculty_math_headers)
    assert response.status_code == 400
    assert "Notice text is required" in response.json()["detail"]


def test_ambiguous_notice_triggers_review_required(client, faculty_math_headers):
    payload = {
        "title": "परिसर स्वच्छता",
        "original_text": "शाळेच्या नवीन इमारतीचे रंगकाम पूर्ण झाले असून परिसर स्वच्छ ठेवावा."
    }
    response = client.post("/api/v1/notices", json=payload, headers=faculty_math_headers)
    assert response.status_code == 201
    data = response.json()

    nlp = data["nlp_analysis"]
    assert nlp["review_required"] is True
    assert len(nlp["review_reasons"]) >= 1
    assert any("recipient" in reason.lower() for reason in nlp["review_reasons"])


def test_notice_filtering_by_category_and_search(client, admin_headers):
    # 1. Create Examination notice
    client.post(
        "/api/v1/notices",
        json={"title": "इयत्ता १० वी ची प्रथम सत्र परीक्षा", "original_text": "परीक्षा वेळापत्रक नोटीस बोर्डवर प्रसिद्ध करण्यात आले आहे."},
        headers=admin_headers
    )

    # 2. Create Meeting notice
    client.post(
        "/api/v1/notices",
        json={"title": "पालक-शिक्षक सभा", "original_text": "शनिवार रोजी सकाळी १० वाजता पालक सभा आयोजित केली आहे."},
        headers=admin_headers
    )

    # Filter by search term "वेळापत्रक"
    res_search = client.get("/api/v1/notices?search=वेळापत्रक", headers=admin_headers)
    assert res_search.status_code == 200
    assert len(res_search.json()) >= 1
    assert any("वेळापत्रक" in n["title"] or "वेळापत्रक" in n["original_text"] for n in res_search.json())
