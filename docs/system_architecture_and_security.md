# System Architecture and Security Review Report
**Project:** Marathi NLP-Based Intelligent Notice Management System  
**Application Name:** Marathi Notice Hub  
**Academic Degree:** B.Tech Project Final Documentation

---

## 1. System Architecture

Marathi Notice Hub implements a three-tier decoupled architecture:

### 1.1 Presentation Layer (Frontend)
- **Framework:** React 18 with TypeScript and Vite.
- **Styling:** Vanilla CSS design system enhanced with Tailwind CSS utility tokens.
- **Multilingual Support:** `i18next` with localized resource catalogs in Marathi (`mr`), English (`en`), and Hindi (`hi`).
- **State Management & Context:** `AuthContext` managing JWT token persistence in `localStorage`, reactive user role status, and automatic route guarding.

### 1.2 Application & Intelligence Layer (FastAPI Backend)
- **RESTful API:** FastAPI with Pydantic v2 schemas for strict input/output validation.
- **Authentication & RBAC:** OAuth2 Password Bearer flow issuing HS256-signed JWT access tokens with 24-hour expiration.
- **Marathi NLP Service:** Modular pipeline with Unicode NFC normalization, Devanagari digit translation, TF-IDF + Logistic Regression categorization, rule-based recipient extraction, and entity recognition.
- **QR Examination Punctuality Engine:** Cryptographic token generation (`EXAM_<token_urlsafe(32)>`) and crisp vector SVG markup. Authoritative server-clock timestamping enforces a 3-strike punctuality policy:
  - Strike 1 &rarr; Warning 1
  - Strike 2 &rarr; Warning 2
  - Strike 3 &rarr; Automated Incident Report for Administrative Review

### 1.3 Persistence Layer (Database)
- **Primary DBMS:** PostgreSQL in production / SQLite for local development.
- **ORM:** SQLAlchemy 2.0 with declarative mapped models.
- **Migration Engine:** Alembic managing versioned schema migrations (`8b9c0d1e2f3a` head).
- **Core Entities:**
  - `User`: Admin, Faculty accounts with hashed credentials and department linkage.
  - `Department`: School faculties and departments.
  - `Notice`: Notice lifecycle (draft, submitted, approved, rejected, distributed).
  - `NLPAnalysis`: Extracted entities, suggested recipients, confidence metrics.
  - `NoticeRecipient`: Recipient delivery, read timestamps, acknowledgment receipts.
  - `Examination`: Exam session metadata, reporting times, collection deadlines, grace periods.
  - `ExaminationDuty`: Assigned faculty members, roles (e.g. Senior Supervisor), attendance status.
  - `QRCheckInToken`: Cryptographically secure tokens for exam paper bucket pickup.
  - `FacultyCheckInRecord`: Server-validated check-in timestamps, minutes late, excused status.
  - `LateWarningRecord`: Progressive late-arrival warnings (Warning 1, Warning 2).
  - `ExaminationIncidentReport`: Automated 3rd-strike incident reports with review state.
  - `AuditLog`: Immutable audit trail for all sensitive administrative actions.

---

## 2. Security Review & Hardening Audit

A comprehensive security audit was conducted covering all implemented features:

