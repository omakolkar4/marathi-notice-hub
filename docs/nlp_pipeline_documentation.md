# Marathi NLP Pipeline Technical Documentation & Evaluation Report
**Project:** Marathi NLP-Based Intelligent Notice Management System  
**Official Application Name:** Marathi Notice Hub  
**Phase:** Phase 2 - Marathi NLP Pipeline Prototype

---

## 1. Architecture Overview

The Marathi NLP pipeline in **Marathi Notice Hub** is structured into five modular components:

```
[Raw Notice Text]
       │
       ▼
[1. Preprocessing & Normalization] ──> Unicode NFC, Devanagari numerals to Arabic digits, whitespace hygiene
       │
       ├─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼                                 ▼
[2. Language Identification]   [3. ML Notice Classifier]       [4. Recipient Identifier]      [5. Entity Extractor]
 (Devanagari ratio & script     (TF-IDF + Multinomial Logistic   (Transparent Rule Engine:      (Regex & Term Catalogs:
  validation threshold)          Regression across 8 classes)     Role taxonomies & heuristics)  Dates, Times, Deadlines)
       │                                 │                                 │                                 │
       └─────────────────────────────────┴────────────────┬────────────────┴─────────────────────────────────┘
                                                          ▼
                                            [6. Unified NLP Service]
                                             (MarathiNoticeNLPService)
                                                          │
                                                          ▼
                                             [Structured Output Payload]
                                             (Category, Recipient, Entities,
                                              Explanation & Manual Review Flags)
```

---

## 2. Component Details

### A. Preprocessing (`backend/app/nlp/preprocessing.py`)
- **Unicode Canonical Normalization:** Applies Unicode `NFC` normalization (`unicodedata.normalize`) and harmonizes typography (curly quotes, long dashes, non-breaking spaces).
- **Digit Translation:** Bi-directional translation between Devanagari numerals (`०, १, २, ३, ४, ५, ६, ७, ८, ९`) and Arabic numerals (`0-9`) enables regex parsers to uniformly extract dates, times, and deadlines while preserving the original surface forms.
- **Devanagari Tokenization:** Tokenizes text using regex matching Devanagari words, matras, viramas, English loanwords/acronyms (e.g. `SSC`, `PTA`), and numeric tokens.
- **Language Identification:** Computes `detect_devanagari_ratio` to verify whether text is predominantly Marathi or requires fallback.

### B. Notice Classification (`backend/app/nlp/classification.py`)
- **Model:** Scikit-learn Pipeline featuring:
  - `TfidfVectorizer`: Word 1-2 n-grams, custom Devanagari tokenizer, `sublinear_tf=True`.
  - `LogisticRegression`: Balanced class weighting, multinomial loss, `max_iter=1000`.
- **8 Institutional Categories:**
  1. `Examination` (परीक्षा, वेळापत्रक, हॉल तिकीट, चाचणी)
  2. `Meeting` (पालक सभा, शिक्षक आढावा बैठक, SMC)
  3. `Holiday` (सुट्टी, सण, जयंती, शाळा बंद)
  4. `Academic` (अभ्यासक्रम, सहल, पुस्तके, ऑलिम्पियाड)
  5. `Event` (क्रीडा स्पर्धा, स्नेहसंमेलन, ध्वजारोहण)
  6. `Administrative` (कागदपत्रे, हजेरी, आधार पडताळणी, वेतन)
  7. `Emergency` (अतिवृष्टी, पूर, रेड अलर्ट, आपत्कालीन)
  8. `General` (शिस्त, गणवेश, स्वच्छता, ओळखपत्र)

### C. Recipient Identification (`backend/app/nlp/recipient_detection.py`)
Deterministic, explainable rule engine matching specific school roles:
- `PRINCIPAL` (प्राचार्य / मुख्याध्यापक)
- `ALL_FACULTY` (सर्व शिक्षक / सर्व शिक्षकवृंद / सर्व प्राध्यापक)
- `SUBJECT_TEACHER` (गणित, विज्ञान, इंग्रजी, मराठी, इ. शिक्षक)
- `DEPARTMENT` (परीक्षा विभाग, क्रीडा विभाग, सांस्कृतिक विभाग, इ.)
- `CLASS_TEACHER` (वर्गशिक्षक)
- `EXAM_SUPERVISOR` (परीक्षा पर्यवेक्षक)
- `COMMITTEE_MEMBERS` (समिती सदस्य)
- `NON_TEACHING_STAFF` (शिक्षकेतर कर्मचारी, शिपाई)
- `PARENTS` (पालक)
- `STUDENTS` (विद्यार्थी)
- `UNKNOWN` (No explicit linguistic cues found -> requires manual review)

