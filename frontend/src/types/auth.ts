export type UserRole = 'Admin' | 'Faculty';

export type AdminPermission =
  | 'full_admin'
  | 'manage_admins'
  | 'exam_management'
  | 'notice_management'
  | 'reports_access'
  | 'settings_management';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  department_id?: number | null;
  department?: {
    id: number;
    name: string;
    description?: string;
  } | null;
  subject?: string | null;
  designation?: string | null;
  phone?: string | null;
  is_active: boolean;
  is_principal?: boolean;
  permissions?: string[] | null;
  preferred_language?: string;
  theme_preference?: string;
  created_by_id?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface AdminCreatePayload {
  name: string;
  username: string;
  email: string;
  password: string;
  designation?: string;
  phone?: string;
  permissions: string[];
}

export interface AdminUpdatePayload {
  name?: string;
  email?: string;
  designation?: string;
  phone?: string;
  permissions?: string[];
  is_active?: boolean;
}

export interface PrincipalTransferPayload {
  new_principal_user_id: number;
  confirmation_phrase: string;
  reason: string;
  former_principal_permissions?: string[];
}

export interface AdminAuditItem {
  id: number;
  action: string;
  user_id: number | null;
  user_name: string;
  user_username: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
