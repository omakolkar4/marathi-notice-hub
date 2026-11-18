"""
Interactive Demo Script for Marathi Notice Hub NLP Pipeline
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import sys
import json
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

# pyrefly: ignore[missing-import]
from app.services.nlp_service import nlp_service

SAMPLE_NOTICES = [
    {
        "id": "1",
        "description": "Mathematics teachers meeting on Friday at 2 PM",
        "notice": "सर्व गणित शिक्षकांनी शुक्रवार रोजी दुपारी २:०० वाजता मुख्याध्यापक कार्यालयात बैठकीस उपस्थित राहावे."
    },
    {
        "id": "2",
        "description": "All faculty members meeting",
        "notice": "शाळेतील सर्व शिक्षकांची मासिक आढावा बैठक उद्या सभागृहात आयोजित करण्यात आली आहे."
    },
    {
        "id": "3",
        "description": "Emergency school closure due to heavy rainfall",
        "notice": "जिल्हाधिकाऱ्यांच्या आदेशानुसार अतिवृष्टीमुळे उद्या दिनांक १० जुलै रोजी शाळेस सुट्टी जाहीर करण्यात आली आहे."
    },
    {
        "id": "4",
        "description": "Examination instructions for invigilators and department",
        "notice": "सर्व परीक्षा पर्यवेक्षकांनी घटक चाचणीच्या उत्तरपत्रिका परीक्षा विभागात सोमवारपर्यंत जमा कराव्यात."
    },
    {
        "id": "5",
        "description": "Unclear / Ambiguous notice with no specific recipient",
        "notice": "शाळेच्या नवीन इमारतीचे रंगकाम पूर्ण झाले असून सर्व परिसर स्वच्छ ठेवण्यात यावा."
    },
    {
        "id": "6",
        "description": "Mixed Marathi-English notice with deadline",
        "notice": "10th Std SSC Board Exam Hall Tickets वाटप शनिवार दिनांक २५ नोव्हेंबर रोजी सकाळी ११:०० वाजता होईल. अंतिम तारीख ३० नोव्हेंबर आहे."
    }
]


def display_result(res: dict, sample_desc: str = ""):
    print("\n" + "=" * 70)
    if sample_desc:
        print(f"CASE: {sample_desc}")
    print("=" * 70)
    print(f"RAW NOTICE:    {res['original_notice']}")
    print(f"NORMALIZED:    {res['normalized_text']}")

    lang = res["language_detected"]
    print(f"LANGUAGE:      Code: {lang['code']} | Devanagari Ratio: {lang['devanagari_ratio']*100:.1f}% | Marathi: {lang['is_marathi']}")

    cat = res["predicted_category"]
    print(f"CATEGORY:      {cat['category']} (Confidence: {cat['confidence']:.2f}) [Model: {cat['model_type']}]")

    print("\nRECIPIENTS:")
    for r in res["suggested_recipients"]:
        flag = " [MANUAL REVIEW REQUIRED]" if r.get("requires_manual_review") else " [CONFIRMED]"
        subj = f" ({r['department_or_subject']})" if r.get("department_or_subject") else ""
        print(f"  * Phrase: '{r.get('detected_phrase')}' -> Type: {r.get('recipient_type')}{subj}{flag}")
        print(f"    Confidence: {r.get('confidence', 0.0):.2f} | Reason: {r.get('explanation')}")

    print("\nEXTRACTED ENTITIES:")
    ent = res["extracted_entities"]
    if ent["dates"]:
        print(f"  * Dates:       {[d['formatted'] for d in ent['dates']]}")
    if ent["times"]:
        print(f"  * Times:       {[t['time'] for t in ent['times']]}")
    if ent["departments"]:
        print(f"  * Departments: {ent['departments']}")
    if ent["subjects"]:
        print(f"  * Subjects:    {ent['subjects']}")
    if ent["events"]:
        print(f"  * Events:      {ent['events']}")
    if ent["deadlines"]:
        print(f"  * Deadlines:   {[d['raw_phrase'] for d in ent['deadlines']]}")
    if ent["keywords"]:
        print(f"  * Keywords:    {ent['keywords'][:6]}")

    print(f"\nADMIN REVIEW:  {'REQUIRED' if res['review_required'] else 'NOT REQUIRED'}")
    if res["review_required"]:
        print(f"REASONS:       {', '.join(res['review_reasons'])}")
    print("=" * 70)


def main():
    print("=" * 70)
    print("Marathi Notice Hub - NLP Pipeline Prototype Execution")
    print("Project: Marathi NLP-Based Intelligent Notice Management System")
    print("=" * 70)

    # If custom notice passed via command line argument
    if len(sys.argv) > 1:
        custom_text = " ".join(sys.argv[1:])
        result = nlp_service.process_notice(custom_text)
        display_result(result, "Custom User Notice")
        return

    # Otherwise run standard benchmark cases
    for item in SAMPLE_NOTICES:
        result = nlp_service.process_notice(item["notice"])
        display_result(result, item["description"])


if __name__ == "__main__":
    main()
