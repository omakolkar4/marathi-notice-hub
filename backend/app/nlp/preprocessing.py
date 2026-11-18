"""
Marathi Text Preprocessing Module
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Handles normalization, tokenization, numeral conversion, and Devanagari text hygiene
specifically designed for Marathi school notices.
"""

import re
import unicodedata
from typing import List, Tuple, Dict, Any

# Devanagari Unicode Block: U+0900 to U+097F
DEVANAGARI_RANGE = (0x0900, 0x097F)

# Marathi Numerals mapping
MARATHI_TO_ENGLISH_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}

ENGLISH_TO_MARATHI_DIGITS = {v: k for k, v in MARATHI_TO_ENGLISH_DIGITS.items()}

# Curated Marathi Stop Words for feature extraction / modeling
# (Note: not stripped indiscriminately during raw cleaning to preserve semantic roles)
MARATHI_STOP_WORDS = {
    "आहे", "आहेत", "होते", "होती", "होता", "होत्या", "नाही", "नाहीत",
    "आणि", "किंवा", "व", "तसेच", "या", "हे", "ती", "ते", "त्या",
    "चे", "च्या", "ची", "चा", "ने", "नी", "ना", "ला", "स", "त",
    "वर", "खाली", "मध्ये", "कडे", "वरून", "कडून", "साठी", "यांनी",
    "असे", "अशी", "असा", "म्हणून", "जरी", "तरी", "तर", "पण",
    "की", "काय", "कसे", "केव्हा", "कोठे", "कोण", "इत्यादी", "बाबत",
    "रोजी", "सर्व", "एक", "दोन", "फार", "काही", "इतर"
}


def normalize_devanagari(text: str) -> str:
    """
    Applies Unicode canonical decomposition and recomposition (NFC).
    Normalizes typographic variants, quotation marks, dashes, and zero-width spaces.
    Preserves Zero Width Joiner (ZWJ U+200D) where necessary for conjuncts,
    removes redundant zero-width non-joiners when isolated.
    """
    if not text:
        return ""

    # Canonical Unicode Normalization (NFC)
    text = unicodedata.normalize('NFC', text)

    # Replace unusual quotation marks and dashes with standard equivalents
    text = text.replace('‘', "'").replace('’', "'")
    text = text.replace('“', '"').replace('”', '"')
    text = text.replace('–', '-').replace('—', '-')

    # Replace multiple spaces, non-breaking spaces, and tabs with single space
    text = re.sub(r'[\u00A0\u1680\u2000-\u200a\u202f\u205f\u3000]', ' ', text)
    text = re.sub(r'[ \t]+', ' ', text)

    # Normalize line breaks
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'\n+', '\n', text)

    return text.strip()


def marathi_to_english_digits(text: str) -> str:
    """
    Translates Devanagari numerals (०-९) to standard Arabic numerals (0-9).
    Useful for regex date, time, and numeric extraction.
    """
    if not text:
        return ""
    trans_table = str.maketrans(MARATHI_TO_ENGLISH_DIGITS)
    return text.translate(trans_table)


def english_to_marathi_digits(text: str) -> str:
    """
    Translates standard Arabic numerals (0-9) to Devanagari numerals (०-९).
    """
    if not text:
        return ""
    trans_table = str.maketrans(ENGLISH_TO_MARATHI_DIGITS)
    return text.translate(trans_table)


def clean_marathi_text(text: str) -> str:
    """
    Cleans raw Marathi notice text for processing while strictly preserving:
    - Devanagari characters, matras, and conjuncts
    - Marathi (०-९) and English (0-9) digits (crucial for dates/times/room numbers)
    - Essential punctuation (: . , - / ( ) % !)
    - Meaningful school terminology and English acronyms (SSC, HSC, PTA, etc.)
    """
    if not isinstance(text, str):
        return ""

    text = normalize_devanagari(text)
    if not text:
        return ""

    # Remove non-printable or corrupt control characters except \n
    text = "".join(ch for ch in text if ch == '\n' or (ch.isprintable() and not unicodedata.category(ch).startswith('C')))

    # Remove repeated punctuation like "!!!" or "???" or "....."
    text = re.sub(r'([।!?.,-])\1+', r'\1', text)

    return text.strip()


def tokenize_marathi(text: str, remove_stopwords: bool = False) -> List[str]:
    """
    Tokenizes Marathi text into a list of words, numbers, and key tokens.
    Uses a Devanagari-aware regex matching Marathi words, English acronyms, and digits.
    """
    if not text or not isinstance(text, str):
        return []

    # Pattern matches Devanagari words (including matras, virama, anusvara),
    # Latin words/acronyms, and digits (both Devanagari and English)
    pattern = re.compile(
        r'[\u0900-\u097F]+'             # Devanagari words with diacritics
        r'|[a-zA-Z]+'                    # Latin words (PTA, SSC, etc.)
        r'|[0-9]+'                       # English digits
        r'|[\u0966-\u096F]+'             # Marathi digits
    )

    tokens = pattern.findall(text)

    if remove_stopwords:
        tokens = [t for t in tokens if t not in MARATHI_STOP_WORDS]

    return tokens


