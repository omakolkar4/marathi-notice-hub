import { Notice, NoticeCreatePayload, NLPAnalysis, AuditLog } from '../types/notice';
import { User, AdminCreatePayload, AdminUpdatePayload, PrincipalTransferPayload, AdminAuditItem } from '../types/auth';
import { Department } from '../types/department';
import { SchoolSetting, SchoolSettingUpdatePayload, ProfileUpdatePayload } from '../types/settings';
import {
  Examination,
  ExaminationDuty,
  QRCheckInToken,
  FacultyCheckInRecord,
  LateWarningRecord,
  ExaminationIncidentReport,
  ExaminationCreatePayload,
  ExaminationUpdatePayload,
  DutyAssignPayload,
  ScanCheckInPayload,
  CheckInCorrectionPayload,
  IncidentReviewPayload,
  ExaminationAttendanceReportItem,
  FacultyPunctualitySummary
} from '../types/examination';

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // If body is not FormData, add JSON content-type
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  auth: {
    login: async (username: string, password: string): Promise<{ access_token: string; user_id: number; username: string; name: string; role: string }> => {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(err.detail || 'Incorrect credentials or account deactivated.');
      }
      return res.json();
    },
    getMe: () => request<User>('/auth/me'),
    changePassword: (current_password: string, new_password: string) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password, new_password }),
      }),
  },

  users: {
    getUsers: (params?: { role?: string; department_id?: number; is_active?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.role) searchParams.append('role', params.role);
      if (params?.department_id) searchParams.append('department_id', String(params.department_id));
      if (params?.is_active !== undefined) searchParams.append('is_active', String(params.is_active));
      const qs = searchParams.toString();
      return request<User[]>(`/users${qs ? `?${qs}` : ''}`);
    },
    getUser: (id: number) => request<User>(`/users/${id}`),
    createUser: (payload: { name: string; username: string; email: string; password: string; role: string; department_id?: number | null; subject?: string; designation?: string }) =>
      request<User>('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateUser: (id: number, payload: Partial<User>) =>
      request<User>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deactivateUser: (id: number) =>
      request<User>(`/users/${id}/deactivate`, { method: 'PUT' }),
    activateUser: (id: number) =>
      request<User>(`/users/${id}/activate`, { method: 'PUT' }),
  },

  departments: {
    getDepartments: () => request<Department[]>('/departments'),
    getDepartment: (id: number) => request<Department>(`/departments/${id}`),
    getDepartmentDetails: (id: number) => request<any>(`/departments/${id}/details`),
    assignDepartmentHead: (id: number, head_user_id: number | null) =>
      request<Department>(`/departments/${id}/head`, {
        method: 'PUT',
        body: JSON.stringify({ head_user_id }),
      }),
    createDepartment: (payload: { name: string; description?: string }) =>
      request<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateDepartment: (id: number, payload: { name?: string; description?: string }) =>
      request<Department>(`/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteDepartment: (id: number) =>
      request<{ message: string }>(`/departments/${id}`, { method: 'DELETE' }),
    setupDemoFaculty: () =>
      request<{
        message: string;
        created_departments: string[];
        created_faculty: any[];
        skipped_departments: any[];
      }>('/departments/setup-demo-faculty', { method: 'POST' }),
  },

  notices: {
    getNotices: (params?: {
      category?: string;
      department_id?: number;
      source_type?: string;
      approval_status?: string;
      priority?: string;
      search?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.append('category', params.category);
      if (params?.department_id) searchParams.append('department_id', String(params.department_id));
      if (params?.source_type) searchParams.append('source_type', params.source_type);
      if (params?.approval_status) searchParams.append('approval_status', params.approval_status);
      if (params?.priority) searchParams.append('priority', params.priority);
      if (params?.search) searchParams.append('search', params.search);
      const qs = searchParams.toString();
      return request<Notice[]>(`/notices${qs ? `?${qs}` : ''}`);
    },
    getNotice: (id: number) => request<Notice>(`/notices/${id}`),
    createNotice: (payload: NoticeCreatePayload) =>
      request<Notice>('/notices', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateNotice: (id: number, payload: Partial<NoticeCreatePayload>) =>
      request<Notice>(`/notices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    submitNotice: (id: number) =>
      request<Notice>(`/notices/${id}/submit`, { method: 'POST' }),
    approveNotice: (id: number, decision: 'approved' | 'rejected' | 'returned', comment?: string) =>
      request<Notice>(`/notices/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      }),
    distributeNotice: (
      id: number,
      target_audience: 'all_faculty' | 'department' | 'subject' | 'selected_faculty',
      department_id?: number,
      subject?: string,
      faculty_ids?: number[]
    ) =>
      request<Notice>(`/notices/${id}/distribute`, {
        method: 'POST',
        body: JSON.stringify({ target_audience, department_id, subject, faculty_ids }),
      }),
    markAsRead: (id: number) =>
      request<{ message: string; read_at: string }>(`/notices/${id}/read`, { method: 'POST' }),
    acknowledgeNotice: (id: number) =>
      request<{ message: string; acknowledged_at: string }>(`/notices/${id}/acknowledge`, { method: 'POST' }),
    cancelNotice: (id: number) =>
      request<Notice>(`/notices/${id}/cancel`, { method: 'POST' }),
    getNoticeAuditTrail: (id: number) =>
      request<AuditLog[]>(`/notices/${id}/audit-trail`),
    analyzeNLP: (text: string) =>
      request<NLPAnalysis>('/notices/analyze-nlp', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    uploadDocument: async (file: File): Promise<{
      filename: string;
      attachment_url: string;
      extracted_text: string;
      extraction_status: string;
      message: string;
    }> => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/notices/upload-document`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Document upload failed' }));
        throw new Error(err.detail || 'Failed to upload document');
      }
      return res.json();
    },
  },

  audit: {
    getLogs: (params?: {
      action?: string;
      notice_id?: number;
      user_id?: number;
      start_date?: string;
      end_date?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params?.action) sp.append('action', params.action);
      if (params?.notice_id) sp.append('notice_id', String(params.notice_id));
      if (params?.user_id) sp.append('user_id', String(params.user_id));
      if (params?.start_date) sp.append('start_date', params.start_date);
      if (params?.end_date) sp.append('end_date', params.end_date);
      const qs = sp.toString();
      return request<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
    },
  },

  admins: {
    getAdmins: () => request<User[]>('/admins'),
    createAdmin: (payload: AdminCreatePayload) =>
      request<User>('/admins', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateAdmin: (id: number, payload: AdminUpdatePayload) =>
      request<User>(`/admins/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deactivateAdmin: (id: number) =>
      request<User>(`/admins/${id}/deactivate`, { method: 'PUT' }),
    activateAdmin: (id: number) =>
      request<User>(`/admins/${id}/activate`, { method: 'PUT' }),
    transferPrincipal: (payload: PrincipalTransferPayload) =>
      request<User>('/admins/transfer-principal', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getHistory: () => request<AdminAuditItem[]>('/admins/history'),
  },

  settings: {
    getSchoolSettings: () => request<SchoolSetting>('/settings/school'),
    updateSchoolSettings: (payload: SchoolSettingUpdatePayload) =>
      request<SchoolSetting>('/settings/school', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    getProfile: () => request<User>('/settings/profile'),
    updateProfile: (payload: ProfileUpdatePayload) =>
      request<User>('/settings/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  },

  examinations: {
    getExaminations: (params?: { date_from?: string; date_to?: string; status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.date_from) sp.append('date_from', params.date_from);
      if (params?.date_to) sp.append('date_to', params.date_to);
      if (params?.status) sp.append('status', params.status);
      const qs = sp.toString();
      return request<Examination[]>(`/examinations${qs ? `?${qs}` : ''}`);
    },
    getExamination: (id: number) => request<Examination>(`/examinations/${id}`),
    createExamination: (payload: ExaminationCreatePayload) =>
      request<Examination>('/examinations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateExamination: (id: number, payload: ExaminationUpdatePayload) =>
      request<Examination>(`/examinations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    cancelExamination: (id: number, reason: string) =>
      request<Examination>(`/examinations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    deleteExamination: (id: number) =>
      request<{ message: string }>(`/examinations/${id}`, {
        method: 'DELETE',
      }),
    assignDuty: (examId: number, payload: DutyAssignPayload) =>
      request<ExaminationDuty>(`/examinations/${examId}/duties`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    generateQRToken: (examId: number, bucketIdentifier?: string) => {
      return request<QRCheckInToken>(`/examinations/${examId}/qr-tokens`, {
        method: 'POST',
        body: JSON.stringify({ bucket_label: bucketIdentifier || 'Bucket #1' }),
      });
    },
    scanCheckIn: (token: string) =>
      request<FacultyCheckInRecord>('/examinations/scan-checkin', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    getMyDuties: () => request<ExaminationDuty[]>('/examinations/my-duties'),
    getMyWarnings: () => request<FacultyPunctualitySummary>('/examinations/my-warnings'),
    getAttendanceReport: (params?: { examination_id?: number; faculty_id?: number; is_late?: boolean }) => {
      const sp = new URLSearchParams();
      if (params?.examination_id) sp.append('examination_id', String(params.examination_id));
      if (params?.faculty_id) sp.append('faculty_id', String(params.faculty_id));
      if (params?.is_late !== undefined) sp.append('is_late', String(params.is_late));
      const qs = sp.toString();
      return request<ExaminationAttendanceReportItem[]>(`/examinations/attendance-report${qs ? `?${qs}` : ''}`);
    },
    correctCheckIn: (checkinId: number, payload: CheckInCorrectionPayload) =>
      request<FacultyCheckInRecord>(`/examinations/checkins/${checkinId}/correct`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    reviewIncident: (incidentId: number, payload: IncidentReviewPayload) =>
      request<ExaminationIncidentReport>(`/examinations/incidents/${incidentId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getIncidents: () => request<ExaminationIncidentReport[]>('/examinations/incidents'),
    getWarnings: () => request<LateWarningRecord[]>('/examinations/warnings'),
  },
};
