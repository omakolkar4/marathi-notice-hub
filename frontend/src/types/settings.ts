export interface SchoolSetting {
  id: number;
  school_name: string;
  school_code?: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  principal_name?: string | null;
  logo_url?: string | null;
  academic_year?: string | null;
  updated_at: string;
}

export interface SchoolSettingUpdatePayload {
  school_name?: string;
  school_code?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  principal_name?: string;
  logo_url?: string;
  academic_year?: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  preferred_language?: string;
  theme_preference?: string;
}