def detect_devanagari_ratio(text: str) -> float:
    """
    Calculates the proportion of Devanagari alphabetic characters relative to total letters.
    Returns float between 0.0 and 1.0.
    """
    if not text or not isinstance(text, str):
        return 0.0

    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return 0.0

    devanagari_count = sum(
        1 for ch in letters if DEVANAGARI_RANGE[0] <= ord(ch) <= DEVANAGARI_RANGE[1]
    )
    return round(devanagari_count / len(letters), 4)


def is_probable_marathi(text: str, threshold: float = 0.40) -> Tuple[bool, float]:
    """
    Checks if the notice text has a sufficient ratio of Devanagari characters
    to be reliably processed as Marathi notice text.
    Threshold default is 0.40 to allow bilingual notices (Marathi + English acronyms/dates).
    """
    ratio = detect_devanagari_ratio(text)
    return (ratio >= threshold, ratio)


def detect_language(text: str) -> Dict[str, Any]:
    """
    Identifies the language of the notice text:
    - 'mr' (Marathi): Devanagari script with Marathi lexical markers or 'ळ'.
    - 'mr-mixed' (Bilingual Marathi-English): Common in Maharashtra school notices.
    - 'hi' (Hindi): Devanagari script with Hindi lexical markers.
    - 'en' (English): Latin script with English lexical patterns.
    - 'und' (Undetermined): Empty, numeric-only, or unsupported.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return {
            "code": "und",
            "name": "Undetermined",
            "devanagari_ratio": 0.0,
            "is_marathi": False,
            "confidence": 0.0,
            "status": "empty_or_invalid"
        }

    cleaned = normalize_devanagari(text)
    letters = [ch for ch in cleaned if ch.isalpha()]
    if not letters:
        return {
            "code": "und",
            "name": "Undetermined",
            "devanagari_ratio": 0.0,
            "is_marathi": False,
            "confidence": 0.0,
            "status": "no_alphabetic_characters"
        }

    devanagari_count = sum(1 for ch in letters if DEVANAGARI_RANGE[0] <= ord(ch) <= DEVANAGARI_RANGE[1])
    latin_count = sum(1 for ch in letters if ('a' <= ch.lower() <= 'z'))
    total_letters = len(letters)
    dev_ratio = round(devanagari_count / total_letters, 4)
    latin_ratio = round(latin_count / total_letters, 4)

    is_marathi_prob, prob_ratio = is_probable_marathi(cleaned)

    # Devanagari script analysis (Marathi vs Hindi)
    mr_markers = {
        'आहे', 'आहेत', 'होते', 'होती', 'नाही', 'नाहीत', 'आणि', 'किंवा', 'तसेच',
        'च्या', 'ची', 'चे', 'चा', 'साठी', 'रोजी', 'बाबत', 'मधील', 'यांनी', 'कडून',
        'वरून', 'करावे', 'राहावे', 'यावे', 'द्यावे', 'घ्यावे', 'उद्या', 'काल', 'शाळा',
        'शिक्षकांनी', 'मुख्याध्यापक', 'बैठक', 'परिपत्रक', 'उपस्थित', 'वाटप', 'होईल'
    }
    hi_markers = {
        'है', 'हैं', 'था', 'थी', 'थे', 'नहीं', 'और', 'या', 'का', 'के', 'की',
        'में', 'से', 'को', 'पर', 'लिए', 'द्वारा', 'दिनांक', 'कल', 'रहें',
        'करें', 'दें', 'लें', 'सभी', 'छात्र', 'अध्यापक', 'सुबह', 'बजे', 'प्राचार्य'
    }
    words = set(re.findall(r'[\u0900-\u097F]+', cleaned))
    has_marathi_l = 'ळ' in cleaned
    mr_score = len(words & mr_markers) + (2 if has_marathi_l else 0)
    hi_score = len(words & hi_markers)

    # If predominantly Latin without meaningful Devanagari
    if latin_ratio >= 0.70 or (dev_ratio < 0.15 and latin_ratio > 0.50):
        return {
            "code": "en",
            "name": "English",
            "devanagari_ratio": dev_ratio,
            "is_marathi": False,
            "confidence": round(latin_ratio, 2),
            "status": "detected_english"
        }

    # If Hindi markers dominate and no Marathi unique markers
    if dev_ratio >= 0.30 and hi_score > mr_score and not has_marathi_l:
        return {
            "code": "hi",
            "name": "Hindi",
            "devanagari_ratio": dev_ratio,
            "is_marathi": False,
            "confidence": 0.90 if hi_score >= 2 else 0.70,
            "status": "detected_hindi"
        }

    # Marathi or Mixed Marathi-English
    if is_marathi_prob or dev_ratio >= 0.20 or mr_score > 0 or has_marathi_l:
        code = "mr-mixed" if latin_ratio > 0.15 else "mr"
        return {
            "code": code,
            "name": "Marathi (Bilingual)" if code == "mr-mixed" else "Marathi",
            "devanagari_ratio": dev_ratio,
            "is_marathi": True,
            "confidence": 0.95 if mr_score >= 1 or has_marathi_l else 0.80,
            "status": "valid_marathi"
        }

    return {
        "code": "und",
        "name": "Undetermined",
        "devanagari_ratio": dev_ratio,
        "is_marathi": False,
        "confidence": 0.0,
        "status": "mixed_or_low_devanagari"
    }