### D. Entity Extraction (`backend/app/nlp/entity_extraction.py`)
- **Dates:** Marathi named months (`१५ ऑगस्ट`, `२५ नोव्हेंबर`), relative dates (`उद्या`, `परवा`, `शुक्रवारी`), numeric dates (`DD/MM/YYYY`, `DD-MM-YYYY`).
- **Times:** Marathi format (`दुपारी २:०० वाजता`, `सकाळी १०:३०`), standard 12/24hr formats (`11:00 AM`).
- **Deadlines:** Marathi postposition markers (`तारखेपर्यंत`, `डिसेंबर पर्यंत`, `पूर्वी`, `अंतिम तारीख`).
- **Departments & Subjects:** Matches against school catalog.
- **Substantive Keywords:** Stopword-filtered meaningful tokens.

### E. Unified Service & Review Safety (`backend/app/services/nlp_service.py`)
Enforces administrative safety before automated distribution:
- Notices with `UNKNOWN` or ambiguous recipients trigger `review_required = True`.
- Low classification confidence (< 0.30) triggers `review_required = True`.
- Low Devanagari ratio (< 20%) triggers `review_required = True`.

---

## 3. Evaluation Results on Synthetic Prototype Dataset

> [!NOTE]
> The current dataset (`data/sample/notice_classification_dataset.json`) is a small synthetic prototype containing 80 labeled Marathi school notices (10 per class) created specifically for initial development and architectural verification.

### Evaluation Metrics Summary

| Metric | Value | Interpretation |
| :--- | :--- | :--- |
| **Total Labeled Samples** | 80 | 10 notices per category across 8 categories |
| **Training Set Size** | 60 (75%) | Stratified split |
| **Holdout Test Set Size** | 20 (25%) | Stratified holdout |
| **Holdout Test Accuracy** | **55.00%** | Significant improvement over 12.5% random guess baseline |
| **Holdout Weighted F1** | **49.77%** | Reflects prototype sample sparsity |
| **4-Fold Cross-Validation Accuracy** | **41.25% (± 6.50%)** | Robust validation across multiple data partitions |

### Per-Class Holdout Performance

| Category | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| **Holiday** | 0.75 | 1.00 | **0.86** | 3 |
| **Meeting** | 0.67 | 1.00 | **0.80** | 2 |
| **Examination** | 0.60 | 1.00 | **0.75** | 3 |
| **General** | 1.00 | 0.50 | **0.67** | 2 |
| **Emergency** | 0.50 | 0.33 | **0.40** | 3 |
| **Event** | 0.33 | 0.33 | **0.33** | 3 |
| **Academic** | 0.00 | 0.00 | **0.00** | 2 |
| **Administrative** | 0.00 | 0.00 | **0.00** | 2 |

---

## 4. Limitations and Known Failure Cases

1. **Vocabulary Sparsity in Prototype:**
   - Small classes (like `Academic` and `Administrative`) have overlap in vocabulary (`नोंद`, `सादर करावे`, `शिक्षकांनी`). With only 10 samples per category, out-of-vocabulary terms in holdout samples lead to misclassification.
2. **Context-Dependent Postpositions (विभक्ती प्रत्यय):**
   - Marathi is an agglutinative language where suffixes attach directly to words (e.g. `मुख्याध्यापकांकडे`, `शाळेत`, `शिक्षकांसाठी`). Stemming or lemmatization will further improve recall.
3. **Implicit Recipient Cues:**
   - If a notice discusses "Checking APAAR ID registers" without saying "class teachers must check", rule matching cannot definitively infer the recipient and appropriately flags `UNKNOWN`.
4. **Dialects and Mixed Script Variations:**
   - Regional Marathi spelling variations and English transliterations (Hinglish/Maringlish) require expanded vocabulary dictionaries or transformer embeddings in Phase 3.

---

## 5. Instructions for Replacing the Synthetic Dataset with Real Data

To replace the prototype dataset with real Marathi school circulars:

1. **Prepare Data File:**
   Create a JSON file formatted as:
   ```json
   [
     {
       "text": "मराठी सूचनेचा मूळ मजकूर...",
       "category": "Examination"
     }
   ]
   ```
2. **Place File in Workspace:**
   Save as `data/processed/real_marathi_notices.json`.
3. **Execute Training Script:**
   ```powershell
   $env:PYTHONPATH="backend"
   .\.venv\Scripts\python.exe scripts/train_classifier.py --dataset data/processed/real_marathi_notices.json
   ```
4. **Re-run Test Suite:**
   ```powershell
   .\.venv\Scripts\python.exe -m pytest backend/tests
   ```

---

## 6. How to Run Phase 2 Components

- **Train Classifier:**
  ```powershell
  $env:PYTHONPATH="backend"; $env:PYTHONIOENCODING="utf-8"
  .\.venv\Scripts\python.exe scripts/train_classifier.py
  ```
- **Run Interactive Prototype Demo:**
  ```powershell
  $env:PYTHONPATH="backend"; $env:PYTHONIOENCODING="utf-8"
  .\.venv\Scripts\python.exe scripts/demo_nlp_pipeline.py
  ```
- **Execute Automated Pytest Suite:**
  ```powershell
  $env:PYTHONPATH="backend"; $env:PYTHONIOENCODING="utf-8"
  .\.venv\Scripts\python.exe -m pytest backend/tests -v
  ```
