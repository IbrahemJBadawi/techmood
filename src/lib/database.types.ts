/**
 * Database types.
 *
 * Hand-written for now because the Supabase project does not exist yet. Once it
 * does, replace this file wholesale with the generated version:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * Only the surface the app actually queries is modelled here.
 */

/**
 * Row shapes are type ALIASES, never interfaces: supabase-js constrains every
 * Row to Record<string, unknown>, and an interface has no implicit index
 * signature, so interfaces silently resolve the whole schema to `never`.
 */
export type UserRole =
  | 'student' | 'freelancer' | 'mentor' | 'team_leader' | 'founder' | 'company' | 'admin';

export type RoleStatus = 'approved' | 'pending_review' | 'rejected' | 'suspended';

export type LessonKind = 'video' | 'article' | 'reading' | 'exercise' | 'live';

export type ProgressStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type SubmissionKind =
  | 'lesson_assignment' | 'course_project' | 'path_project' | 'course_task' | 'portfolio_evidence';

export type SubmissionStatus =
  | 'draft' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected';

export type EvaluationDecision = 'approved' | 'changes_requested' | 'rejected';

export type EvidenceKind =
  | 'github' | 'linkedin' | 'youtube' | 'drive' | 'portfolio' | 'website' | 'file';

export type CertificateKind = 'course' | 'path';
export type CertificateStatus = 'active' | 'revoked';
export type MentorLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export type XpSource =
  | 'lesson_completed' | 'assignment_evaluated' | 'course_project_evaluated'
  | 'course_completed' | 'path_project_evaluated' | 'path_completed'
  | 'mentor_session_attended' | 'team_contribution' | 'achievement_awarded';

