import { User } from './auth';

export type ExamStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type DutyStatus = 'assigned' | 'checked_in_ontime' | 'checked_in_late' | 'excused' | 'absent';
export type CheckInStatus = 'on_time' | 'late' | 'excused' | 'disputed';
export type WarningStatus = 'active' | 'excused' | 'resolved';
export type IncidentStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export interface QRCheckInToken {
  id: number;
  examination_id: number;
  token: string;
  bucket_label?: string | null;
  bucket_identifier?: string | null;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  expires_at?: string | null;
  created_at: string;
  qr_svg_content?: string | null;
}

export interface ExaminationDuty {
  id: number;
  examination_id: number;
  faculty_id: number;
  role_title: string;
  status: DutyStatus;
  notes?: string | null;
  created_at: string;
  faculty?: User;
}

export interface LateWarningRecord {
  id: number;
  faculty_id: number;
  examination_id: number;
  checkin_id: number;
  warning_level: number;
  warning_reason: string;
  status: WarningStatus;
  excuse_reason?: string | null;
  created_at: string;
}

export interface ExaminationIncidentReport {
  id: number;
  faculty_id: number;
  examination_id: number;
  trigger_checkin_id: number;
  total_late_occurrences: number;
  incident_summary: string;
  status: IncidentStatus;
  admin_remarks?: string | null;
  reviewed_by_id?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  faculty?: User;
  examination?: Examination;
  reviewed_by?: User;
}

export interface FacultyCheckInRecord {
  id: number;
  examination_id: number;
  duty_id: number;
  faculty_id: number;
  scanned_at: string;
  scheduled_reporting_time: string;
  is_late: boolean;
  minutes_late: number;
  status: CheckInStatus;
  correction_reason?: string | null;
  corrected_at?: string | null;
  created_at: string;
  warning?: LateWarningRecord | null;
  incident_report?: ExaminationIncidentReport | null;
}

export interface Examination {
  id: number;
  title: string;
  exam_code: string;
  exam_date: string;
  reporting_time: string;
  collection_deadline: string;
  grace_period_minutes: number;
  location: string;
  instructions?: string | null;
  status: ExamStatus;
  created_by_id: number;
  created_at: string;
  updated_at?: string | null;
  duties?: ExaminationDuty[];
  qr_tokens?: QRCheckInToken[];
  qr_tokens_count?: number;
  checkins?: FacultyCheckInRecord[];
  incident_reports?: ExaminationIncidentReport[];
  creator?: User;
}

export interface ExaminationCreatePayload {
  title: string;
  exam_code: string;
  exam_date: string;
  reporting_time: string;
  collection_deadline: string;
  grace_period_minutes?: number;
  location: string;
  instructions?: string;
}

export interface ExaminationUpdatePayload {
  title?: string;
  exam_date?: string;
  reporting_time?: string;
  collection_deadline?: string;
  grace_period_minutes?: number;
  location?: string;
  instructions?: string;
  status?: string;
}

export interface ExaminationCancelPayload {
  reason: string;
}

export interface DutyAssignPayload {
  faculty_id: number;
  role_title?: string;
  notes?: string;
}

export interface ScanCheckInPayload {
  token: string;
}

export interface CheckInCorrectionPayload {
  status: 'excused' | 'corrected';
  reason: string;
}

export interface IncidentReviewPayload {
  status: 'reviewed' | 'resolved' | 'dismissed';
  remarks: string;
}

export interface ExaminationAttendanceReportItem {
  examination_id: number;
  exam_title: string;
  exam_code: string;
  exam_date: string;
  reporting_time: string;
  location: string;
  faculty_id: number;
  faculty_name: string;
  department_name?: string | null;
  role_title: string;
  duty_status: DutyStatus;
  scanned_at?: string | null;
  is_late: boolean;
  minutes_late: number;
  active_warnings_count: number;
  incident_status?: string | null;
}

export interface FacultyPunctualitySummary {
  active_warning_count: number;
  total_incidents: number;
  warnings: LateWarningRecord[];
  incidents: ExaminationIncidentReport[];
}
