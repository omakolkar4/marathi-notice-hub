"""
Unified NLP Service for Marathi Notice Hub
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Orchestrates the complete NLP pipeline:
1. Devanagari normalization & preprocessing
2. Language identification (Devanagari ratio check)
3. Notice category classification (TF-IDF + Logistic Regression)
4. Recipient identification with explainable rule matching
5. Information & entity extraction (Dates, Times, Subjects, Departments, Events, Deadlines)
6. Automated policy check for administrative manual review
"""

from typing import Dict, Any, List

from app.nlp.preprocessing import (
    clean_marathi_text,
    detect_devanagari_ratio,
    is_probable_marathi,
    detect_language
)
from app.nlp.classification import classify_notice
from app.nlp.recipient_detection import detect_recipients
from app.nlp.entity_extraction import extract_entities


class MarathiNoticeNLPService:
    """Unified service for processing Marathi educational notices."""

    def __init__(self, confidence_review_threshold: float = 0.30):
        self.confidence_review_threshold = confidence_review_threshold

    def process_notice(self, raw_text: str) -> Dict[str, Any]:
        """
        Processes a raw Marathi notice through the complete NLP pipeline.
        Returns a comprehensive structured payload suitable for downstream
        notice management, manual review, and administrative logging.
        """
        # 1. Validation & Preprocessing
        if not raw_text or not isinstance(raw_text, str) or not raw_text.strip():
            return {
                "original_notice": "" if raw_text is None else str(raw_text),
                "normalized_text": "",
                "language_detected": {
                    "code": "und",
                    "devanagari_ratio": 0.0,
                    "is_marathi": False,
                    "status": "empty_or_invalid"
                },
                "predicted_category": {
                    "category": "General",
                    "confidence": 0.0,
                    "probabilities": {},
                    "model_type": "None (Empty input)"
                },
                "extracted_entities": {
                    "dates": [],
                    "times": [],
                    "departments": [],
                    "subjects": [],
                    "events": [],
                    "deadlines": [],
                    "keywords": []
                },
                "suggested_recipients": [],
                "recipient_explanation": "Notice is empty or invalid. Manual input required.",
                "review_required": True,
                "review_reasons": ["Empty or invalid notice input."]
            }

        normalized = clean_marathi_text(raw_text)

        # 2. Language Identification (Devanagari lexical & script check)
        lang_detected = detect_language(normalized)
        is_marathi = lang_detected["is_marathi"]
        lang_code = lang_detected["code"]
        ratio = lang_detected["devanagari_ratio"]

        # 3. Machine Learning Notice Classification
        cat_result = classify_notice(normalized)

        # 4. Entity Extraction
        entities = extract_entities(normalized)

        # 5. Recipient Identification
        recipients = detect_recipients(normalized)

        # 6. Safety and Review Required Policy
        review_reasons: List[str] = []

        # Check language and script suitability
        if lang_code == "en":
            review_reasons.append(
                "Notice text is in English. The Marathi ML classifier operates with uncertainty on English texts; manual category & recipient verification required."
            )
        elif lang_code == "hi":
            review_reasons.append(
                "Notice text is in Hindi. While Devanagari entities and keywords are partially extracted, full Marathi ML confidence is limited; administrative review required."
            )
        elif not is_marathi and ratio < 0.20:
            review_reasons.append(
                f"Low Devanagari script ratio ({ratio * 100:.1f}%). Possible non-Marathi or unsupported text."
            )

        # Check recipient clarity
        has_unknown_recipient = any(r.get("recipient_type") == "UNKNOWN" for r in recipients)
        requires_manual_recipient = any(r.get("requires_manual_review", False) for r in recipients)
        if has_unknown_recipient:
            review_reasons.append("No explicit recipient detected; requires administrator manual assignment.")
        elif requires_manual_recipient:
            review_reasons.append("Ambiguous recipient detected (e.g. general subject teacher without subject specified).")

        # Check classification confidence
        if cat_result.get("confidence", 0.0) < self.confidence_review_threshold:
            review_reasons.append(
                f"Low classification confidence ({cat_result.get('confidence', 0.0):.2f}). Category requires verification."
            )

        # Synthesize recipient explanation
        if recipients and not has_unknown_recipient:
            explanations = [r.get("explanation", "") for r in recipients if r.get("explanation")]
            recipient_explanation = " | ".join(explanations)
        else:
            recipient_explanation = "Notice does not clearly identify a target faculty role or group; manual review required."

        review_required = len(review_reasons) > 0

        return {
            "original_notice": raw_text,
            "normalized_text": normalized,
            "language_detected": lang_detected,
            "predicted_category": cat_result,
            "extracted_entities": entities,
            "suggested_recipients": recipients,
            "recipient_explanation": recipient_explanation,
            "review_required": review_required,
            "review_reasons": review_reasons
        }


# Singleton service instance
nlp_service = MarathiNoticeNLPService()
