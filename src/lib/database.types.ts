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

export type RoleStatus =
  | 'approved' | 'pending_review' | 'needs_more_info' | 'rejected' | 'suspended';

export type RoleRequestEvent =
  | 'submitted' | 'more_info_requested' | 'more_info_provided'
  | 'approved' | 'rejected' | 'suspended' | 'reinstated' | 'withdrawn';

export type TaxonomyStatus = 'approved' | 'pending_review' | 'rejected';
export type TaxonomyKind = 'field' | 'interest' | 'skill';
export type AgendaColumn = 'today' | 'in_progress' | 'upcoming' | 'completed';
export type UiLanguage = 'ar' | 'en';

export type LessonKind = 'video' | 'article' | 'reading' | 'exercise' | 'live';

export type ProgressStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/** Where a course sits on the ladder. Read off its position in its path. */
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Catalogue state. 'planned' is content the academy has announced and not
 * written: it carries an outline, never a lesson, so it cannot be started.
 */
export type ContentStatus = 'draft' | 'planned' | 'published' | 'archived';

/** The one vocabulary the academy uses for "how far am I". */
export type LearningStatus = 'not_started' | 'in_progress' | 'completed';

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
export type LedgerKind = 'earning' | 'fee' | 'commission' | 'payout' | 'refund';
export type LedgerStatus = 'pending' | 'available' | 'paid' | 'cancelled';
export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected';

export type WalletEntry = {
  id: string;
  profile_id: string;
  kind: LedgerKind;
  amount_usd: number;
  status: LedgerStatus;
  description_ar: string;
  ref_table: string | null;
  ref_id: string | null;
  created_at: string;
}

export type PayoutAccount = {
  id: string;
  profile_id: string;
  method_key: string;
  label_ar: string | null;
  holder_name: string;
  account_number: string | null;
  wallet_number: string | null;
  iban: string | null;
  swift: string | null;
  bank_name: string | null;
  country: string | null;
  is_default: boolean;
  created_at: string;
}

export type PayoutRequest = {
  id: string;
  request_code: string;
  profile_id: string;
  account_id: string;
  amount_usd: number;
  status: PayoutStatus;
  ledger_entry_id: string | null;
  note_ar: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_reference: string | null;
  created_at: string;
}

export type TeamKind = 'learning' | 'project' | 'freelance' | 'startup';
export type TeamStatus = 'active' | 'completed' | 'archived';
export type TeamVisibility = 'private' | 'listed';
export type TeamJoinPolicy = 'invite_only' | 'request_allowed';
export type TaskColumn = 'todo' | 'doing' | 'blocked' | 'review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SprintStatus = 'planned' | 'active' | 'review' | 'closed';
export type MessageReaction = 'like' | 'love' | 'laugh' | 'wow' | 'thanks' | 'celebrate';
export type ConversationKind = 'admin' | 'team' | 'mentor_booking' | 'learning_path';
export type ProjectStatus = 'planning' | 'in_progress' | 'in_review' | 'completed' | 'archived';
export type StartupStage = 'idea' | 'validation' | 'mvp' | 'users' | 'business_model' | 'startup';
export type CanvasBlock =
  | 'key_partners' | 'key_activities' | 'key_resources' | 'value_propositions'
  | 'customer_relationships' | 'channels' | 'customer_segments'
  | 'cost_structure' | 'revenue_streams';
export type CardColour = 'default' | 'royal' | 'sky' | 'green' | 'amber' | 'rose' | 'violet' | 'slate';
export type PlanSection =
  | 'executive_summary' | 'company_description' | 'market_analysis'
  | 'competitive_analysis' | 'product_and_service' | 'marketing_and_sales'
  | 'operations' | 'team_and_management' | 'financial_plan' | 'risks_and_mitigation';
export type SwotQuadrant = 'strength' | 'weakness' | 'opportunity' | 'threat';
export type OpportunityKind = 'freelance' | 'job' | 'team_seat' | 'cofounder' | 'internship' | 'remote';
export type CompensationKind = 'fixed' | 'hourly' | 'monthly' | 'equity' | 'revenue_share' | 'unpaid';
export type ApplicationStage = 'submitted' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';

