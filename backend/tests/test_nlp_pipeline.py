"""
Comprehensive Automated Test Suite for Marathi Notice Hub NLP Pipeline
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import pytest
from app.nlp.preprocessing import (
    clean_marathi_text,
    marathi_to_english_digits,
    tokenize_marathi,
    detect_devanagari_ratio,
    is_probable_marathi
)
from app.nlp.classification import classify_notice, CATEGORIES, load_classifier
from app.nlp.recipient_detection import detect_recipients
from app.nlp.entity_extraction import extract_entities, extract_dates, extract_times
from app.services.nlp_service import nlp_service


# =====================================================================
# 1. PREPROCESSING TESTS
# =====================================================================

def test_clean_marathi_text_basic():
    raw = "  सर्व   शिक्षक व    विद्यार्थ्यांना सूचना... \n\n उद्या शाळा बंद राहील!!  "
    cleaned = clean_marathi_text(raw)
    assert "सर्व शिक्षक व विद्यार्थ्यांना सूचना" in cleaned
    assert "  " not in cleaned
    assert "!!" not in cleaned


def test_clean_marathi_text_empty_and_invalid():
    assert clean_marathi_text("") == ""
    assert clean_marathi_text(None) == ""
    assert clean_marathi_text("   \t\n  ") == ""


def test_marathi_digits_conversion():
    text = "दिनांक १५/०८/२०२४ रोजी सकाळी १०:३० वाजता"
    converted = marathi_to_english_digits(text)
    assert "15/08/2024" in converted
    assert "10:30" in converted


def test_tokenize_marathi():
    text = "सर्व गणित शिक्षकांची बैठक PTA हॉलमध्ये होईल."
    tokens = tokenize_marathi(text)
    assert "सर्व" in tokens
    assert "गणित" in tokens
    assert "शिक्षकांची" in tokens
    assert "PTA" in tokens
    assert "हॉलमध्ये" in tokens


def test_devanagari_ratio():
    pure_marathi = "शाळेच्या वार्षिक क्रीडा स्पर्धा"
    assert detect_devanagari_ratio(pure_marathi) > 0.95

    mixed = "10th Std SSC Board Exam Timetable"
    assert detect_devanagari_ratio(mixed) < 0.10

    is_mr, ratio = is_probable_marathi("इयत्ता 10th SSC बोर्ड परीक्षा")
    assert is_mr is True
    assert ratio > 0.40


# =====================================================================
# 2. NOTICE CLASSIFICATION TESTS (Machine Learning)
# =====================================================================

def test_classifier_loads_and_runs():
    pipeline = load_classifier()
    assert pipeline is not None, "Model artifact should be loaded"

    notice = "इयत्ता १० वी ची प्रथम सत्र परीक्षा पुढील सोमवारी सुरू होत आहे."
    result = classify_notice(notice)

    assert result["category"] in CATEGORIES
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["is_fallback"] is False
    assert len(result["probabilities"]) == len(CATEGORIES)

    # Probabilities should sum to approximately 1.0
    prob_sum = sum(result["probabilities"].values())
    assert 0.98 <= prob_sum <= 1.02


def test_classifier_empty_input_fallback():
    result = classify_notice("")
    assert result["category"] == "General"
    assert result["confidence"] == 0.0
    assert result["is_fallback"] is True


# =====================================================================
# 3. RECIPIENT IDENTIFICATION TESTS (Independent Rule Verification)
# =====================================================================

def test_recipient_case_1_math_teachers():
    """Case 1: Mathematics teachers meeting on Friday at 2 PM."""
    text = "सर्व गणित शिक्षकांनी शुक्रवार रोजी दुपारी २:०० वाजता मुख्याध्यापक कार्यालयात बैठकीस उपस्थित राहावे."
    recipients = detect_recipients(text)
    assert len(recipients) >= 1
    math_match = next((r for r in recipients if r["recipient_type"] == "SUBJECT_TEACHER"), None)
    assert math_match is not None
    assert math_match["department_or_subject"] == "Mathematics"
    assert math_match["requires_manual_review"] is False


def test_recipient_case_2_all_faculty():
    """Case 2: All faculty members must attend a school meeting."""
    text = "शाळेतील सर्व शिक्षकांची मासिक आढावा बैठक उद्या सभागृहात आयोजित करण्यात आली आहे."
    recipients = detect_recipients(text)
    assert any(r["recipient_type"] == "ALL_FACULTY" for r in recipients)


def test_recipient_case_3_school_closed_tomorrow():
    """Case 3: The school will remain closed tomorrow (no recipient explicitly addressed)."""
    text = "अतिवृष्टीमुळे उद्या दिनांक १० जुलै रोजी शाळेस सुट्टी जाहीर करण्यात आली आहे."
    recipients = detect_recipients(text)
    assert len(recipients) == 1
    assert recipients[0]["recipient_type"] == "UNKNOWN"
    assert recipients[0]["requires_manual_review"] is True


def test_recipient_case_4_assigned_exam_faculty():
    """Case 4: Examination-related instructions for supervisors and department."""
    text = "सर्व परीक्षा पर्यवेक्षकांनी प्रश्नपत्रिका परीक्षा विभागात वेळेवर जमा कराव्यात."
    recipients = detect_recipients(text)
    types = [r["recipient_type"] for r in recipients]
    assert "EXAM_SUPERVISOR" in types or "DEPARTMENT" in types


def test_recipient_case_5_unclear_notice():
    """Case 5: A notice whose recipient is unclear."""
    text = "शाळेच्या नवीन इमारतीचे रंगकाम पूर्ण झाले असून परिसर स्वच्छ ठेवावा."
    recipients = detect_recipients(text)
    assert recipients[0]["recipient_type"] == "UNKNOWN"
    assert recipients[0]["requires_manual_review"] is True


def test_recipient_ambiguous_subject_teacher():
    """Notice addresses 'subject teachers' without naming the subject."""
    text = "संबंधित विषय शिक्षकांनी विद्यार्थ्यांचे अंतर्गत गुण मुख्याध्यापकांकडे सादर करावेत."
    recipients = detect_recipients(text)
    subj_match = next((r for r in recipients if r["recipient_type"] == "SUBJECT_TEACHER"), None)
    assert subj_match is not None
    assert subj_match["requires_manual_review"] is True


# =====================================================================
# 4. ENTITY EXTRACTION TESTS
# =====================================================================

def test_extract_dates_marathi_calendar():
    text = "दिनांक १५ ऑगस्ट रोजी स्वातंत्र्य दिन साजरा होईल आणि २५ नोव्हेंबर रोजी निकाल लागेल."
    dates = extract_dates(text)
    assert len(dates) >= 2
    raws = [d["raw_text"] for d in dates]
    assert any("१५ ऑगस्ट" in r or "15 ऑगस्ट" in r for r in raws)
    assert any("२५ नोव्हेंबर" in r or "25 नोव्हेंबर" in r for r in raws)


def test_extract_times():
    text = "बैठक उद्या दुपारी २:०० वाजता सुरू होईल आणि सकाळी १०:३० वाजता हजेरी घेतली जाईल."
    times = extract_times(text)
    assert len(times) >= 2
    raw_texts = [t["raw_text"] for t in times]
    assert any("२:००" in r or "2:00" in r for r in raw_texts)


def test_extract_entities_full():
    text = "गणित विषयाची घटक चाचणी दिनांक १५ ऑक्टोबर रोजी परीक्षा विभाग घेईल. सर्व शिक्षकांनी १० तारखेपर्यंत अहवाल द्यावा."
    entities = extract_entities(text)
    assert "गणित" in entities["subjects"]
    assert "परीक्षा विभाग" in entities["departments"]
    assert len(entities["dates"]) >= 1
    assert len(entities["deadlines"]) >= 1


# =====================================================================
# 5. UNIFIED NLP SERVICE TESTS
# =====================================================================

def test_unified_service_empty_input():
    result = nlp_service.process_notice("")
    assert result["review_required"] is True
    assert result["language_detected"]["is_marathi"] is False


def test_unified_service_mixed_marathi_english():
    text = "10th Std SSC Board Exam Hall Tickets वाटप शनिवार दिनांक २० रोजी दुपारी १२:०० वाजता होईल."
    result = nlp_service.process_notice(text)
    assert result["language_detected"]["code"] in ["mr", "mr-mixed"]
    assert len(result["extracted_entities"]["dates"]) >= 1
    assert len(result["extracted_entities"]["times"]) >= 1


def test_unified_service_realistic_notice_end_to_end():
    text = "सर्व गणित शिक्षकांनी शुक्रवार रोजी दुपारी २:०० वाजता मुख्याध्यापक कार्यालयात बैठकीस उपस्थित राहावे."
    result = nlp_service.process_notice(text)

    assert result["normalized_text"] != ""
    assert result["language_detected"]["is_marathi"] is True
    assert "category" in result["predicted_category"]
    assert len(result["suggested_recipients"]) >= 1

    recipient = result["suggested_recipients"][0]
    assert recipient["recipient_type"] == "SUBJECT_TEACHER"
    assert recipient["department_or_subject"] == "Mathematics"

    # Entities
    assert any(t["time"] == "2:00" or "२:००" in t["raw_text"] for t in result["extracted_entities"]["times"])
    assert "गणित" in result["extracted_entities"]["subjects"]
