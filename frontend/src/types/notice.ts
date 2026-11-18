import { User } from './auth';
import { Department } from './department';

export type NoticeCategory =
  | 'Examination'
  | 'Meeting'
  | 'Holiday'
  | 'Academic'
  | 'Event'
  | 'Administrative'
  | 'Emergency'
  | 'General';

export type NoticePriority = 'normal' | 'urgent' | 'emergency';

export type NoticeApprovalStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'archived';

export type NoticeDistributionStatus = 'pending' | 'distributed';

export type NoticeLanguage = 'mr' | 'en' | 'hi';

export interface ExtractedEntities {
  dates?: Array<{ raw_text: string; formatted: string; type: string }>;
  times?: Array<{ raw_text: string; time: string; period?: string }>;
  departments?: string[];
  subjects?: string[];
  events?: string[];
  deadlines?: Array<{ raw_phrase: string; type: string }>;
  keywords?: string[];
}

export interface SuggestedRecipient {
  detected_phrase?: string | null;
  recipient_type: string;
  department_or_subject?: string | null;
  detection_method: string;
  confidence: number;
  requires_manual_review: boolean;
  explanation?: string;
}

export interface NLPAnalysis {
  id?: number;
  notice_id?: number;
  normalized_text: string;
  predicted_category: string;
  confidence: number;
  extracted_entities: ExtractedEntities;
  suggested_recipients: SuggestedRecipient[];
  recipient_explanation?: string;
  review_required: boolean;
  review_reasons?: string[];
  model_version?: string;
}

export interface NoticeRecipient {
  id: number;
  notice_id: number;
  recipient_id: number;
  selection_source: string;
  delivery_status: string;
  is_read: boolean;
  read_at?: string | null;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  created_at: string;
  recipient?: User;
}

export interface NoticeApproval {
  id: number;
  notice_id: number;
  reviewer_id: number;
  decision: string;
  comment?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  notice_id?: number | null;
  user_id?: number | null;
  action: string;
  details?: Record<string, any> | null;
  created_at: string;
  user?: User | null;
}

export interface Notice {
  id: number;
  title: string;
  original_text: string;
  attachment_url?: string | null;
  creator_id: number;
  creator?: User;
  source_type: string;
  predicted_category?: string | null;
  approval_status: NoticeApprovalStatus;
  distribution_status: NoticeDistributionStatus;
  priority: NoticePriority;
  target_audience?: string | null;
  target_department_id?: number | null;
  target_department?: Department | null;
  target_subject?: string | null;
  notice_language?: NoticeLanguage;
  source_organization?: string | null;
  source_date?: string | null;
  created_at: string;
  updated_at: string;
  nlp_analysis?: NLPAnalysis | null;
  approvals?: NoticeApproval[];
  recipients?: NoticeRecipient[];
  audit_logs?: AuditLog[];
  recipient_count?: number;
  read_count?: number;
  acknowledged_count?: number;
  is_read?: boolean;
  is_acknowledged?: boolean;
}

export interface NoticeCreatePayload {
  title: string;
  original_text: string;
  notice_language?: NoticeLanguage;
  attachment_url?: string;
  priority?: NoticePriority;
  source_type?: string;
  target_audience?: string;
  target_department_id?: number | null;
  target_subject?: string | null;
  source_organization?: string | null;
  source_date?: string | null;
}
