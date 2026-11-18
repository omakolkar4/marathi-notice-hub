# Academic Demonstration & Viva Presentation Guide
**Project:** Marathi NLP-Based Intelligent Notice Management System  
**Application Name:** Marathi Notice Hub  
**Degree:** Final Year B.Tech Project Viva Voce

---

## 1. Test Credentials

| Account Role | Username | Password | Purpose |
|---|---|---|---|
| **Principal / Admin** | `admin` | `AdminNotice@2024` | Administrative controls, notice approval, distribution, exam scheduling, incident reviews |
| **Faculty Member (Science)** | `rshinde` | `FacultyNotice@2024` | Circular viewing, acknowledgment, exam duty check-in, personal punctuality tracking |

---

## 2. 12-Step Demonstration Walk-Through

### Step 1: Initial Login & Trilingual Localization
1. Open the browser and go to `http://localhost:5173/login`.
2. Notice the modern interface supporting Marathi, English, and Hindi.
3. Switch languages via the top navbar dropdown (**मराठी**, **English**, **हिंदी**) to demonstrate seamless Devanagari localization.
4. Log in as Admin (`admin` / `AdminNotice@2024`).

### Step 2: Admin Dashboard & School Analytics
1. The Admin Dashboard opens showing institutional statistics:
   - Total Notices, Pending Approvals, Active Faculty Members, Distributed Circulars.
   - Quick Action buttons: *Create Notice*, *Notice Approvals*, and *Examination Management*.
2. Highlight the role guard: Administrative controls are accessible only to authenticated users with `role: "Admin"`.

### Step 3: Faculty & Department Management
1. In the sidebar, click **Faculty Management** (`/admin/faculty`).
2. Show registered faculty members, designated subjects (e.g., Mathematics, Science, Marathi), and department affiliations.
3. Demonstrate account activation/deactivation toggles and department mapping.

### Step 4: Marathi Notice Creation with Real-Time NLP Analysis
1. Click **Create Notice** (`/admin/create-notice`).
2. Enter the notice details in Marathi:
   - **Title:** `वार्षिक क्रीडा स्पर्धा २०२४ - शिक्षक समन्वय बैठक`
   - **Content:** `दिनांक २५ मार्च रोजी सर्व क्रीडा व शारीरिक शिक्षण शिक्षकांची महत्त्वाची बैठक आयोजित केली आहे. सर्व संबंधित शिक्षकांनी दुपारी २:०० वाजता मुख्य कार्यालयात उपस्थित राहावे.`
3. Click **Analyze with NLP**:
   - The Marathi NLP pipeline processes the text through Unicode NFC normalization and Devanagari digit mapping.
   - **Predicted Category:** Displays *Event (क्रीडा व स्पर्धा)* or *Meeting (बैठका)* with confidence score.
   - **Extracted Entities:** Identifies Date (`२५ मार्च`), Time (`दुपारी २:००`), and Venue (`मुख्य कार्यालय`).
   - **Suggested Recipients:** Identifies *Sports & Physical Ed* department and teachers.
4. Explain the human-in-the-loop design: The system assists the administrator with suggestions while allowing manual recipient adjustments prior to publishing.

### Step 5: Notice Approval & Department Distribution
1. Submit the notice. If created by Admin, it can be approved directly; if created by Faculty, it is placed in `submitted` state awaiting administrative review.
2. In **Notice Approvals** (`/admin/approvals`), review the circular and click **Approve & Distribute**.
3. Select recipient departments or specific faculty members and confirm distribution.

### Step 6: Faculty Portal & Read Acknowledgment Receipt
1. Click **Logout** from the Navbar.
2. Log in as Faculty `rshinde` (`FacultyNotice@2024`).
3. The Faculty Dashboard opens displaying *Received Notices* and *Assigned Examination Duties*.
4. Open the newly distributed notice:
   - The server immediately records the `read_at` timestamp.
   - Click **Acknowledge (पोहोच नोंदवा)**.
   - The badge updates to *Acknowledged* with a green checkmark and records `acknowledged_at`.

### Step 7: Examination Session Scheduling & Vector QR Generation
1. Log back in as Admin (`admin` / `AdminNotice@2024`).
2. Navigate to **Examination Management** (`/admin/examinations`).
3. Click **Schedule Examination**:
   - Title: `इयत्ता १० वी गणित वार्षिक परीक्षा २०२४`
   - Exam Code: `SSC-2024-MATH-101`
   - Reporting Time: `09:30`
   - Collection Deadline: `10:00`
   - Grace Period: `10` minutes
   - Location: `Main Exam Hall A (Room 101)`
4. Click **Save**: The session is scheduled, and a primary QR bucket token is automatically generated.
5. Click **View & Print QR**: Display the high-contrast vector SVG QR code generated on the server (`qrcode.image.svg.SvgPathImage`).

### Step 8: Faculty Duty Assignment
1. On the examination card, click **Assign Faculty Duty**.
2. Select faculty `rshinde`, assign role as **Senior Supervisor (मुख्य पर्यवेक्षक)**, and add duty notes: *"Collect Room 101 question paper bucket."*
3. The assigned duty chip appears on the examination session card.

### Step 9: Faculty QR Check-In & Server-Side Timestamping
1. Log in as Faculty `rshinde`.
2. Navigate to **Exam Duties & QR** (`/faculty/exam-duties`).
3. View the assigned duty details and the personal **Punctuality Standing (3-Strike Meter)**.
4. Click **Scan Collection QR**:
   - The camera scanner opens (with an optical token entry fallback).
   - Enter/scan the authorized QR token and click **Confirm Check-In**.
5. The check-in result card appears:
   - Server-validated timestamp is displayed.
   - Compares the arrival time against the reporting deadline + grace period.
   - If on-time, records attendance cleanly with 0 warnings.

### Step 10: Three-Strike Progressive Late-Arrival Policy
Explain the automated policy engine:
- **Strike 1 (1st Late Arrival):** The server calculates late arrival minutes and automatically generates **Warning 1**.
- **Strike 2 (2nd Late Arrival):** A second late occurrence increments the strike count and generates **Warning 2**.
- **Strike 3 (3rd Late Arrival):** Upon the third verified late occurrence, the system automatically triggers an **Examination Incident Report** with `status="open"`.
- Emphasize the disciplinary disclaimer: The software produces an incident report for human review; no automatic disciplinary punishment is imposed by the algorithm.

### Step 11: Administrative Review & Audit Trail
1. Log in as Admin.
2. In the Examination portal, open **Faculty Warnings & Incidents**:
   - View the generated incident report.
   - Click **Review Incident Report**, record formal committee remarks (*"Discussed in academic staff meeting; faculty counseled"*), and update status to **Resolved**.
3. In **Check-In Status**, show the **Administrative Correction** feature:
   - Admin can officially excuse valid exceptions (medical emergency, scanner hardware fault).
   - Show that correcting an entry writes an immutable record to the `AuditLog` table.

### Step 12: School-Wide Attendance & Incident Export
1. In the Examination portal, click the **Attendance Report** tab.
2. View the unified table showing examination titles, assigned faculty members, scheduled reporting times, actual server scan times, punctuality status, and active warning counts.
3. Click **Export CSV Report** to download the complete spreadsheet.