export type Opportunity = {
  id: string;
  kind: OpportunityKind;
  title_ar: string;
  organization_ar: string | null;
  description_ar: string | null;
  tags: string[];
  compensation_ar: string | null;
  compensation_kind: CompensationKind | null;
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  location_ar: string | null;
  is_remote: boolean;
  closes_on: string | null;
  seats: number;
  filled_count: number;
  required_skills: string[];
  min_stars: number | null;
  required_path_id: string | null;
  posted_by: string;
  team_id: string | null;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export type OpportunityApplication = {
  id: string;
  opportunity_id: string;
  profile_id: string;
  cover_note_ar: string | null;
  stage: ApplicationStage;
  decided_by: string | null;
  decided_at: string | null;
  decision_note_ar: string | null;
  team_application_id: string | null;
  created_at: string;
}
export type GoalStatus = 'planned' | 'on_track' | 'at_risk' | 'achieved' | 'missed';

export type Startup = {
  id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  founder_id: string;
  team_id: string | null;
  stage: StartupStage;
  users_count: number;
  is_in_incubator: boolean;
  one_liner_ar: string | null;
  problem_ar: string | null;
  solution_ar: string | null;
  website_url: string | null;
  logo_url: string | null;
  founded_on: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type CanvasCard = {
  id: string;
  startup_id: string;
  block: CanvasBlock;
  body_ar: string;
  colour: CardColour;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessPlanSection = {
  startup_id: string;
  section: PlanSection;
  body_ar: string | null;
  is_complete: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type SmartGoal = {
  id: string;
  startup_id: string;
  title_ar: string;
  specific_ar: string;
  achievable_ar: string | null;
  relevant_ar: string | null;
  metric_label_ar: string;
  baseline_value: number;
  target_value: number;
  current_value: number;
  starts_on: string;
  due_on: string;
  status: GoalStatus;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}
export type ExhibitionStatus =
  | 'draft' | 'submitted' | 'under_review' | 'revision_required'
  | 'approved' | 'exhibited' | 'rejected';

/** What a mentor judges a project on. */
export type ReviewCriterion =
  | 'requirements' | 'technical_quality' | 'ui_ux'
  | 'problem_solving' | 'documentation' | 'completeness';

export type ExhibitionDecision = 'approved' | 'revision_required';

export type ProjectKind = 'course' | 'path' | 'capstone' | 'team' | 'startup' | 'personal';

/** Frozen at approval, so the public gallery never reads live workspace data. */
export type ExhibitionSnapshot = {
  project_code: string;
  project_title: string;
  description: string | null;
  summary: string;
  documentation: string | null;
  problem: string | null;
  solution: string | null;
  outcomes: string[];
  technologies: string[];
  demo_url: string | null;
  cover_url: string | null;
  kind: ProjectKind;
  version: number;
  completed_on: string;
  path: { slug: string; title: string } | null;
  school: { slug: string; name: string } | null;
  creator: { profile_id: string; full_name: string; techmood_id: string } | null;
  team: { code: string; title: string } | null;
  members: {
    profile_id: string;
    full_name: string;
    techmood_id: string;
    responsibility: string | null;
    tasks_done: number;
  }[];
  /** The judgement, frozen with the work it judged. */
  evaluation: {
    mentor_name: string;
    mentor_id: string;
    reviewed_on: string;
    feedback: string | null;
    rating: number | null;
    criteria: Partial<Record<ReviewCriterion, number>>;
  } | null;
  evidence: { kind: string; url: string; label: string | null }[];
}

export type ExhibitionEntry = {
  id: string;
  entry_code: string;
  project_id: string;
  team_id: string | null;
  submitted_by: string;
  summary_ar: string;
  technologies: string[];
  demo_url: string | null;
  documentation_ar: string | null;
  status: ExhibitionStatus;
  problem_ar: string | null;
  solution_ar: string | null;
  outcomes_ar: string[];
  cover_url: string | null;
  version: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note_ar: string | null;
  published_at: string | null;
  snapshot: ExhibitionSnapshot | null;
  created_at: string;
}

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
  supports_payout: boolean;
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
  meeting_url: string | null;
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
  username: string | null;
  display_name: string | null;
  language: UiLanguage;
  primary_role: UserRole | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields, interests and skills share a shape but never share a table. */
export type TaxonomyTerm = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  status: TaxonomyStatus;
  suggested_by: string | null;
  created_at: string;
}

export type RoleRequestEventRow = {
  id: string;
  role_request_id: string;
  actor_id: string | null;
  event: RoleRequestEvent;
  note: string | null;
  created_at: string;
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
  status: ContentStatus;
  estimated_hours: number | null;
  sort_order: number;
}

export type Course = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  status: ContentStatus;
  estimated_hours: number | null;
  level: CourseLevel;
}

export type Lesson = {
  id: string;
  module_id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  kind: LessonKind;
  duration_minutes: number | null;
  summary_ar: string | null;
  outcomes_ar: string[];
  case_study_ar: string | null;
  case_question_ar: string | null;
  challenge_ar: string | null;
  sort_order: number;
}

export type LessonVideo = {
  id: string;
  lesson_id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  url: string;
  duration_minutes: number | null;
  sort_order: number;
}

export type VideoSessionType = 'student_mentor' | 'team_mentor' | 'team_internal';
export type VideoSessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'no_show';
export type SessionRole = 'mentor' | 'student' | 'member' | 'leader';
/** Which door is open, decided by the server's clock. */
export type SessionPhase = 'waiting' | 'lobby' | 'live' | 'ended';

export type CalendarEntryKind =
  | 'mentor_session' | 'team_session' | 'team_meeting' | 'task' | 'milestone' | 'sprint';

export type CalendarTone =
  | 'mentor' | 'team' | 'internal' | 'pending' | 'done' | 'cancelled' | 'task' | 'late' | 'milestone' | 'sprint';

export type NeedsActionKey =
  | 'pay' | 'rate' | 'decide' | 'review' | 'verify_payment' | 'payout' | 'empty_session';

export type SessionCriterion =
  | 'quality' | 'clarity' | 'usefulness' | 'punctuality' | 'guidance'
  | 'commitment' | 'preparation' | 'participation' | 'use_of_session' | 'cooperation'
  | 'communication';

export type ProfileAudience = 'public' | 'professional' | 'private';

export type ProfileSection =
  | 'about' | 'identity' | 'stats' | 'skills' | 'achievements' | 'certificates'
  | 'learning' | 'projects' | 'evaluations' | 'teams' | 'experience' | 'education'
  | 'links' | 'external_exhibitions';

export type LinkKind =
  | 'linkedin' | 'github' | 'behance' | 'dribbble' | 'kaggle' | 'youtube'
  | 'portfolio' | 'website' | 'x' | 'other';

export type ExperienceKind = 'job' | 'freelance' | 'volunteer' | 'internship' | 'techmood';

export type GoalStepKind = 'course' | 'path' | 'milestone';

export type GoalMilestone =
  | 'assessment' | 'real_project' | 'portfolio' | 'mentorship' | 'team' | 'work' | 'startup';

/** The column a lesson step sits in. Derived, never stored. */
export type BoardColumn = 'todo' | 'doing' | 'done';

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
  /** The certificate is issued in English; this is the title printed on it. */
  title_en: string | null;
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
      role_request_events: Table<RoleRequestEventRow>;
      fields: Table<TaxonomyTerm>;
      interests: Table<TaxonomyTerm>;
      skills: Table<TaxonomyTerm>;
      lesson_skills: Table<{ lesson_id: string; skill_id: string }>;
      assignment_skills: Table<{ assignment_id: string; skill_id: string }>;
      profile_fields: Table<{ profile_id: string; field_id: string; added_at: string; is_primary: boolean }>;
      focus_sessions: Table<{
        id: string; profile_id: string; planned_minutes: number;
        subject_ar: string | null; ref_table: string | null; ref_id: string | null;
        started_at: string; ended_at: string | null; was_completed: boolean;
      }>;
      profile_interests: Table<{ profile_id: string; interest_id: string; added_at: string }>;
      profile_skills: Table<{ profile_id: string; skill_id: string; is_verified: boolean }>;
      achievements: Table<{
        id: string; slug: string; name_ar: string;
        description_ar: string | null; icon: string | null; xp_award: number;
      }>;
      profile_achievements: Table<{ profile_id: string; achievement_id: string; awarded_at: string }>;
      reputation_dimensions: Table<{ slug: string; name_ar: string; weight: number }>;
      reputation_scores: Table<{
        profile_id: string; dimension: string; value: number; updated_at: string;
      }>;
      learning_paths: Table<LearningPath>;
      courses: Table<Course>;
      path_courses: Table<{ path_id: string; course_id: string; is_required: boolean; sort_order: number }>;
      modules: Table<{ id: string; course_id: string; title_ar: string; sort_order: number }>;
      lessons: Table<Lesson>;
      lesson_videos: Table<LessonVideo>;
      career_goals: Table<{
        id: string; slug: string; title_ar: string; title_en: string | null;
        description_ar: string | null; outcome_ar: string | null; tags: string[];
        status: ContentStatus; sort_order: number; created_at: string;
      }>;
      profile_career_goals: Table<{ profile_id: string; goal_id: string; chosen_at: string }>;
      video_sessions: Table<{
        id: string; session_code: string; booking_id: string | null; team_id: string | null;
        session_type: VideoSessionType; start_at: string; end_at: string;
        status: VideoSessionStatus; ended_at: string | null; created_at: string;
      }>;
      video_session_participants: Table<{
        session_id: string; profile_id: string; role: SessionRole;
      }>;
      profile_section_visibility: Table<{
        profile_id: string; section: ProfileSection; audience: ProfileAudience;
      }>;
      profile_links: Table<{
        id: string; profile_id: string; kind: LinkKind;
        label: string | null; url: string; sort_order: number;
      }>;
      profile_education: Table<{
        id: string; profile_id: string; institution: string; degree: string | null;
        field: string | null; started_on: string | null; ended_on: string | null; is_current: boolean;
      }>;
      profile_experience: Table<{
        id: string; profile_id: string; organisation: string; title: string;
        kind: ExperienceKind; summary: string | null;
        started_on: string | null; ended_on: string | null; is_current: boolean;
      }>;
      external_exhibitions: Table<{
        id: string; profile_id: string; title: string; organiser: string | null;
        role_ar: string | null; result_ar: string | null; evidence_url: string | null;
        held_on: string | null; status: TaxonomyStatus; reviewed_by: string | null;
        reviewed_at: string | null; review_note: string | null; created_at: string;
      }>;
      lesson_resources: Table<{
        id: string; lesson_id: string; label: string; url: string; kind: EvidenceKind;
      }>;
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
        daily_session_limit: number; buffer_minutes: number;
        sessions_count: number; rating_avg: number | null;
        years_experience: number | null; weekly_hours: number | null;
        motivation_ar: string | null; experience_ar: string | null;
        linkedin_url: string | null; portfolio_url: string | null;
        languages: string[]; approved_at: string | null;
      }>;
      projects: Table<{
        id: string; code: string; title_ar: string; description_ar: string | null;
        owner_id: string; team_id: string | null; path_id: string | null;
        status: ProjectStatus; kind: ProjectKind; tags: string[]; is_public: boolean;
        completed_at: string | null; created_at: string; updated_at: string;
      }>;
      exhibition_entries: Table<ExhibitionEntry>;
      opportunities: Table<Opportunity>;
      opportunity_applications: Table<OpportunityApplication>;
      startups: Table<Startup>;
      startup_members: Table<{
        startup_id: string; profile_id: string;
        role: 'founder' | 'cofounder' | 'member' | 'advisor';
        title_ar: string | null; joined_at: string;
      }>;
      canvas_cards: Table<CanvasCard>;
      business_plan_sections: Table<BusinessPlanSection>;
      startup_strategy: Table<{
        startup_id: string; vision_ar: string | null; mission_ar: string | null;
        values_ar: string[]; updated_at: string;
      }>;
      swot_items: Table<{
        id: string; startup_id: string; quadrant: SwotQuadrant; body_ar: string; sort_order: number;
      }>;
      smart_goals: Table<SmartGoal>;
      startup_stage_history: Table<{
        id: string; startup_id: string; stage: StartupStage; note_ar: string | null;
        changed_by: string | null; changed_at: string;
      }>;
      incubator_applications: Table<{
        id: string; startup_id: string; pitch_ar: string; status: RoleStatus;
        reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
        stage_at_application: StartupStage | null; plan_percent_at_application: number | null;
        created_at: string;
      }>;
      project_evidence: Table<{
        id: string; project_id: string; kind: EvidenceKind; url: string;
        label: string | null; created_at: string;
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
      wallet_entries: Table<WalletEntry>;
      payout_accounts: Table<PayoutAccount>;
      payout_requests: Table<PayoutRequest>;
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
      business_plan_progress: View<{
        startup_id: string; completed_sections: number; total_sections: number; percent: number;
      }>;
      smart_goal_progress: View<{
        goal_id: string; startup_id: string; percent: number; time_elapsed_percent: number;
      }>;
      exhibition_gallery: View<{
        entry_code: string; published_at: string; snapshot: ExhibitionSnapshot;
      }>;
      conversation_unread: View<{
        conversation_id: string; profile_id: string; unread_count: number; last_message_at: string | null;
      }>;
      wallet_balance: View<{
        profile_id: string; available_usd: number; pending_usd: number;
        total_earned_usd: number; total_paid_out_usd: number;
      }>;
    };
    Functions: {
      activity_days: {
        Args: { p_from: string; p_to: string };
        Returns: { on_date: string; sources: string[] }[];
      };
      current_streak: { Args: Record<string, never>; Returns: number };
      academy_paths: {
        Args: Record<string, never>;
        Returns: {
          id: string; slug: string; title_ar: string; title_en: string | null;
          description_ar: string | null; tagline_ar: string | null;
          tags: string[]; estimated_hours: number | null;
          school_slug: string | null; school_name_ar: string | null; school_name_en: string | null;
          courses_total: number; courses_done: number; percent: number;
          is_enrolled: boolean; is_complete: boolean; status: LearningStatus;
          level_from: CourseLevel | null; level_to: CourseLevel | null;
          last_activity: string | null;
        }[];
      };
      career_goals_catalogue: {
        Args: Record<string, never>;
        Returns: {
          id: string; slug: string; title_ar: string; title_en: string | null;
          description_ar: string | null; outcome_ar: string | null; tags: string[];
          steps_total: number; steps_done: number; percent: number; is_chosen: boolean;
        }[];
      };
      career_goal_plan: {
        Args: { p_goal: string };
        Returns: {
          step_id: string; kind: GoalStepKind; sort_order: number;
          title_ar: string; title_en: string | null; note_ar: string | null;
          slug: string | null; path_slug: string | null;
          milestone: GoalMilestone | null;
          is_done: boolean; is_open: boolean; percent: number | null;
        }[];
      };
      choose_career_goal: { Args: { p_goal: string }; Returns: void };
      clear_career_goal: { Args: Record<string, never>; Returns: void };
      lesson_skills_all: {
        Args: { p_lesson: string };
        Returns: { id: string; slug: string; name_ar: string; name_en: string }[];
      };
      course_skills: {
        Args: { p_course: string };
        Returns: { id: string; slug: string; name_ar: string; name_en: string }[];
      };
      path_skills: {
        Args: { p_path: string };
        Returns: { id: string; slug: string; name_ar: string; name_en: string }[];
      };
      submission_skills: {
        Args: { p_submission: string };
        Returns: { id: string; slug: string; name_ar: string; name_en: string }[];
      };
      my_sessions: {
        Args: { p_past?: boolean };
        Returns: {
          id: string; session_code: string; session_type: VideoSessionType;
          start_at: string; end_at: string; status: VideoSessionStatus;
          phase: SessionPhase; my_role: SessionRole;
          counterpart: string | null; participants: number;
        }[];
      };
      session_phase: { Args: { p_session: string }; Returns: SessionPhase };
      server_now: { Args: Record<string, never>; Returns: string };
      join_video_session: { Args: { p_session: string }; Returns: SessionPhase };
      leave_video_session: { Args: { p_session: string }; Returns: undefined };
      schedule_internal_session: {
        Args: { p_team: string; p_start: string; p_end: string; p_members?: string[] | null };
        Returns: { id: string; session_code: string; start_at: string; end_at: string };
      };
      session_attendance: {
        Args: { p_session: string };
        Returns: {
          profile_id: string; full_name: string; role: SessionRole;
          first_joined: string | null; last_left: string | null;
          entries: number; minutes: number; is_present: boolean;
        }[];
      };
      rate_session: {
        Args: { p_booking: string; p_scores: Partial<Record<SessionCriterion, number>>; p_comment?: string | null };
        Returns: string;
      };
      session_feedback_is_open: { Args: { p_booking: string }; Returns: boolean };
      session_feedback_for: {
        Args: { p_booking: string };
        Returns: {
          from_profile: string; from_name: string; to_profile: string;
          stars: number; comment_ar: string | null;
          criteria: Partial<Record<SessionCriterion, number>>; created_at: string;
        }[];
      };
      profile_card: {
        Args: { p_techmood_id: string };
        Returns: {
          profile_id: string; techmood_id: string; full_name: string;
          display_name: string | null; username: string | null;
          headline: string | null; bio: string | null; avatar_url: string | null;
          primary_field: string | null; level_no: number | null; level_title: string | null;
          points: number; stars_avg: number | null; rated_count: number;
          projects: number; certificates: number; courses_done: number; paths_done: number;
          sessions: number; teams: number; achievements: number; skills_proven: number;
          updated_at: string;
        }[];
      };
      profile_learning: {
        Args: { p_profile: string };
        Returns: {
          path_slug: string; title_ar: string; title_en: string | null;
          school_name: string | null; courses_total: number; courses_done: number;
          percent: number; is_complete: boolean; last_activity: string | null;
        }[];
      };
      profile_focus: {
        Args: { p_profile: string };
        Returns: {
          path_slug: string; path_title: string; course_slug: string;
          course_title: string; lesson_title: string;
        }[];
      };
      profile_reputation: {
        Args: { p_profile: string };
        Returns: { dimension: string; name_ar: string; value: number }[];
      };
      can_see_profile_section: {
        Args: { p_profile: string; p_section: ProfileSection };
        Returns: boolean;
      };
      review_external_exhibition: {
        Args: { p_entry: string; p_approve: boolean; p_note?: string | null };
        Returns: undefined;
      };
      profile_verified_skills: {
        Args: { p_profile: string };
        Returns: { slug: string; name_ar: string; name_en: string }[];
      };
      lesson_board: {
        Args: { p_lesson: string };
        Returns: {
          step_key: string; title_ar: string; title_en: string | null;
          column_key: BoardColumn; detail_ar: string | null;
          is_optional: boolean; sort_order: number;
        }[];
      };
      academy_roadmap: {
        Args: Record<string, never>;
        Returns: {
          id: string; slug: string; title_ar: string; title_en: string | null;
          description_ar: string | null; tags: string[]; sort_order: number;
          school_slug: string | null; school_name_ar: string | null; school_name_en: string | null;
          deep_titles_ar: string[]; deep_titles_en: string[];
          exposure_titles_ar: string[]; exposure_titles_en: string[];
        }[];
      };
      academy_courses: {
        Args: Record<string, never>;
        Returns: {
          id: string; slug: string; title_ar: string; title_en: string | null;
          description_ar: string | null; estimated_hours: number | null; level: CourseLevel;
          modules_count: number; lessons_count: number; lessons_done: number;
          percent: number; is_complete: boolean; status: LearningStatus;
          xp_award: number | null;
          path_slugs: string[]; path_titles_ar: string[]; path_titles_en: string[];
          school_slugs: string[]; in_enrolled_path: boolean;
        }[];
      };
      continue_learning: {
        Args: Record<string, never>;
        Returns: {
          path_id: string; path_slug: string; path_title: string;
          course_id: string; course_slug: string; course_title: string;
          lesson_id: string; lesson_title: string;
          path_percent: number; course_percent: number; last_activity: string;
        }[];
      };
      student_agenda: {
        Args: { p_horizon_days?: number };
        Returns: {
          entry_kind: string; entry_id: string; title_ar: string;
          detail_ar: string | null; bucket: AgendaColumn;
          due_on: string | null; link: string;
        }[];
      };
      student_progress: {
        Args: Record<string, never>;
        Returns: {
          paths_joined: number; paths_completed: number; courses_completed: number;
          lessons_completed: number; work_approved: number; assessments_passed: number;
          sessions_attended: number; team_tasks_done: number; certificates: number;
          achievements: number; skills_total: number; skills_verified: number;
        }[];
      };
      suggested_opportunities: {
        Args: { p_limit?: number };
        Returns: {
          id: string; title_ar: string; kind: OpportunityKind;
          organization_ar: string | null; tags: string[];
          required_skills: string[]; matched_skills: string[]; is_eligible: boolean;
        }[];
      };
      suggested_mentors: {
        Args: { p_limit?: number };
        Returns: {
          profile_id: string; full_name: string; display_name: string | null;
          avatar_url: string | null; headline_ar: string | null; level: MentorLevel;
          rating_avg: number; sessions_count: number; price_usd: number;
          shared_fields: string[];
        }[];
      };
      leaderboard_students_ranked: {
        Args: { p_since?: string | null; p_limit?: number };
        Returns: {
          rank: number; profile_id: string; techmood_id: string; name: string;
          avatar_url: string | null; points: number; stars: number; achievements: number;
        }[];
      };
      leaderboard_mentors_ranked: {
        Args: { p_since?: string | null; p_limit?: number };
        Returns: {
          rank: number; profile_id: string; name: string; avatar_url: string | null;
          points: number; stars: number; sessions: number; evaluations: number;
        }[];
      };
      leaderboard_teams_ranked: {
        Args: { p_since?: string | null; p_limit?: number };
        Returns: {
          rank: number; team_id: string; name: string; avatar_url: string | null;
          points: number; stars: number; projects: number; members: number;
        }[];
      };
      leaderboard_companies_ranked: {
        Args: { p_since?: string | null; p_limit?: number };
        Returns: {
          rank: number; profile_id: string; name: string; avatar_url: string | null;
          opportunities: number; seats_filled: number; accepted: number;
        }[];
      };
      my_leaderboard_rank: { Args: { p_since?: string | null }; Returns: number };
      cancel_booking: { Args: { p_booking: string; p_reason?: string | null }; Returns: undefined };
      set_meeting_url: { Args: { p_booking: string; p_url: string }; Returns: undefined };
      is_username_available: { Args: { p_username: string }; Returns: boolean };
      can_enter_role: { Args: { p_role: UserRole }; Returns: boolean };
      suggest_taxonomy_term: {
        Args: { p_kind: TaxonomyKind; p_name_ar: string; p_name_en: string };
        Returns: string;
      };
      review_taxonomy_term: {
        Args: { p_kind: TaxonomyKind; p_term_id: string; p_approve: boolean };
        Returns: undefined;
      };
      apply_for_role: {
        Args: { p_role: UserRole; p_note?: string | null; p_evidence_url?: string | null };
        Returns: string;
      };
      answer_role_request: { Args: { p_request: string; p_note: string }; Returns: undefined };
      decide_role_request: {
        Args: { p_request: string; p_decision: RoleRequestEvent; p_note?: string | null };
        Returns: undefined;
      };
      withdraw_role_request: { Args: { p_request: string }; Returns: undefined };
      submit_mentor_application: {
        Args: {
          p_headline: string;
          p_bio: string;
          p_domains: string[];
          p_years: number;
          p_weekly_hours: number;
          p_motivation: string;
          p_experience: string;
          p_linkedin_url?: string | null;
          p_portfolio_url?: string | null;
          p_languages?: string[];
        };
        Returns: string;
      };
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
      mentor_day_load: {
        Args: { p_date?: string };
        Returns: { booked: number; day_limit: number }[];
      };
      my_calendar: {
        Args: { p_from: string; p_to: string };
        Returns: {
          entry_kind: CalendarEntryKind; entry_id: string;
          title_ar: string; detail_ar: string | null;
          starts_at: string | null; ends_at: string | null; on_date: string;
          state: string; tone: CalendarTone; link: string;
        }[];
      };
      needs_action: {
        Args: Record<string, never>;
        Returns: { action_key: NeedsActionKey; label_ar: string; count: number; link: string }[];
      };
      booking_stats: {
        Args: Record<string, never>;
        Returns: {
          upcoming: number; pending: number; completed: number; this_month: number; hours: number;
          today_as_mentor: number; mentor_upcoming: number; mentor_pending: number;
          mentor_done: number; mentor_earnings: number;
        }[];
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
      team_calendar: {
        Args: { p_team: string; p_from: string; p_to: string };
        Returns: {
          entry_kind: string; entry_id: string; title_ar: string;
          on_date: string; detail_ar: string | null;
        }[];
      };
      transfer_team_leadership: { Args: { p_team: string; p_to: string }; Returns: undefined };
      can_post_opportunity: { Args: { p_kind: OpportunityKind; p_team?: string | null }; Returns: boolean };
      opportunity_match: {
        Args: { p_opportunity: string; p_profile: string };
        Returns: {
          meets_stars: boolean; meets_path: boolean; matched_skills: string[];
          missing_skills: string[]; profile_stars: number; profile_xp: number;
        }[];
      };
      apply_to_opportunity: { Args: { p_opportunity: string; p_cover?: string | null }; Returns: OpportunityApplication };
      decide_opportunity_application: {
        Args: { p_application: string; p_stage: ApplicationStage; p_note?: string | null };
        Returns: undefined;
      };
      applicant_evidence: {
        Args: { p_application: string };
        Returns: {
          full_name: string; techmood_id: string; headline: string | null;
          github_url: string | null; linkedin_url: string | null;
          total_xp: number; stars_avg: number; certificates: number;
          published_work: number; approved_submissions: number;
        }[];
      };
      move_canvas_card: { Args: { p_card: string; p_block: CanvasBlock; p_index?: number | null }; Returns: undefined };
      apply_to_incubator: { Args: { p_startup: string; p_pitch: string }; Returns: unknown };
      review_incubator_application: {
        Args: { p_application: string; p_approve: boolean; p_note?: string | null };
        Returns: undefined;
      };
      can_edit_startup: { Args: { p_startup: string }; Returns: boolean };
      can_view_startup_workspace: { Args: { p_startup: string }; Returns: boolean };
      request_payout: { Args: { p_account: string; p_amount: number }; Returns: PayoutRequest };
      review_payout: {
        Args: { p_request: string; p_approve: boolean; p_reference?: string | null; p_note?: string | null };
        Returns: undefined;
      };
      refund_booking: { Args: { p_booking: string; p_reason?: string | null }; Returns: undefined };
      submit_to_exhibition: {
        Args: {
          p_project: string; p_summary: string; p_technologies?: string[];
          p_demo_url?: string | null; p_documentation?: string | null;
          p_problem?: string | null; p_solution?: string | null;
          p_outcomes?: string[]; p_cover_url?: string | null;
        };
        Returns: ExhibitionEntry;
      };
      start_exhibition_review: { Args: { p_entry: string }; Returns: undefined };
      review_exhibition_entry: {
        Args: {
          p_entry: string; p_approve: boolean; p_note?: string | null;
          p_scores?: Partial<Record<ReviewCriterion, number>>;
        };
        Returns: undefined;
      };
      publish_exhibition_entry: {
        Args: { p_entry: string; p_public?: boolean };
        Returns: undefined;
      };
      verify_exhibition_entry: {
        Args: { p_code: string };
        Returns: {
          entry_code: string; project_title: string; project_code: string;
          built_by: string | null; is_team: boolean; kind: ProjectKind;
          path_title: string | null; completed_on: string; published_at: string;
          mentor_name: string | null; reviewed_on: string | null;
          rating: number | null; is_verified: boolean;
        }[];
      };
      exhibition_entry_history: {
        Args: { p_code: string };
        Returns: {
          version: number; decision: ExhibitionDecision;
          rating: number | null; reviewed_on: string;
        }[];
      };
      exhibition_featured: {
        Args: { p_limit?: number };
        Returns: { entry_code: string; published_at: string; snapshot: ExhibitionSnapshot }[];
      };
      exhibition_entry_reviews: {
        Args: { p_entry: string };
        Returns: {
          version: number; mentor_name: string; decision: ExhibitionDecision;
          feedback_ar: string | null; rating: number | null; created_at: string;
        }[];
      };
      project_contributions: {
        Args: { p_project: string };
        Returns: {
          profile_id: string; full_name: string; techmood_id: string;
          responsibility_ar: string | null; tasks_done: number;
        }[];
      };
      profile_exhibition_entries: {
        Args: { p_profile: string };
        Returns: {
          entry_code: string; project_title: string; team_title: string | null;
          published_at: string; tasks_done: number;
        }[];
      };
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
