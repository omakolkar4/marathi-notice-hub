"""
Notice Recipient Detection Module
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Extracts and identifies intended recipients from Marathi notice text using transparent,
deterministic linguistic rules, keyword matching, and school role taxonomies.
"""

import re
from typing import Dict, List, Optional, Any

from app.nlp.preprocessing import clean_marathi_text

# Subject name mappings (Marathi term -> Standardized English name)
SUBJECT_MAP: Dict[str, str] = {
    "गणित": "Mathematics",
    "विज्ञान": "Science",
    "इंग्रजी": "English",
    "मराठी": "Marathi",
    "हिंदी": "Hindi",
    "इतिहास": "History",
    "भूगोल": "Geography",
    "सामाजिक शास्त्रे": "Social Sciences",
    "क्रीडा": "Sports / Physical Education",
    "शारीरिक शिक्षण": "Sports / Physical Education",
    "कला": "Arts",
    "चित्रकला": "Drawing / Fine Arts",
    "संस्कृत": "Sanskrit",
    "संगणक": "Computer Science",
}

# Department mappings (Marathi term -> Standardized English name)
DEPARTMENT_MAP: Dict[str, str] = {
    "परीक्षा": "Examination Department",
    "क्रीडा": "Sports Department",
    "सांस्कृतिक": "Cultural Department",
    "विज्ञान": "Science Department",
    "ग्रंथालय": "Library Department",
    "लेखा": "Accounts Department",
    "कार्यालयीन": "Administrative Office",
    "प्रशासकीय": "Administrative Department",
}


