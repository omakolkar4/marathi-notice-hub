# Marathi NLP-Based Intelligent Notice Management System
**Official Application Name:** Marathi Notice Hub  
**Academic Degree:** B.Tech Project (Natural Language Processing & Full-Stack Systems)

---

## 1. Project Overview & Problem Statement

Educational institutions in Maharashtra generate hundreds of administrative circulars, staff meeting agendas, holiday declarations, examination schedules, and student notices every academic term. The vast majority of these documents are drafted in **Marathi (मराठी)**.

### Challenges Addressed:
1. **Manual Routing Bottlenecks:** Circulars often languish on notice boards or are delayed in manual staff distribution registers.
2. **Devanagari Linguistic Complexities:** Standard NLP tools trained primarily on English fail on Marathi word forms, Devanagari numeral representations (०-९), inflectional variations, and composite consonants.
3. **Examination Material Leakage & Lateness:** Examination duty records and physical paper/answer-sheet bucket pickups traditionally lack verifiable timestamp audits, leading to disputes regarding invigilator punctuality.
4. **Lack of Accountable Punctuality Policies:** Absence of an auditable progressive warning system (1st late arrival &rarr; Warning 1, 2nd late arrival &rarr; Warning 2, 3rd late arrival &rarr; Incident Report).

### Core Solution:
**Marathi Notice Hub** is an integrated web platform combining an NLP pipeline tailored for Marathi circulars with a secure, role-based notice distribution system and a QR-based examination duty punctuality tracking engine.

---

## 2. Technology Stack

| Layer | Technologies Used | Description |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, Lucide-React, i18next | Responsive, modern Single Page Application (SPA) with multilingual localization (मराठी, English, हिंदी) |
| **Backend API** | FastAPI, Python 3.11+, Pydantic v2, Starlette | High-performance asynchronous REST API with auto-generated OpenAPI documentation |
| **Database & ORM** | PostgreSQL (Production) / SQLite (Development), SQLAlchemy 2.0, Alembic | Relational database schema with full migration tracking and audit logging |
| **Security & Auth** | OAuth2 Password Bearer, PyJWT, Bcrypt (cost=12), Python Secrets | Cryptographic JWT tokens, role-based authorization (Admin / Faculty), secure QR tokens |
| **NLP Pipeline** | Scikit-learn, TF-IDF Vectorizer, Logistic Regression, Unicode Normalization | Marathi text preprocessing, Devanagari digit mapping, notice categorization, recipient detection |
| **QR Code Engine** | `qrcode[pil]`, `qrcode.image.svg.SvgPathImage` | High-contrast, server-generated cryptographic SVG vector QR tokens |
| **DevOps & Container**| Docker, Docker Compose, NGINX | Multi-stage containerized production stack with persistent database volumes |

---

## 3. System Architecture

```text
                               +-------------------------------------------------------+
                               |                   Client Web Browser                  |
                               |    React 18 + TypeScript + TailwindCSS + i18next      |
                               +---------------------------+---------------------------+
                                                           |
                                           HTTPS / REST API Requests
                                                           |
                                                           v
                               +-------------------------------------------------------+
                               |                 NGINX Reverse Proxy                   |
                               |         Serves Static Assets / Routes API Calls       |
                               +---------------------------+---------------------------+
                                                           |
                                                           v
+----------------------------------------------------------------------------------------------------------------------+
|                                                 FastAPI Backend Server                                               |
|                                                                                                                      |
|  [Authentication & RBAC]         [Marathi NLP Pipeline]              [Notice Workflow]      [QR Examination Engine]  |
|  - JWT Bearer Verification       - Unicode NFC Normalization         - Notice Drafting      - Cryptographic Tokens   |
|  - Bcrypt Password Hashing       - Devanagari Numeral Mapping        - Principal Approval   - Server-Time Validation |
|  - Role Guards (Admin/Faculty)   - TF-IDF + Logistic Classifier      - Multi-Dept Delivery  - 3-Strike Warning Policy|
|  - Immutable Audit Logging       - Transparent Rule Extraction       - Read & Ack Receipts  - Incident Report Gen.   |
+----------------------------------------------------------+-----------------------------------------------------------+
                                                           |
                                            SQLAlchemy ORM 2.0 Connection
                                                           |
                                                           v
                               +-------------------------------------------------------+
                               |                 Relational Database                   |
                               |       PostgreSQL (Prod) / SQLite (Dev Environment)    |
                               |   Tables: users, departments, notices, nlp_analysis,  |
                               |   examinations, duties, qr_tokens, checkins, audit    |
                               +-------------------------------------------------------+
```

---

## 4. Key Modules & Functional Workflows

### 4.1. Marathi NLP Pipeline
1. **Preprocessing (`app.nlp.preprocessing`):**
   - Cleans raw input, strips zero-width spaces, normalizes Devanagari characters using Unicode NFC normalization.
   - Maps Marathi numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to standard Arabic digits (0-9).