export type Profile = {
  id: string;
  techmood_id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileRole = {
  id: string;
  profile_id: string;
  role: UserRole;
  status: RoleStatus;
  application_note: string | null;
  evidence_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export type LearningPath = {
  id: string;
  slug: string;
  school_id: string | null;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  tagline_ar: string | null;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  estimated_hours: number | null;
  sort_order: number;
}

export type Course = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  status: 'draft' | 'published' | 'archived';
  estimated_hours: number | null;
}

export type Lesson = {
  id: string;
  module_id: string;
  title_ar: string;
  title_en: string | null;
  kind: LessonKind;
  duration_minutes: number | null;
  summary_ar: string | null;
  video_url: string | null;
  sort_order: number;
}

export type Assignment = {
  id: string;
  kind: SubmissionKind;
  lesson_id: string | null;
  course_id: string | null;
  path_id: string | null;
  title_ar: string;
  brief_ar: string | null;
  required_evidence: EvidenceKind[];
  is_required: boolean;
  is_group_work: boolean;
}

export type Submission = {
  id: string;
  assignment_id: string;
  profile_id: string;
  team_id: string | null;
  status: SubmissionStatus;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export type Evaluation = {
  id: string;
  submission_id: string;
  version_id: string;
  evaluator_id: string;
  decision: EvaluationDecision;
  stars: number | null;
  score: number | null;
  feedback_ar: string | null;
  created_at: string;
}

export type ReevaluationRequest = {
  id: string;
  submission_id: string;
  evaluation_id: string;
  requested_by: string;
  reason_ar: string;
  status: 'open' | 'scheduled' | 'resolved' | 'declined';
  booking_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type SubmissionVersion = {
  id: string;
  submission_id: string;
  version: number;
  note_ar: string | null;
  submitted_at: string;
}

export type SubmissionEvidence = {
  id: string;
  version_id: string;
  kind: EvidenceKind;
  url: string;
  label: string | null;
}

export type Certificate = {
  id: string;
  certificate_code: string;
  profile_id: string;
  kind: CertificateKind;
  course_id: string | null;
  path_id: string | null;
  status: CertificateStatus;
  issued_at: string;
  revoked_reason: string | null;
  snapshot: {
    holder_name: string;
    techmood_id: string;
    title: string;
    kind: CertificateKind;
    stars_avg: number | null;
    total_xp: number | null;
    issued_on: string;
  };
}

export type VerifiedCertificate = {
  certificate_code: string;
  holder_name: string;
  techmood_id: string;
  title: string;
  kind: CertificateKind;
  issued_at: string;
  status: CertificateStatus;
  revoked_reason: string | null;
}

export type XpEvent = {
  id: string;
  profile_id: string;
  source: XpSource;
  xp: number;
  ref_table: string;
  ref_id: string;
  created_at: string;
}

export type ReviewQueueItem = {
  item_kind:
    | 'role_application' | 'submission' | 'payment'
    | 'incubator_application' | 'reevaluation_request';
  item_id: string;
  subject: string | null;
  detail: string | null;
  created_at: string | null;
}

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      profile_roles: Table<ProfileRole>;
      learning_paths: Table<LearningPath>;
      courses: Table<Course>;
      path_courses: Table<{ path_id: string; course_id: string; is_required: boolean; sort_order: number }>;
      modules: Table<{ id: string; course_id: string; title_ar: string; sort_order: number }>;
      lessons: Table<Lesson>;
      assignments: Table<Assignment>;
      lesson_progress: Table<{
        profile_id: string;
        lesson_id: string;
        status: ProgressStatus;
        completed_at: string | null;
        updated_at: string;
      }>;
      enrollments: Table<{
        id: string;
        profile_id: string;
        path_id: string | null;
        course_id: string | null;
        enrolled_at: string;
        completed_at: string | null;
      }>;
      submissions: Table<Submission>;
      submission_versions: Table<SubmissionVersion>;
      submission_evidence: Table<SubmissionEvidence>;
      reevaluation_requests: Table<ReevaluationRequest>;
      evaluations: Table<Evaluation>;
      certificates: Table<Certificate>;
      xp_events: Table<XpEvent>;
      xp_levels: Table<{ min_xp: number; title_ar: string; sort_order: number }>;
      xp_rules: Table<{ source: XpSource; base_xp: number; per_star_xp: number; description_ar: string | null }>;
      schools: Table<{ id: string; slug: string; name_ar: string; name_en: string | null; sort_order: number }>;
      notifications: Table<{
        id: string; profile_id: string; kind: string; title_ar: string;
        body_ar: string | null; link: string | null; is_read: boolean; created_at: string;
      }>;
      mentor_profiles: Table<{
        profile_id: string; level: MentorLevel; headline_ar: string | null; bio_ar: string | null;
        domains: string[]; session_minutes: number; is_accepting: boolean;
        sessions_count: number; rating_avg: number | null;
      }>;
      mentor_levels: Table<{
        level: MentorLevel; session_price_usd: number; platform_share_usd: number;
        mentor_share_usd: number; min_sessions: number; min_rating: number; sort_order: number;
      }>;
    };
    Views: {
      profile_xp: View<{ profile_id: string; total_xp: number }>;
      profile_stars: View<{ profile_id: string; stars_avg: number | null; rated_count: number }>;
      admin_review_queue: View<ReviewQueueItem>;
      wallet_balance: View<{
        profile_id: string; available_usd: number; pending_usd: number; total_earned_usd: number;
      }>;
    };
    Functions: {
      submit_work: {
        Args: { p_assignment_id: string; p_evidence: unknown; p_note?: string | null };
        Returns: string;
      };
      evaluate_submission: {
        Args: {
          p_submission_id: string;
          p_decision: EvaluationDecision;
          p_stars?: number | null;
          p_feedback?: string | null;
          p_score?: number | null;
        };
        Returns: string;
      };
      issue_certificate: {
        Args: { p_kind: CertificateKind; p_target: string };
        Returns: Certificate;
      };
      verify_certificate: { Args: { p_code: string }; Returns: VerifiedCertificate[] };
      is_course_complete: { Args: { p_profile: string; p_course: string }; Returns: boolean };
      is_path_complete: { Args: { p_profile: string; p_path: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_mentor: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
