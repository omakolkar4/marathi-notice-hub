"""
Entity and Information Extraction Module
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Extracts structured metadata (dates, times, departments, subjects, events, deadlines,
and key institutional terms) from Marathi school notices using deterministic NLP rules.
"""

import re
from typing import Dict, List, Any

from app.nlp.preprocessing import (
    clean_marathi_text,
    marathi_to_english_digits,
    tokenize_marathi,
    MARATHI_STOP_WORDS
)

# Marathi month names
MARATHI_MONTHS = [
    "जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून",
    "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"
]

# Marathi day names
MARATHI_DAYS = [
    "सोमवारी", "मंगळवारी", "बुधवारी", "गुरुवारी", "शुक्रवारी", "शनिवारी", "रविवारी",
    "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"
]

# Recognized school subjects
SUBJECTS = [
    "गणित", "विज्ञान", "इंग्रजी", "मराठी", "हिंदी",
    "इतिहास", "भूगोल", "सामाजिक शास्त्रे", "क्रीडा", "शारीरिक शिक्षण",
    "कला", "चित्रकला", "संस्कृत", "संगणक"
]

# Recognized school departments
DEPARTMENTS = [
    "परीक्षा विभाग", "क्रीडा विभाग", "सांस्कृतिक विभाग", "विज्ञान विभाग",
    "ग्रंथालय विभाग", "लेखा विभाग", "कार्यालयीन विभाग", "प्रशासकीय विभाग"
]

# Common school events
EVENTS = [
    "वार्षिक स्नेहसंमेलन", "क्रीडा स्पर्धा", "पालक-शिक्षक सभा", "पालक सभा",
    "सत्र परीक्षा", "घटक चाचणी", "पूर्व परीक्षा", "प्रात्यक्षिक परीक्षा",
    "स्वातंत्र्य दिन", "प्रजासत्ताक दिन", "महाराष्ट्र दिन", "गांधी जयंती",
    "शिवजयंती", "आंबेडकर जयंती", "विज्ञान प्रदर्शन", "ध्वजारोहण",
    "आनंद मेळावा", "रक्तदान शिबिर", "वृक्षारोपण", "शिक्षक दिन"
]


def extract_dates(text: str) -> List[Dict[str, Any]]:
    """
    Extracts dates in various formats:
    - Marathi text dates: 'दिनांक १५ ऑगस्ट', '१० नोव्हेंबर ते २५ नोव्हेंबर'
    - Formatted numeric dates: '15/08/2024', '१५.०८.२०२४', '15-10-2024'
    - Relative day expressions: 'उद्या', 'परवा', 'आज', 'शुक्रवार रोजी'
    """
    dates = []
    normalized_digits = marathi_to_english_digits(text)

    # 1. Month-name patterns (e.g. 'दिनांक १५ ऑगस्ट २०२४', '१० नोव्हेंबर')
    month_regex = (
        r'(?:दिनांक|दि\.)?\s*([0-9]{1,2})\s*(' + '|'.join(MARATHI_MONTHS) + r')(?:\s*([0-9]{4}))?'
    )
    for match in re.finditer(month_regex, normalized_digits):
        day = match.group(1)
        month = match.group(2)
        year = match.group(3) if match.group(3) else "Unspecified / Current Academic Year"
        raw_match = text[match.start():match.end()]
        dates.append({
            "raw_text": raw_match.strip(),
            "formatted": f"{day} {month} {year}".strip(),
            "type": "calendar_date"
        })

    # 2. Numeric date patterns: DD/MM/YYYY or DD-MM-YYYY
    num_date_regex = r'\b([0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4})\b'
    for match in re.finditer(num_date_regex, normalized_digits):
        raw_match = text[match.start():match.end()]
        dates.append({
            "raw_text": raw_match.strip(),
            "formatted": match.group(1),
            "type": "numeric_date"
        })

    # 3. Relative date expressions ('उद्या', 'परवा', 'आज', 'सोमवार रोजी')
    relative_words = ["उद्या", "परवा", "आज"] + MARATHI_DAYS
    for word in relative_words:
        rel_regex = r'\b' + re.escape(word) + r'(?:\s+रोजी)?\b'
        for match in re.finditer(rel_regex, text):
            raw_match = match.group(0).strip()
            # Avoid duplicate captures
            if not any(d["raw_text"] == raw_match for d in dates):
                dates.append({
                    "raw_text": raw_match,
                    "formatted": word,
                    "type": "relative_or_day_of_week"
                })

    return dates