| Security Vector | Implementation Detail | Status |
|---|---|:---:|
| **Password Storage** | Bcrypt with work factor = 12 (`bcrypt.gensalt(12)`). Passwords are never stored in plaintext. Length capped at 72 bytes to prevent DoS. | **PASSED** |
| **JWT Token Security** | Cryptographically signed using `HS256` with configurable `SECRET_KEY`. Enforces `exp` (expiration) and `iat` (issued at). Tampered signatures or expired tokens are rejected with `401 Unauthorized`. | **PASSED** |
| **Role-Based Access Control (RBAC)** | Enforced strictly on the server through FastAPI dependencies (`get_current_active_admin`, `get_current_active_faculty`). Faculty users cannot trigger notice approvals, distributions, duty assignments, or audit log retrieval. | **PASSED** |
| **Horizontal Authorization (Record Isolation)** | Faculty can only access their own assigned duties (`/my-duties`) and warnings (`/my-warnings`). Query filters explicitly constrain `faculty_id == current_user.id`. | **PASSED** |
| **QR Check-In Timestamp Verification** | Client-submitted device timestamps are completely discarded. Punctuality is calculated using `datetime.utcnow()` recorded by the server at request receipt. | **PASSED** |
| **QR Token Entropy & Replay Protection** | Tokens are generated via `secrets.token_urlsafe(32)` (>= 43 random characters). Tokens enforce single-use per faculty duty to prevent duplicate check-in recording. | **PASSED** |
| **Administrative Correction Auditing** | Modifying attendance or excusing late arrivals requires an explicit administrative action with a recorded reason, generating an immutable `AuditLog` entry. | **PASSED** |
| **CORS Protection** | Restricted to explicit origins configured via `CORS_ORIGINS` environment variable in production. Wildcards (`*`) are disallowed for credentials. | **PASSED** |
| **Input Validation** | Pydantic v2 schemas enforce type constraints, required fields, and non-empty strings across all endpoints. | **PASSED** |
| **Secrets Management** | Production configuration isolates all credentials in environment variables (`.env.production`). No production passwords or secret keys are committed to source control. | **PASSED** |

---

## 3. Database Schema & Relational Integrity

```text
+-------------------+       +-----------------------+       +------------------------+
|    departments    |       |         users         |       |        notices         |
+-------------------+       +-----------------------+       +------------------------+
| id (PK)           | <---+ | id (PK)               | <---+ | id (PK)                |
| name              |     | | username (UQ)         |     | | title                  |
| description       |     | | email (UQ)            |     | | content                |
+-------------------+     | | hashed_password       |     | | category               |
                          | | role (Admin/Faculty)  |     | | priority               |
                          +-+ department_id (FK)    |     | | status (draft/appr..)  |
                            | is_active             |     +-+ author_id (FK)         |
                            +-----------------------+       | approved_by_id (FK)    |
                                       ^                    +------------------------+
                                       |                                |
                        +--------------+-----------------+              v
                        |                                |   +------------------------+
                        v                                |   |      nlp_analyses      |
             +--------------------+                      |   +------------------------+
             | examination_duties |                      |   | id (PK)                |
             +--------------------+                      |   | notice_id (FK)         |
             | id (PK)            |                      |   | predicted_category     |
             | examination_id(FK) |                      |   | suggested_recipients   |
             | faculty_id (FK)    |                      |   +------------------------+
             | role_title         |                      |
             | status             |                      v
             +--------------------+          +-----------------------+
                        |                    |   notice_recipients   |
                        v                    +-----------------------+
         +-----------------------------+     | id (PK)               |
         |  faculty_checkin_records    |     | notice_id (FK)        |
         +-----------------------------+     | recipient_user_id(FK) |
         | id (PK)                     |     | is_read / read_at     |
         | examination_id (FK)         |     | is_ack / ack_at       |
         | duty_id (FK)                |     +-----------------------+
         | scanned_at (server time)    |
         | is_late / minutes_late      |
         | status (on_time/late/exc..) |
         +-----------------------------+
                        |
            +-----------+-----------+
            v                       v
+-----------------------+  +-------------------------------+
|  late_warning_records |  |  examination_incident_reports |
+-----------------------+  +-------------------------------+
| id (PK)               |  | id (PK)                       |
| faculty_id (FK)       |  | faculty_id (FK)               |
| warning_level (1 or 2)|  | total_late_occurrences (>=3)  |
| checkin_id (FK)       |  | incident_summary              |
| status                |  | status (open/reviewed/resolv) |
+-----------------------+  | admin_remarks                 |
                           +-------------------------------+
```