def detect_recipients(text: str) -> List[Dict[str, Any]]:
    """
    Identifies target recipients from Marathi notice text.
    Returns a list of structured recipient findings.
    If no recipient or ambiguous cues are found, returns a record with
    recipient_type='UNKNOWN' and requires_manual_review=True.
    """
    cleaned = clean_marathi_text(text)
    if not cleaned:
        return [{
            "detected_phrase": None,
            "recipient_type": "UNKNOWN",
            "department_or_subject": None,
            "detection_method": "empty_input_fallback",
            "confidence": 0.0,
            "requires_manual_review": True,
            "explanation": "No text provided to detect recipients."
        }]

    detected_recipients: List[Dict[str, Any]] = []

    # 1. SPECIFIC SUBJECT TEACHERS (e.g., 'गणित शिक्षक', 'विज्ञान शिक्षकांनी', 'इंग्रजी विषय शिक्षक')
    subject_regex = (
        r'(' + '|'.join(re.escape(s) for s in SUBJECT_MAP.keys()) + r')'
        r'(?:\s+विषय)?\s+(?:शिक्षक|शिक्षकांना|शिक्षकांनी|प्राध्यापक|शिक्षकांकडे)'
    )
    for match in re.finditer(subject_regex, cleaned):
        matched_str = match.group(0)
        subj_key = match.group(1)
        standard_subj = SUBJECT_MAP.get(subj_key, subj_key)
        detected_recipients.append({
            "detected_phrase": matched_str,
            "recipient_type": "SUBJECT_TEACHER",
            "department_or_subject": standard_subj,
            "detection_method": "keyword_rule_matching",
            "confidence": 0.90,
            "requires_manual_review": False,
            "explanation": f"Detected specific subject teacher keyword '{matched_str}' for subject: {standard_subj}."
        })

    # Unspecified subject teachers ('विषय शिक्षकांनी', 'संबंधित विषय शिक्षक')
    unspecified_subj_match = re.search(r'(संबंधित\s+)?विषय\s+(शिक्षक|शिक्षकांना|शिक्षकांनी)', cleaned)
    if unspecified_subj_match and not any(r["recipient_type"] == "SUBJECT_TEACHER" for r in detected_recipients):
        detected_recipients.append({
            "detected_phrase": unspecified_subj_match.group(0),
            "recipient_type": "SUBJECT_TEACHER",
            "department_or_subject": "Unspecified Subject",
            "detection_method": "keyword_rule_matching",
            "confidence": 0.75,
            "requires_manual_review": True,
            "explanation": f"Notice refers to subject teachers ('{unspecified_subj_match.group(0)}') but specific subject is not stated."
        })

    # 2. ALL FACULTY / TEACHING STAFF
    all_faculty_patterns = [
        (r'सर्व\s+शिक्षक(?:\s+व\s+शिक्षकेतर\s+कर्मचारी)?(?:\s+वृंद)?(?:\s+आणि\s+विद्यार्थी)?', 0.92),
        (r'सर्व\s+शिक्षकवृंद(?:\s+आणि\s+कर्मचारी)?', 0.92),
        (r'सर्व\s+शिक्षकां(?:ना|नी)', 0.92),
        (r'समस्त\s+शिक्षक(?:वृंद)?', 0.90),
        (r'सर्व\s+प्राध्यापक(?:ांना)?', 0.90),
        (r'शाळेतील\s+सर्व\s+कर्मचाऱ्यांना', 0.88),
        (r'सर्व\s+स्टाफ', 0.85),
    ]
    for pattern, conf in all_faculty_patterns:
        match = re.search(pattern, cleaned)
        if match:
            # Check if already detected as all faculty
            if not any(r["recipient_type"] == "ALL_FACULTY" for r in detected_recipients):
                detected_recipients.append({
                    "detected_phrase": match.group(0),
                    "recipient_type": "ALL_FACULTY",
                    "department_or_subject": None,
                    "detection_method": "keyword_rule_matching",
                    "confidence": conf,
                    "requires_manual_review": False,
                    "explanation": f"Explicit broad faculty address detected: '{match.group(0)}'."
                })

    # 3. PRINCIPAL / HEADMASTER
    principal_match = re.search(r'(मुख्याध्यापक|प्राचार्य|उपमुख्याध्यापक|उपप्राचार्य)(?:ांकडे|ांच्या|ांशी|ांना)?', cleaned)
    if principal_match:
        # Check context: if addressed to or referencing principal
        phrase = principal_match.group(0)
        detected_recipients.append({
            "detected_phrase": phrase,
            "recipient_type": "PRINCIPAL",
            "department_or_subject": None,
            "detection_method": "keyword_rule_matching",
            "confidence": 0.85,
            "requires_manual_review": False,
            "explanation": f"Administrative head keyword detected: '{phrase}'."
        })

    # 4. DEPARTMENTS (e.g., 'परीक्षा विभाग', 'क्रीडा विभाग')
    dept_regex = r'(' + '|'.join(re.escape(d) for d in DEPARTMENT_MAP.keys()) + r')\s+विभाग(?:ाशी|ात|ाने|ास)?'
    for match in re.finditer(dept_regex, cleaned):
        matched_str = match.group(0)
        dept_key = match.group(1)
        standard_dept = DEPARTMENT_MAP.get(dept_key, dept_key)
        detected_recipients.append({
            "detected_phrase": matched_str,
            "recipient_type": "DEPARTMENT",
            "department_or_subject": standard_dept,
            "detection_method": "keyword_rule_matching",
            "confidence": 0.88,
            "requires_manual_review": False,
            "explanation": f"Institutional department addressed: '{matched_str}' ({standard_dept})."
        })

    # 5. SPECIFIC SCHOOL ROLES / SELECTED FACULTY
    role_patterns = [
        (r'(सर्व\s+)?वर्गशिक्षक(?:ांनी|ांकडे|ांना)?', "CLASS_TEACHER", "Class Teachers", 0.88, False),
        (r'(परीक्षा\s+)?पर्यवेक्षक(?:ांनी|ांना)?', "EXAM_SUPERVISOR", "Exam Invigilators / Supervisors", 0.85, False),
        (r'(?:क्रीडा|व्यवस्थापन|स्नेहसंमेलन)\s+समिती(?:च्या)?\s+सदस्य(?:ांनी|ांना)?', "COMMITTEE_MEMBERS", "Committee Members", 0.86, False),
        (r'प्रयोगशाळा\s+सहाय्यक(?:ांनी)?', "LAB_ASSISTANT", "Laboratory Assistants", 0.85, False),
        (r'ग्रंथपाल(?:ांनी)?', "LIBRARIAN", "Librarian", 0.85, False),
        (r'शिक्षकेतर\s+कर्मचारी(?:ांनी)?', "NON_TEACHING_STAFF", "Non-Teaching Staff", 0.86, False),
    ]
    for pattern, r_type, desc, conf, manual in role_patterns:
        match = re.search(pattern, cleaned)
        if match and not any(r["recipient_type"] == r_type for r in detected_recipients):
            detected_recipients.append({
                "detected_phrase": match.group(0),
                "recipient_type": r_type,
                "department_or_subject": desc,
                "detection_method": "keyword_rule_matching",
                "confidence": conf,
                "requires_manual_review": manual,
                "explanation": f"Specific school functional role identified: '{match.group(0)}' ({desc})."
            })

    # 6. PARENTS & STUDENTS
    parent_match = re.search(r'(सर्व\s+)?पालक(?:ांना|ांसाठी|ांनी)?', cleaned)
    if parent_match and not any(r["recipient_type"] == "PARENTS" for r in detected_recipients):
        detected_recipients.append({
            "detected_phrase": parent_match.group(0),
            "recipient_type": "PARENTS",
            "department_or_subject": "Parents / Guardians",
            "detection_method": "keyword_rule_matching",
            "confidence": 0.90,
            "requires_manual_review": False,
            "explanation": f"Parents addressed in notice: '{parent_match.group(0)}'."
        })

    student_match = re.search(r'(सर्व\s+)?विद्यार्थी(?:\s+व\s+विद्यार्थिनी)?(?:ांना|ांनी)?', cleaned)
    if student_match and not any(r["recipient_type"] == "STUDENTS" for r in detected_recipients):
        detected_recipients.append({
            "detected_phrase": student_match.group(0),
            "recipient_type": "STUDENTS",
            "department_or_subject": "Students",
            "detection_method": "keyword_rule_matching",
            "confidence": 0.88,
            "requires_manual_review": False,
            "explanation": f"Students addressed in notice: '{student_match.group(0)}'."
        })

    # 7. FALLBACK / UNKNOWN EVIDENCE
    if not detected_recipients:
        return [{
            "detected_phrase": None,
            "recipient_type": "UNKNOWN",
            "department_or_subject": None,
            "detection_method": "rule_absence",
            "confidence": 0.0,
            "requires_manual_review": True,
            "explanation": "Notice does not provide clear linguistic recipient markers. Requires manual administrator review."
        }]

    return detected_recipients
