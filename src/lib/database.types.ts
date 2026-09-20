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

export type BookingStatus =
  | 'draft' | 'payment_pending' | 'payment_submitted' | 'payment_verified'
  | 'mentor_pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
  | 'refunded' | 'expired';

export type PaymentStatus =
  | 'pending' | 'under_review' | 'verified' | 'rejected' | 'failed' | 'refunded';

export type SlotState = 'available' | 'pending' | 'booked' | 'unavailable';

export type TeamKind = 'learning' | 'project' | 'freelance' | 'startup';
export type TeamStatus = 'active' | 'completed' | 'archived';
export type TeamVisibility = 'private' | 'listed';
export type TeamJoinPolicy = 'invite_only' | 'request_allowed';
export type TaskColumn = 'todo' | 'doing' | 'blocked' | 'review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SprintStatus = 'planned' | 'active' | 'review' | 'closed';
export type MessageReaction = 'like' | 'love' | 'laugh' | 'wow' | 'thanks' | 'celebrate';
export type ConversationKind = 'admin' | 'team' | 'mentor_booking' | 'learning_path';

export type Team = {
  id: string;
  slug: string;
  team_code: string;
  title_ar: string;
  description_ar: string | null;
  leader_id: string;
  needs: string[];
  is_open: boolean;
  path_id: string | null;
  kind: TeamKind;
  status: TeamStatus;
  visibility: TeamVisibility;
  join_policy: TeamJoinPolicy;
  avatar_url: string | null;
  focus_ar: string | null;
  public_summary_ar: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamMember = {
  team_id: string;
  profile_id: string;
  role: 'leader' | 'member' | 'mentor';
  title_ar: string | null;
  responsibility_ar: string | null;
  is_active: boolean;
  joined_at: string;
}

export type TeamTask = {
  id: string;
  team_id: string;
  title_ar: string;
  description_ar: string | null;
  column_key: TaskColumn;
  priority: TaskPriority;
  assignee_id: string | null;
  sprint_id: string | null;
  project_id: string | null;
  due_on: string | null;
  blocked_reason_ar: string | null;
  completed_at: string | null;
  xp_reward: number;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type Sprint = {
  id: string;
  team_id: string;
  number: number;
  goal_ar: string | null;
  starts_on: string;
  ends_on: string;
  status: SprintStatus;
  review_ar: string | null;
  reflection_ar: string | null;
  created_at: string;
}

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body_ar: string;
  is_system: boolean;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export type Conversation = {
  id: string;
  kind: ConversationKind;
  title_ar: string | null;
  team_id: string | null;
  booking_id: string | null;
  path_id: string | null;
  is_read_only: boolean;
  archived_at: string | null;
  created_at: string;
}

export type SessionType = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  duration_minutes: number;
  sort_order: number;
  is_active: boolean;
}

export type PaymentMethod = {
  key: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  category: 'local' | 'international';
  is_enabled: boolean;
  sort_order: number;
  instructions_ar: string | null;
  recipient_name: string | null;
  account_number: string | null;
  wallet_number: string | null;
  iban: string | null;
  swift: string | null;
  bank_name: string | null;
  bank_address: string | null;
  city: string | null;
  country: string | null;
  requires_receipt: boolean;
  requires_reference: boolean;
  reference_label_ar: string | null;
  supports_automatic_payment: boolean;
}

export type Booking = {
  id: string;
  booking_code: string;
  kind: 'student_mentor' | 'team_mentor';
  student_id: string | null;
  team_id: string | null;
  mentor_id: string;
  session_type_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: BookingStatus;
  seats: number;
  price_usd: number;
  platform_share_usd: number;
  mentor_share_usd: number;
  topic_ar: string | null;
  session_goal_ar: string | null;
  notes_ar: string | null;
  reserved_until: string | null;
  mentor_decided_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type Payment = {
  id: string;
  booking_id: string;
  method_key: string;
  amount_usd: number;
  status: PaymentStatus;
  reference: string | null;
  proof_path: string | null;
  submitted_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  created_at: string;
}

export type BookingEvent = {
  id: string;
  booking_id: string;
  event_key: string;
  note_ar: string | null;
  actor_id: string | null;
  created_at: string;
}

export type BookingReviewItem = {
  id: string;
  booking_id: string;
  item_kind: 'submission' | 'project' | 'course' | 'learning_path' | 'certificate' | 'career_goal';
  item_id: string | null;
  label_ar: string;
  created_at: string;
}

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
  phone: string | null;
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
      projects: Table<{
        id: string; code: string; title_ar: string; description_ar: string | null;
        owner_id: string; team_id: string | null; path_id: string | null;
        status: 'planning' | 'in_progress' | 'in_review' | 'completed' | 'archived';
        tags: string[]; is_public: boolean; created_at: string; updated_at: string;
      }>;
      teams: Table<Team>;
      team_members: Table<TeamMember>;
      team_tasks: Table<TeamTask>;
      sprints: Table<Sprint>;
      messages: Table<Message>;
      conversations: Table<Conversation>;
      conversation_participants: Table<{
        conversation_id: string; profile_id: string; last_read_at: string | null; joined_at: string;
      }>;
      message_reactions: Table<{
        message_id: string; profile_id: string; reaction: MessageReaction; created_at: string;
      }>;
      team_permissions: Table<{
        team_id: string; members_create_tasks: boolean; members_assign_tasks: boolean;
        members_invite: boolean; members_manage_docs: boolean; members_book_mentor: boolean;
        members_edit_project: boolean;
      }>;
      team_invites: Table<{
        id: string; team_id: string; invitee_id: string | null; token: string;
        responsibility_ar: string | null; invited_by: string; status: string;
        expires_at: string; created_at: string;
      }>;
      team_activity: Table<{
        id: string; team_id: string; actor_id: string | null; verb: string;
        task_id: string | null; subject_ar: string | null; created_at: string;
      }>;
      task_checklist_items: Table<{
        id: string; task_id: string; label_ar: string; is_done: boolean; sort_order: number;
      }>;
      task_comments: Table<{
        id: string; task_id: string; author_id: string; body_ar: string; created_at: string;
      }>;
      team_documents: Table<{
        id: string; team_id: string; kind: string; title_ar: string; body_ar: string | null;
        url: string | null; project_id: string | null; task_id: string | null;
        author_id: string; created_at: string; updated_at: string;
      }>;
      session_types: Table<SessionType>;
      payment_methods: Table<PaymentMethod>;
      bookings: Table<Booking>;
      payments: Table<Payment>;
      booking_events: Table<BookingEvent>;
      booking_review_items: Table<BookingReviewItem>;
      mentor_session_types: Table<{ mentor_id: string; session_type_id: string; is_active: boolean }>;
      mentor_availability: Table<{
        id: string; mentor_id: string; day_of_week: number; start_time: string; end_time: string;
      }>;
      platform_settings: Table<{ key: string; value: string; description_ar: string | null }>;
      mentor_levels: Table<{
        level: MentorLevel; session_price_usd: number; platform_share_usd: number;
        mentor_share_usd: number; min_sessions: number; min_rating: number; sort_order: number;
      }>;
    };
    Views: {
      profile_xp: View<{ profile_id: string; total_xp: number }>;
      profile_stars: View<{ profile_id: string; stars_avg: number | null; rated_count: number }>;
      admin_review_queue: View<ReviewQueueItem>;
      team_xp: View<{ team_id: string; total_xp: number }>;
      team_stars: View<{ team_id: string; stars_avg: number | null; reviews_count: number }>;
      conversation_unread: View<{
        conversation_id: string; profile_id: string; unread_count: number; last_message_at: string | null;
      }>;
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
      mentor_available_slots: {
        Args: { p_mentor: string; p_from: string; p_to: string };
        Returns: { slot_start: string; slot_end: string; state: SlotState }[];
      };
      create_booking_request: {
        Args: {
          p_mentor: string; p_session_type: string; p_starts_at: string;
          p_method_key: string; p_goal?: string | null; p_review_items?: unknown;
        };
        Returns: Booking;
      };
      submit_payment_proof: {
        Args: { p_booking_id: string; p_proof_path?: string | null; p_reference?: string | null };
        Returns: undefined;
      };
      verify_payment: {
        Args: { p_payment_id: string; p_approve: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      accept_team_invite: { Args: { p_token: string }; Returns: string };
      team_permission: { Args: { p_team: string; p_permission: string }; Returns: boolean };
      is_team_member: { Args: { p_team: string }; Returns: boolean };
      is_team_leader: { Args: { p_team: string }; Returns: boolean };
      mentor_decide_booking: {
        Args: { p_booking_id: string; p_accept: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      is_course_complete: { Args: { p_profile: string; p_course: string }; Returns: boolean };
      is_path_complete: { Args: { p_profile: string; p_path: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_mentor: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
