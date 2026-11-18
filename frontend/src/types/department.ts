export interface FacultyMemberSummary {
  id: number;
  name: string;
  username: string;
  email: string;
  subject?: string | null;
  designation?: string | null;
  is_active: boolean;
}

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  head_id?: number | null;
  head_name?: string | null;
  faculty_count?: number;
  active_faculty_count?: number;
  created_at: string;
}

export interface DepartmentDetail extends Department {
  faculty: FacultyMemberSummary[];
  notices_count: number;
  recent_notices: Array<{
    id: number;
    title: string;
    category: string;
    status: string;
    priority: string;
    created_at?: string;
    creator_name?: string;
  }>;
  recent_activities: Array<{
    id: number;
    action: string;
    details: any;
    user_name: string;
    created_at?: string;
  }>;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  description?: string;
}

export interface DepartmentAssignHead {
  head_user_id?: number | null;
}