def extract_times(text: str) -> List[Dict[str, Any]]:
    """
    Extracts time expressions from notice text:
    - Marathi formats: 'सकाळी १०:०० वाजता', 'दुपारी २:००', 'सायंकाळी ४ वाजता'
    - Standard 12/24hr formats: '10:00 AM', '2:30 PM'
    """
    times = []
    normalized_digits = marathi_to_english_digits(text)

    # Marathi time pattern with prefix and optional 'वाजता'
    time_regex = (
        r'(सकाळी|दुपारी|सायंकाळी|रात्री)?\s*([0-9]{1,2}(?::[0-9]{2})?)\s*(?:ते\s*([0-9]{1,2}(?::[0-9]{2})?))?\s*(वाजता)?'
    )
    for match in re.finditer(time_regex, normalized_digits):
        prefix = match.group(1)
        start_time = match.group(2)
        end_time = match.group(3)
        has_vajata = match.group(4)

        # Ensure it is a genuine time expression (has prefix, colon, or 'वाजता')
        if prefix or ":" in start_time or has_vajata:
            raw_match = text[match.start():match.end()].strip()
            if len(raw_match) > 1 and not re.match(r'^[0-9]+$', raw_match):
                times.append({
                    "raw_text": raw_match,
                    "period": prefix or "Not specified",
                    "time": start_time + (f" - {end_time}" if end_time else "")
                })

    return times


def extract_deadlines(text: str) -> List[Dict[str, Any]]:
    """
    Extracts deadline cues and submission targets ('पर्यंत', 'पूर्वी', 'अंतिम तारीख').
    """
    deadlines = []
    normalized_digits = marathi_to_english_digits(text)

    # Patterns like '१२ डिसेंबर पर्यंत', '१० तारखेपर्यंत', 'सोमवारपर्यंत', 'अंतिम तारीख ३० नोव्हेंबर'
    deadline_patterns = [
        r'((?:[^\s.,\n]+\s+){0,3}[^\s.,\n]*(?:पर्यंत|पूर्वी))',
        r'(अंतिम\s+तारीख\s+[^.,\n]+)',
        r'(शेवटची\s+तारीख\s+[^.,\n]+)',
        r'(मुदत\s+[^.,\n]+)'
    ]
    for pattern in deadline_patterns:
        for match in re.finditer(pattern, text):
            phrase = match.group(1).strip()
            if 3 < len(phrase) < 60 and not any(d["raw_phrase"] == phrase for d in deadlines):
                deadlines.append({
                    "raw_phrase": phrase,
                    "type": "submission_or_action_deadline"
                })

    return deadlines


def extract_entities(text: str) -> Dict[str, Any]:
    """
    Unified entity extraction for Marathi school notices.
    Returns extracted dates, times, departments, subjects, events, deadlines, and keywords.
    """
    cleaned = clean_marathi_text(text)
    if not cleaned:
        return {
            "dates": [],
            "times": [],
            "departments": [],
            "subjects": [],
            "events": [],
            "deadlines": [],
            "keywords": []
        }

    # Departments
    matched_departments = [
        dept for dept in DEPARTMENTS if dept in cleaned
    ]

    # Subjects
    matched_subjects = [
        subj for subj in SUBJECTS if re.search(r'\b' + re.escape(subj) + r'\b', cleaned)
    ]

    # Events
    matched_events = [
        ev for ev in EVENTS if ev in cleaned
    ]

    # Important substantive keywords (tokenized, stopwords removed)
    tokens = tokenize_marathi(cleaned, remove_stopwords=True)
    # Filter short tokens or numerals
    meaningful_tokens = [
        t for t in tokens if len(t) > 2 and not t.isdigit() and t not in MARATHI_STOP_WORDS
    ]
    # Unique keywords preserving order
    keywords = list(dict.fromkeys(meaningful_tokens))[:10]

    return {
        "dates": extract_dates(cleaned),
        "times": extract_times(cleaned),
        "departments": matched_departments,
        "subjects": matched_subjects,
        "events": matched_events,
        "deadlines": extract_deadlines(cleaned),
        "keywords": keywords
    }