2. **Classification (`app.nlp.classification`):**
   - Classifies notices into 8 distinct categories: *Examination, Meeting, Holiday, Academic, Event, Administrative, Emergency, General*.
   - Uses TF-IDF vectorization with character and word n-grams, trained on an institutional Marathi corpus.
3. **Recipient Identification (`app.nlp.recipient_detection`):**
   - Deterministic rule extraction detecting keywords (उदा. 'सर्व शिक्षक', 'गणित शिक्षक', 'विज्ञान विभाग', 'मुख्याध्यापक').
   - Assigns confidence scores and flags low-confidence or ambiguous notices for human review.
4. **Information Extraction (`app.nlp.entity_extraction`):**
   - Extracts dates (उदा. १५ ऑगस्ट, २४/०३/२०२४), reporting times, venues, and deadlines.

### 4.2. Notice Creation, Approval & Distribution
- **Faculty Workflow:** Faculty draft circulars and submit them for administrative review. Notices remain locked in `submitted` state until reviewed.
- **Admin Review:** Principal/Admin reviews content, reviews NLP-suggested recipients, modifies recipients if necessary, and approves or rejects with reason.
- **Distribution & Receipts:** Approved notices are distributed to recipient faculty accounts. Real-time read and acknowledgment timestamps are recorded.

### 4.3. QR Examination Duty & Punctuality Engine
1. **Schedule Creation:** Admin schedules examination sessions with reporting time, paper collection deadline, grace period (minutes), and exam hall.
2. **QR Token Generation:** Server generates cryptographic tokens (`EXAM_<random_string>`) and vector SVG images for each paper bucket or collection point.
3. **Faculty Check-In:**
   - Faculty member opens the authenticated portal on mobile or desktop.
   - Scans the collection point QR code or enters the token.
   - **Zero Trust on Client Clocks:** The server validates the token authenticity, checks duty assignment, and records attendance using the server's authoritative clock.
4. **Three-Strike Punctuality Policy:**
   - **On-Time:** Checked in before reporting deadline + grace period &rarr; Attendance recorded cleanly.
   - **Strike 1 (1st Late Arrival):** Issues formal **Warning 1**.
   - **Strike 2 (2nd Late Arrival):** Issues formal **Warning 2**.
   - **Strike 3 (3rd Late Arrival):** Automatically triggers an **Examination Incident Report** submitted for Administrative Committee review.
5. **Administrative Corrections & Disciplinary Disclaimer:**
   - Software does not automatically impose punitive sanctions. Incident reports trigger human administrative review.
   - Admin can officially excuse valid exceptions (medical emergency, approved timetable change) with an auditable reason recorded in `AuditLog`.

---

## 5. User Roles and Permissions

| Feature / Action | School Administrator (Admin) | Faculty Member (Teacher) |
|---|:---:|:---:|
| System Dashboard & Overview | Full School Analytics | Personal Notices & Duties |
| Submit Notice for Approval | Direct Creation & Publishing | Yes (Draft & Submit) |
| Review & Approve Notices | Yes (Approve / Return / Reject) | No |
| Distribute Circulars to Departments | Yes | No |
| Faculty & Department Management | Yes (Create, Edit, Deactivate) | No |
| Schedule Examination Sessions | Yes | No |
| Assign Faculty Examination Duties | Yes | No |
| View Authorized QR Tokens / Print | Yes | No |
| Scan QR Code for Bucket Collection | Yes | Yes (For Assigned Duties) |
| Personal Punctuality & Strike Meter | View School-Wide Records | View Personal 3-Strike Status |
| Administrative Attendance Correction | Yes (With Audit Log) | No |
| Review & Resolve Incident Reports | Yes (With Decision Remarks) | No |
| View System Audit Logs | Yes | No |

---

## 6. Installation & Local Setup

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ and npm
- Git

### Step 1: Clone Repository & Setup Virtual Environment
```bash
# Clone the repository
git clone https://github.com/om-akolkar/marathi-notice-nlp-system.git
cd Marathi_Notice_NLP_System

# Create virtual environment (if not already existing)
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate
```

### Step 2: Install Backend Dependencies
```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 3: Configure Environment Variables
```bash
# Copy development configuration template
cp .env.example .env
```

### Step 4: Run Database Migrations
```bash
python -m alembic upgrade head
```

### Step 5: Seed Initial Administrator & Standard Departments
```bash
python scripts/create_initial_admin.py --username admin --password AdminNotice@2024
```

### Step 6: Install Frontend Dependencies & Build
```bash
cd frontend
npm install
npm run build
cd ..
```

---

## 7. Running the Application

### Running Backend Development Server
From the project root:
```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive API Docs (Swagger UI): `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

### Running Frontend Development Server
In a separate terminal:
```bash
cd frontend
npx vite --host 127.0.0.1 --port 5173
```
- Web Application: `http://127.0.0.1:5173`

---

## 8. Production Deployment with Docker Compose

For a production deployment using PostgreSQL with persistent volumes and NGINX:

```bash
# 1. Copy production configuration
cp .env.production.example .env

# 2. Build and launch multi-container stack
docker compose up -d --build

# 3. Check container logs
docker compose logs -f
```

---

## 9. Test Suite Execution & Verification

The project includes an exhaustive automated test suite covering all 7 phases:

```bash
# Run the complete test suite
python -m pytest backend/tests -v
```

### Summary of Test Execution:
| Test Module | Coverage Area | Status |
|---|---|:---:|
| `test_health.py` | FastAPI startup, health checks, Python version | **PASSED** |
| `test_database.py` | SQLAlchemy models, schemas, user hashing | **PASSED** |
| `test_nlp_pipeline.py` | Marathi tokenization, TF-IDF classifier, recipient rules | **PASSED** |
| `test_nlp_backend_integration.py` | NLP API routes, entity extraction, confidence thresholds | **PASSED** |
| `test_notice_lifecycle.py` | Notice creation, update, approval, and distribution | **PASSED** |
| `test_phase5_integration.py` | Full-stack delivery, read receipts, multilingual notices | **PASSED** |
| `test_examination_management.py` | QR check-in, late arrival policy, 3 strikes, incident reports | **PASSED** |
| `test_phase7_security_and_hardening.py`| JWT tamper checks, token expiration, RBAC isolation | **PASSED** |
| **Total** | **85 Automated Unit and Integration Tests** | **85/85 PASSED (100%)** |

---

## 10. Academic Demonstration Checklist

Follow this sequence during project viva / demonstration:

1. **Admin Login:** Log in as `admin` (`AdminNotice@2024`).
2. **Multilingual Interface:** Demonstrate switching language between **मराठी**, **English**, and **हिंदी** using the top navigation switcher.
3. **Faculty Account Setup:** Navigate to `/admin/faculty` and verify registered faculty members and their subject/department assignments.
4. **Marathi Notice Creation:**
   - Click *Create Notice*.
   - Enter a Marathi circular: *"दिनांक २५ मार्च रोजी सर्व गणित शिक्षकांची परीक्षा संदर्भात बैठक आयोजित केली आहे."*
   - Click *Analyze with NLP*.
   - Demonstrate category prediction (*Meeting / बैठका*) and recipient suggestion (*गणित शिक्षक*).
5. **Notice Approval & Distribution:**
   - Submit notice, review distribution list, and distribute.
6. **Faculty Portal & Acknowledgment:**
   - Log out and log in as Faculty `rshinde` (`FacultyNotice@2024`).
   - Open *Received Notices*, view circular details, and click *Acknowledge*.
   - Demonstrate that the read timestamp and acknowledgment badge update immediately.
7. **Examination Session Scheduling:**
   - Log in as Admin and navigate to `/admin/examinations`.
   - Schedule a session (उदा. *इयत्ता १० वी गणित वार्षिक परीक्षा २०२४*).
   - Assign faculty `rshinde` as *Senior Supervisor*.
   - Click *View & Print QR* to display the server-generated vector SVG QR code.
8. **Faculty QR Check-In:**
   - Log in as Faculty `rshinde` and navigate to `/faculty/exam-duties`.
   - Show personal *Punctuality Standing* card and the *0/3 Late Strikes* indicator.
   - Click *Scan Collection QR*, enter/scan the token, and submit.
   - Display the real-time server check-in confirmation card showing server-side timestamp and punctuality status.
9. **Progressive Late-Arrival Policy Demonstration:**
   - Demonstrate Strike 1 &rarr; Warning 1 issued.
   - Demonstrate Strike 2 &rarr; Warning 2 issued.
   - Demonstrate Strike 3 &rarr; Automated Incident Report generated.
10. **Administrative Review & Corrections:**
    - Log back in as Admin.
    - View the *Check-In Status* monitor and *Faculty Warnings & Incidents* tab.
    - Open the Incident Review dialog, record formal management remarks, and mark as *Resolved*.
    - Demonstrate an administrative excuse correction with auditable reasoning.
11. **Comprehensive Attendance Export:**
    - Open the *Attendance Report* tab and click *Export CSV* to generate the school-wide examination attendance spreadsheet.
12. **Audit Trail Verification:**
    - Open `/api/v1/audit-logs` (or view admin logs) to show immutable records of notice approvals, QR scans, and corrections.

---

## 11. Known Limitations & Future Enhancements

- **OCR for Physical Scanned Documents:** Current document upload extracts text from clean digital documents; integrating Tesseract OCR with Devanagari models (`mar`) will further improve legacy scanned paper handling.
- **Push Notification Integration:** In-app read receipts and notifications are active; future versions can integrate WebPush and SMS alerts for rural areas.
- **Physical Barcode / Handheld Scanners:** The current system seamlessly accepts standard USB/Bluetooth handheld barcode scanner input through the manual input bridge.

---

**Project Developed for B.Tech Final Year Capstone Project**  
*Academic Project: Marathi NLP-Based Intelligent Notice Management System (Marathi Notice Hub)*
