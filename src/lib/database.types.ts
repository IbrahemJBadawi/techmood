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
  | 'student' | 'mentee' | 'freelancer' | 'client' | 'mentor'
  | 'team_leader' | 'founder' | 'company' | 'admin';

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
// The enum still has L4–L6 (Postgres cannot drop enum values); 0120 lets a
// mentor and a level row hold only these three.
export type MentorLevel = 'L1' | 'L2' | 'L3';
/** What a finished course is rated on (0080). */
export type CourseCriterion = 'content' | 'clarity' | 'practice' | 'pace' | 'usefulness';
/** Why a mentor is not taking requests: their choice, a holiday, or unanswered requests (0077). */
export type MentorPauseReason = 'manual' | 'vacation' | 'unresponsive';

export type BookingStatus =
  | 'draft' | 'payment_pending' | 'payment_submitted' | 'payment_verified'
  | 'mentor_pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
  | 'refunded' | 'expired';

export type PaymentStatus =
  | 'pending' | 'under_review' | 'needs_info' | 'verified' | 'rejected' | 'failed' | 'refunded';

export type SlotState = 'available' | 'instant' | 'pending' | 'booked' | 'unavailable';
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

export type FinanceEntity = 'payment' | 'payout' | 'escrow';

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
  /** When an admin started sending it (status 'approved' = processing). */
  processing_at: string | null;
  /** The admin's receipt, a path in the private payout-proofs bucket. */
  proof_path: string | null;
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
export type ConversationKind = 'channel' | 'admin' | 'team' | 'mentor_booking' | 'market' | 'learning_path';
export type ProjectStatus = 'planning' | 'in_progress' | 'in_review' | 'completed' | 'sold' | 'archived';
export type StartupStage =
  | 'idea' | 'validation' | 'business_model' | 'mvp'
  | 'market_test' | 'first_customers' | 'revenue' | 'growth';

export type StartupMemberRole =
  | 'founder' | 'cofounder' | 'manager' | 'member' | 'employee'
  | 'freelancer' | 'advisor' | 'viewer';

export type OrgKind = 'startup' | 'company';

export type NotificationKind =
  | 'evaluation' | 'academy' | 'booking' | 'payment' | 'team' | 'work' | 'project'
  | 'message' | 'certificate' | 'role_review' | 'security' | 'system' | 'support'
  | 'reminder' // the daily reminders (0114)
  | 'new_members'; // the admins' new-member alerts (0148)

/** Help & Reports (0082–0083). */
export type TicketCategory =
  | 'payment' | 'booking' | 'mentor' | 'mentee' | 'freelancer' | 'client'
  | 'content' | 'account' | 'behavior' | 'fraud' | 'copyright' | 'technical' | 'other';
export type TicketStatus =
  | 'open' | 'assistant' | 'needs_human' | 'pending_user' | 'under_review' | 'resolved' | 'rejected' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketAuthor = 'user' | 'assistant' | 'admin' | 'system';
export type TicketRelated =
  | 'booking' | 'payment' | 'escrow' | 'project' | 'team' | 'video_session'
  | 'course' | 'profile' | 'opportunity' | 'payout' | 'message';

export type CaseStatus = 'open' | 'investigating' | 'awaiting_info' | 'decided' | 'closed';
export type AdminActionKind =
  | 'request_info' | 'warn' | 'restrict_feature' | 'suspend_session' | 'cancel_booking'
  | 'refund' | 'reject_report' | 'resolve' | 'escalate' | 'suspend_account' | 'lift_restriction';
export type RestrictedFeature = 'booking' | 'messaging' | 'marketplace' | 'withdrawals' | 'reviews' | 'everything';
export type CaseLinkType =
  | 'ticket' | 'profile' | 'booking' | 'payment' | 'escrow' | 'project'
  | 'video_session' | 'message' | 'payout' | 'course' | 'opportunity' | 'team';

export type SupportTicket = {
  id: string; code: string; reporter_id: string; category: TicketCategory;
  related_type: TicketRelated | null; related_id: string | null; reported_profile_id: string | null;
  subject_ar: string; status: TicketStatus; priority: TicketPriority; needs_human: boolean;
  escalation_reason: string | null; ai_category: TicketCategory | null; ai_confidence: number | null;
  ai_suggested_action: string | null; ai_summary_ar: string | null; assigned_to: string | null;
  case_id: string | null; created_at: string; updated_at: string; resolved_at: string | null;
};

export type NotifyPriority = 'critical' | 'important' | 'normal' | 'info';
export type EmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

export type RoadmapStatus = 'planned' | 'in_progress' | 'done' | 'dropped';
export type ShareScope = 'canvas' | 'plan' | 'roadmap' | 'showcase';

export type CanvasKind =
  | 'business_model' | 'lean' | 'value_proposition' | 'market' | 'competitors'
  | 'persona' | 'customer_journey' | 'financial' | 'funding' | 'mvp'
  | 'validation' | 'pitch' | 'custom';

export type CanvasVisibility = 'workspace' | 'mentors' | 'public';

export type CompanyDocumentKind =
  | 'business_plan' | 'feasibility' | 'pitch_deck' | 'financial' | 'strategy'
  | 'market_research' | 'report' | 'legal' | 'certificate' | 'other';
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
export type ApplicationStage =
  | 'submitted' | 'under_review' | 'shortlisted' | 'interview' | 'offer'
  | 'accepted' | 'declined' | 'withdrawn';

export type EscrowStatus =
  | 'awaiting_payment' | 'funded' | 'released' | 'refunded' | 'disputed' | 'cancelled';

export type EscrowKind = 'market_work' | 'project_sale';
export type TermsStatus = 'offered' | 'accepted' | 'superseded' | 'withdrawn';
export type ListingStatus = 'pending_review' | 'listed' | 'reserved' | 'sold' | 'withdrawn' | 'rejected';
export type SaleLicence = 'usage_rights' | 'full_transfer';
/** What a project page sells or shows (0121). */
export type ProductType = 'full_project' | 'template' | 'design' | 'code' | 'file' | 'digital_service';
export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn' | 'expired' | 'used';
export type ProjectLink = { kind: string; url: string };

/** What a company asks TechMood for (0150). */
export type BusinessNeed = 'hire' | 'project' | 'training' | 'sponsor' | 'other';
export type BlogCategory = 'news' | 'stories' | 'guides' | 'careers';
/** One workshop as the list shows it (workshop_list, 0150). */
export type WorkshopRow = {
  id: string; title: string; description: string; starts_at: string; duration_minutes: number;
  capacity: number | null; registered: number; is_registered: boolean; is_live: boolean; status: 'scheduled' | 'cancelled';
  host_id: string; host_name: string | null; host_avatar: string | null; has_recording?: boolean;
};

/** One card in the gallery or the market (gallery_projects, 0121). */
export type ShowcaseCard = {
  project_id: string; code: string; title: string; tagline: string | null; cover: string | null;
  category: string | null; product_type: ProductType | null; technologies: string[];
  owner_id: string; owner_name: string | null; team_title: string | null;
  in_gallery: boolean; gallery_at: string | null;
  listing_id: string | null; listing_status: ListingStatus | null; price_usd: number | null; effective_price: number | null;
  discount_pct: number; negotiable: boolean; licence: SaleLicence | null; verified: boolean;
  likes: number; views: number; sales_count: number; rating: number | null; reviews_count: number;
  academic_title: string | null; mentor_rating: number | null;
  comments_count: number; owner_avatar: string | null;
};

/** One public project page (showcase_project, 0121). */
export type ShowcasePage = {
  project_id: string; code: string; title: string; tagline: string | null; description: string | null;
  images: string[]; links: ProjectLink[]; demo_url: string | null; video_url: string | null;
  category: string | null; product_type: ProductType | null; technologies: string[]; skills: string[];
  status: ProjectStatus; completed_at: string | null;
  owner_id: string; owner_name: string | null; owner_techmood_id: string | null; owner_avatar: string | null;
  team_title: string | null; team_code: string | null;
  in_gallery: boolean; gallery_at: string | null; hidden_note: string | null; is_public_page: boolean; can_edit: boolean;
  path_title: string | null; path_slug: string | null; course_title: string | null; course_slug: string | null;
  assignment_title: string | null; mentor_rating: number | null; exhibition_code: string | null;
  listing_id: string | null; listing_code: string | null; listing_status: ListingStatus | null; licence: SaleLicence | null;
  price_usd: number | null; effective_price: number | null; discount_pct: number; discount_ends_at: string | null;
  negotiable: boolean; listing_summary: string | null; includes: string[] | null; verified: boolean;
  likes: number; views: number; link_clicks: number; sales_count: number; rating: number | null; reviews_count: number;
};
export type ClientCriterion =
  | 'quality' | 'communication' | 'deadline' | 'professionalism' | 'scope';

export type MarketSaveKind = 'opportunity' | 'talent' | 'team';
export type InviteStatus = 'sent' | 'accepted' | 'declined';
export type TrustSignal = 'skills' | 'certificates' | 'exhibited' | 'evaluations' | 'client_work';
export type MarketBucket = 'application' | 'invite' | 'work' | 'saved';

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
  visibility: OpportunityVisibility;
  posted_by: string;
  team_id: string | null;
  startup_id: string | null;
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
  proposed_amount_usd: number | null;
  proposed_days: number | null;
  shared_sections: string[];
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
  kind: OrgKind;
  industry_ar: string | null;
  location_ar: string | null;
  created_at: string;
  updated_at: string;
}

export type CanvasCard = {
  id: string;
  startup_id: string;
  /** The nine-block enum, kept in step for the Business Model canvas. */
  block: CanvasBlock | null;
  canvas_id: string | null;
  block_key: string | null;
  body_ar: string;
  colour: CardColour;
  note_ar: string | null;
  owner_id: string | null;
  tags: string[];
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

export type ProjectKind = 'course' | 'path' | 'capstone' | 'team' | 'startup' | 'personal' | 'client';

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
  offers_services: boolean;
  service_summary_ar: string | null;
  rate_from_usd: number | null;
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
  application_id: string | null;
  project_id: string | null;
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

/**
 * What anybody signed in may read about a payment method: its name, its
 * instructions, what it requires. Since 0075 the receiving details below are
 * column-locked — readable only through `payment_instructions()` by someone
 * with a payment to make, and by admins.
 */
export type PaymentMethodPublic = {
  key: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  category: 'local' | 'international';
  is_enabled: boolean;
  sort_order: number;
  instructions_ar: string | null;
  requires_receipt: boolean;
  requires_reference: boolean;
  reference_label_ar: string | null;
  supports_automatic_payment: boolean;
  supports_payout: boolean;
  use_for: string[];
  display_fields: PayField[];
  international_fields: PayField[];
};

/** The receiving fields a method may show a payer, in the order it shows them. */
export type PayField =
  | 'recipient_name' | 'bank_name' | 'account_number' | 'iban' | 'swift'
  | 'bank_address' | 'wallet_number' | 'account_email' | 'city' | 'country';

/**
 * Where to send one payment, as `payment_instructions()` returns it: only the
 * fields the chosen method shows, and only to the person who owes it.
 */
export type PayTo = Database['public']['Functions']['payment_instructions']['Returns'][number];

/** The columns of `PaymentMethodPublic`, for `.select()` — never `'*'`. */
export const PUBLIC_METHOD_COLUMNS = 'key, name_ar, name_en, icon, category, is_enabled, sort_order, instructions_ar, requires_receipt, requires_reference, reference_label_ar, supports_automatic_payment, supports_payout, use_for, display_fields, international_fields';

export type PaymentMethod = {
  key: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  category: 'local' | 'international';
  is_enabled: boolean;
  sort_order: number;
  instructions_ar: string | null;
  use_for: string[];
  display_fields: PayField[];
  international_fields: PayField[];
  account_email: string | null;
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

export type BookingKind = 'student_mentor' | 'team_mentor' | 'company_mentor';

export type Booking = {
  id: string;
  booking_code: string;
  kind: BookingKind;
  student_id: string | null;
  team_id: string | null;
  /** The mentorship goal this session was booked against, when there is one. */
  mentorship_goal_id: string | null;
  startup_id: string | null;
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
  /** When the mentor must answer a paid request by (0077). */
  mentor_respond_by: string | null;
  /** Declined by the platform because the mentor did not answer in time. */
  auto_declined: boolean;
  /** Who was there, as the mentor (or, for a missing mentor, the learner) recorded it (0104). */
  attendance: BookingAttendance | null;
  attendance_by: string | null;
  attendance_at: string | null;
  /** Flagged to the mentor and the admins when nobody recorded it in 48 hours. */
  attendance_flagged_at: string | null;
  /** Booked inside the usual notice window, at the instant surcharge (0125). */
  is_instant: boolean;
  /** How many times the learner missed this session (0125): the first one gives a free new time. */
  learner_absences: number;
  /** After a first absence: the learner picks a new time before this, once (0125). */
  reschedule_by: string | null;
  /** The mentor said a session they were reported absent from was held (0125). */
  absence_disputed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BookingAttendance = 'held' | 'learner_absent' | 'mentor_absent';

export type Payment = {
  id: string;
  /** A payment belongs to a booking or to an escrow — never to both. */
  booking_id: string | null;
  escrow_id: string | null;
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
  /** A code a person can read out: TMPAY-XXXXXXXX. */
  payment_code: string;
  /** What was actually sent — the ledger stays in USD, nothing is converted. */
  paid_currency: 'USD' | 'ILS' | 'JOD';
  paid_amount: number | null;
  exchange_rate: number;
  /** The admin's question, and the payer's answer, when a receipt raised one. */
  info_request_ar: string | null;
  /** The account the payer paid from, as given with this payment (0097). */
  payer_account_id: string | null;
  payer_holder: string | null;
  payer_account: string | null;
  payer_note_ar: string | null;
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
  | 'mentor_session_attended' | 'mentor_session_booked' | 'team_contribution' | 'achievement_awarded';

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
  /** Finished or skipped the welcome guide (0129). */
  welcomed_at: string | null;
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
  author_id: string | null;
  review_state: StudioReviewState;
  review_note_ar: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Where a mentor's course or path stands in review (0115); 'none' is TechMood's own. */
export type StudioReviewState = 'none' | 'editing' | 'submitted' | 'changes_requested' | 'approved';

export type Course = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  status: ContentStatus;
  estimated_hours: number | null;
  level: CourseLevel;
  author_id: string | null;
  review_state: StudioReviewState;
  review_note_ar: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
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
  /** published: open · planned: «قريباً» (shown, not completable) · draft/archived: hidden (0078). */
  status: ContentStatus;
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

export type VideoSessionType =
  | 'student_mentor' | 'team_mentor' | 'company_mentor' | 'team_internal' | 'project_meeting';
export type VideoSessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'no_show';
export type SessionRole = 'mentor' | 'student' | 'member' | 'leader' | 'client' | 'contractor';
/** Which door is open, decided by the server's clock. */
export type SessionPhase = 'waiting' | 'lobby' | 'live' | 'ended';

export type CalendarEntryKind =
  | 'mentor_session' | 'team_session' | 'team_meeting' | 'project_meeting'
  | 'task' | 'milestone' | 'sprint';

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
  | 'cv' | 'linkedin' | 'github' | 'behance' | 'dribbble' | 'kaggle' | 'youtube'
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
  /** Only a published assignment takes submissions (0078). */
  status: ContentStatus;
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
  /** The mentor who wrote it, when the query embeds it (shown to the learner). */
  evaluator?: { full_name: string; display_name: string | null; techmood_id: string; avatar_url: string | null } | null;
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
    /** the English title printed on the certificate */
    title_en?: string | null;
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

/* --------------------------------------------------------------------------
 * TechMood AI — a layer over the platform, not a page beside it
 * ----------------------------------------------------------------------- */
export type AiSurface =
  | 'general' | 'lesson' | 'course' | 'assessment' | 'assignment' | 'project'
  | 'profile' | 'cv' | 'market' | 'opportunity' | 'mentor' | 'booking'
  | 'team' | 'startup' | 'canvas' | 'goal';

export type AiScope =
  | 'page' | 'course' | 'profile' | 'project' | 'team' | 'startup' | 'platform';

export type AiRole = 'user' | 'assistant' | 'system';

/** 👁️ read · ✏️ suggest · ✅ act · 🔒 restricted */
export type AiPermission = 'read' | 'suggest' | 'act' | 'restricted';

export type AiActionStatus =
  | 'proposed' | 'confirmed' | 'executed' | 'declined' | 'failed' | 'expired';

export type AiMemoryKind = 'goal' | 'preference' | 'skill' | 'context' | 'fact';

export type AiThread = {
  id: string; profile_id: string; title_ar: string;
  surface: AiSurface; scope: AiScope;
  entity_type: string | null; entity_id: string | null;
  is_archived: boolean; created_at: string; last_message_at: string;
};

export type AiMessage = {
  id: string; thread_id: string; role: AiRole; content: string;
  surface: AiSurface | null; scope: AiScope | null;
  model: string | null; error_ar: string | null; created_at: string;
};

export type AiMemoryRow = {
  id: string; profile_id: string; kind: AiMemoryKind; content_ar: string;
  from_assistant: boolean; is_active: boolean;
  source_thread: string | null; created_at: string; updated_at: string;
};

export type AiActionRow = {
  id: string; thread_id: string | null; profile_id: string; kind: string;
  summary_ar: string; params: Record<string, unknown>; status: AiActionStatus;
  result: Record<string, unknown> | null; error_ar: string | null;
  proposed_at: string; decided_at: string | null; executed_at: string | null;
};

export type AiActionKind = {
  kind: string; title_ar: string; detail_ar: string | null;
  permission: AiPermission; refusal_ar: string | null;
  is_enabled: boolean; sort_order: number;
};

/* --------------------------------------------------------------------------
 * Client and mentee — two roles, and the little that was missing behind them
 * ----------------------------------------------------------------------- */
export type OpportunityVisibility = 'public' | 'invite_only';

export type WorkerCriterion =
  | 'clarity' | 'communication' | 'professionalism' | 'payment' | 'scope';

export type MentorshipGoalStatus = 'active' | 'achieved' | 'dropped';

export type OpportunityAttachment = {
  id: string; opportunity_id: string; label: string; url: string;
  kind: EvidenceKind; added_by: string | null; created_at: string;
  /** true when `url` is a path in the brief-files bucket, not somebody's link. */
  is_upload: boolean;
};

export type WorkerReview = {
  id: string; project_id: string; escrow_id: string | null;
  worker_id: string; client_id: string; stars: number;
  comment_ar: string | null; created_at: string;
};

export type MentorshipGoal = {
  id: string; profile_id: string; title_ar: string; detail_ar: string | null;
  mentor_id: string | null; status: MentorshipGoalStatus;
  target_on: string | null; outcome_ar: string | null;
  created_at: string; closed_at: string | null;
};

/* --------------------------------------------------------------------------
 * Credential-based courses — somebody else's credential, TechMood's practice
 * ----------------------------------------------------------------------- */
export type CredentialStatus = 'submitted' | 'verified' | 'rejected';

export type CredentialProvider = {
  id: string; slug: string; name: string; website_url: string | null;
  verify_hint_ar: string | null; is_active: boolean; sort_order: number;
};

export type LessonCredential = {
  lesson_id: string; provider_id: string; credential_name: string | null;
  credential_url: string | null; requires_application: boolean;
  note_ar: string | null; created_at: string;
};

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      submission_prechecks: Table<{
        version_id: string; submission_id: string; status: 'pending' | 'done' | 'failed';
        result: unknown; model: string | null; created_at: string; finished_at: string | null;
      }>;
      lesson_quiz_attempts: Table<{
        id: string; profile_id: string; lesson_id: string; answers: number[]; correct: number; total: number;
        passed: boolean; created_at: string;
      }>;
      ai_preferences: Table<{
        profile_id: string; memory_enabled: boolean; actions_enabled: boolean; updated_at: string;
      }>;
      ai_threads: Table<AiThread>;
      ai_messages: Table<AiMessage>;
      ai_memory: Table<AiMemoryRow>;
      ai_actions: Table<AiActionRow>;
      ai_action_kinds: Table<AiActionKind>;
      ai_surface_permissions: Table<{
        surface: AiSurface; title_ar: string; permission: AiPermission;
        note_ar: string | null; sort_order: number;
      }>;
      ai_suggestions: Table<{
        id: string; surface: AiSurface; label_ar: string; prompt_ar: string;
        icon: string | null; sort_order: number; is_active: boolean;
      }>;
      opportunity_attachments: Table<OpportunityAttachment>;
      worker_reviews: Table<WorkerReview>;
      worker_review_scores: Table<{ review_id: string; criterion: WorkerCriterion; stars: number }>;
      mentorship_goals: Table<MentorshipGoal>;
      credential_providers: Table<CredentialProvider>;
      lesson_credentials: Table<LessonCredential>;
      project_splits: Table<{
        project_id: string; profile_id: string; percent: number; set_by: string | null; set_at: string;
      }>;
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
      support_tickets: Table<SupportTicket>;
      kb_articles: Table<{
        id: string; slug: string; category: TicketCategory | null; title_ar: string; title_en: string | null;
        body_ar: string; status: ContentStatus; sort_order: number; updated_by: string | null;
        created_at: string; updated_at: string;
      }>;
      cases: Table<{
        id: string; code: string; title_ar: string; status: CaseStatus; priority: TicketPriority;
        reporter_id: string | null; reported_profile_id: string | null; decision_ar: string | null;
        decided_by: string | null; decided_at: string | null; ai_summary_ar: string | null;
        ai_next_step_ar: string | null; created_by: string | null; created_at: string; updated_at: string;
      }>;
      case_links: Table<{
        case_id: string; entity_type: CaseLinkType; entity_id: string; note_ar: string | null;
        added_by: string | null; created_at: string;
      }>;
      case_notes: Table<{ id: string; case_id: string; author_id: string | null; body_ar: string; created_at: string }>;
      case_evidence: Table<{
        id: string; case_id: string; label_ar: string; path: string | null; url: string | null;
        added_by: string | null; created_at: string;
      }>;
      case_events: Table<{
        id: string; case_id: string; kind: string; actor_id: string | null; note_ar: string | null;
        data: Record<string, unknown>; created_at: string;
      }>;
      user_warnings: Table<{
        id: string; profile_id: string; case_id: string | null; reason_ar: string; issued_by: string | null; created_at: string;
      }>;
      user_restrictions: Table<{
        id: string; profile_id: string; feature: RestrictedFeature; reason_ar: string; case_id: string | null;
        starts_at: string; ends_at: string | null; created_by: string | null; lifted_at: string | null;
        lifted_by: string | null; created_at: string;
      }>;
      ticket_messages: Table<{
        id: string; ticket_id: string; author_kind: TicketAuthor; author_id: string | null;
        body_ar: string; attachment_path: string | null; is_internal: boolean; created_at: string;
      }>;
      ticket_events: Table<{
        id: string; ticket_id: string; kind: string; actor_id: string | null; note_ar: string | null;
        is_internal: boolean; created_at: string;
      }>;
      course_feedback: Table<{
        id: string; course_id: string; profile_id: string; stars: number; recommend: boolean | null;
        liked_ar: string | null; improve_ar: string | null; created_at: string;
      }>;
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
        project_id: string | null; topic_ar: string | null;
        session_type: VideoSessionType; start_at: string; end_at: string;
        status: VideoSessionStatus; ended_at: string | null; created_at: string;
      }>;
      booking_seats: Table<{ booking_id: string; profile_id: string }>;
      commission_tiers: Table<{
        kind: EscrowKind; min_amount_usd: number; rate_percent: number; note_ar: string | null;
      }>;
      escrows: Table<{
        id: string; escrow_code: string; kind: EscrowKind; project_id: string | null;
        payer_id: string; payee_id: string; amount_usd: number; commission_usd: number;
        net_usd: number; status: EscrowStatus; dispute_reason_ar: string | null;
        resolution_ar: string | null; created_at: string; funded_at: string | null;
        released_at: string | null;
      }>;
      proposal_terms: Table<{
        id: string; application_id: string; by_profile: string; amount_usd: number;
        days: number | null; message_ar: string | null; status: TermsStatus;
        created_at: string; answered_at: string | null;
      }>;
      client_reviews: Table<{
        id: string; project_id: string; escrow_id: string | null; client_id: string;
        worker_id: string; stars: number; comment_ar: string | null; created_at: string;
      }>;
      client_review_scores: Table<{ review_id: string; criterion: ClientCriterion; stars: number }>;
      credit_topups: Table<{
        id: string; topup_code: string; profile_id: string; amount_usd: number; method_key: string;
        reference: string | null; proof_path: string | null;
        status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'cancelled';
        rejection_reason: string | null; created_at: string; submitted_at: string | null;
        reviewed_by: string | null; reviewed_at: string | null;
      }>;
      listing_auctions: Table<{
        id: string; listing_id: string; start_usd: number; step_usd: number; ends_at: string;
        status: 'open' | 'won' | 'no_bids' | 'cancelled'; winning_usd: number | null; created_at: string; closed_at: string | null;
      }>;
      premium_memberships: Table<{ profile_id: string; until: string; since: string }>;
      business_inquiries: Table<{
        id: string; company: string; contact_name: string; email: string; phone: string | null; need: BusinessNeed;
        message: string; profile_id: string | null; status: 'new' | 'contacted' | 'closed'; created_at: string;
        handled_at: string | null; handled_by: string | null;
      }>;
      blog_posts: Table<{
        id: string; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null;
        category: BlogCategory; author_id: string | null; published_at: string | null; removed_at: string | null; created_at: string; updated_at: string;
      }>;
      project_listings: Table<{
        id: string; listing_code: string; project_id: string; seller_id: string;
        team_id: string | null; price_usd: number; licence: SaleLicence;
        summary_ar: string; includes: string[]; status: ListingStatus;
        created_at: string; sold_at: string | null;
        /** Public demo or preview (0099). The delivery link is not readable here. */
        demo_url: string | null; discount_pct: number; discount_ends_at: string | null;
        /** A returning buyer's extra discount, 0–50% (0149). */
        repeat_buyer_pct: number;
        verified_at: string | null; review_note_ar: string | null; reviewed_at: string | null;
        negotiable: boolean;
      }>;
      listing_offers: Table<{
        id: string; listing_id: string; buyer_id: string; seller_id: string;
        amount_usd: number; counter_usd: number | null; agreed_usd: number | null;
        message_ar: string | null; seller_note_ar: string | null; status: OfferStatus;
        expires_at: string; terms_version: string; created_at: string; decided_at: string | null;
      }>;
      project_reviews: Table<{
        sale_id: string; project_id: string; buyer_id: string; stars: number;
        comment_ar: string | null; created_at: string;
      }>;
      project_sales: Table<{
        id: string; listing_id: string; project_id: string; buyer_id: string;
        seller_id: string; escrow_id: string | null; amount_usd: number;
        licence: SaleLicence; created_at: string; completed_at: string | null;
      }>;
      freelancer_profiles: Table<{
        profile_id: string; is_available: boolean; headline_ar: string | null;
        summary_ar: string | null; rate_kind: 'hourly' | 'project';
        rate_min_usd: number | null; rate_max_usd: number | null;
        languages: string[]; updated_at: string;
      }>;
      freelancer_services: Table<{
        id: string; profile_id: string; title_ar: string; detail_ar: string | null;
        from_usd: number | null; sort_order: number;
      }>;
      market_saves: Table<{
        profile_id: string; target_kind: MarketSaveKind; target_id: string; created_at: string;
      }>;
      opportunity_invites: Table<{
        id: string; opportunity_id: string; invited_profile: string | null;
        invited_team: string | null; invited_by: string; message_ar: string | null;
        status: InviteStatus; created_at: string; responded_at: string | null;
      }>;
      video_session_participants: Table<{
        session_id: string; profile_id: string; role: SessionRole;
      }>;
      session_feedback: Table<{
        id: string; booking_id: string; from_profile: string; to_profile: string;
        stars: number; comment_ar: string | null; revealed_at: string | null; created_at: string;
      }>;
      session_feedback_scores: Table<{
        feedback_id: string; criterion: SessionCriterion; stars: number;
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
      level_upgrade_questions: Table<{
        key: string; question_ar: string; hint_ar: string | null; min_chars: number;
        sort_order: number; is_active: boolean; needs_link: boolean;
      }>;
      xp_rules: Table<{ source: XpSource; base_xp: number; per_star_xp: number; description_ar: string | null }>;
      schools: Table<{ id: string; slug: string; name_ar: string; name_en: string | null; sort_order: number }>;
      notifications: Table<{
        id: string; profile_id: string; kind: NotificationKind; title_ar: string;
        body_ar: string | null; link: string | null; is_read: boolean; created_at: string;
        entity_type: string | null; entity_id: string | null;
        priority: NotifyPriority; read_at: string | null;
        metadata: Record<string, unknown>; emailed_at: string | null;
      }>;
      notification_categories: Table<{
        kind: NotificationKind; title_ar: string; detail_ar: string | null;
        in_app_default: boolean; email_default: boolean; push_default: boolean; is_mandatory: boolean; sort_order: number;
        admin_only: boolean;
      }>;
      notification_preferences: Table<{
        profile_id: string; kind: NotificationKind; in_app: boolean; email: boolean; push: boolean; updated_at: string;
      }>;
      email_outbox: Table<{
        id: string; notification_id: string | null; profile_id: string; to_email: string;
        subject: string; body_ar: string; action_url: string | null; status: EmailStatus;
        attempts: number; last_error: string | null; queued_at: string; sent_at: string | null;
      }>;
      notification_broadcasts: Table<{
        id: string; kind: NotificationKind; title_ar: string; body_ar: string | null;
        link: string | null; priority: NotifyPriority; audience_role: UserRole | null;
        send_email: boolean; created_by: string | null; created_at: string;
        sent_at: string | null; recipients: number;
      }>;
      mentor_profiles: Table<{
        profile_id: string; level: MentorLevel; headline_ar: string | null; bio_ar: string | null;
        domains: string[]; session_minutes: number; is_accepting: boolean;
        daily_session_limit: number; buffer_minutes: number;
        sessions_count: number; rating_avg: number | null;
        years_experience: number | null; weekly_hours: number | null;
        motivation_ar: string | null; experience_ar: string | null;
        linkedin_url: string | null; portfolio_url: string | null;
        cv_url: string | null; certificate_urls: string[];
        languages: string[]; approved_at: string | null;
        pause_reason: MentorPauseReason | null; paused_until: string | null;
        pause_note_ar: string | null; paused_at: string | null; accepting_since: string;
      }>;
      projects: Table<{
        id: string; code: string; title_ar: string; description_ar: string | null;
        owner_id: string; team_id: string | null; path_id: string | null;
        status: ProjectStatus; kind: ProjectKind; tags: string[]; is_public: boolean;
        opportunity_id: string | null; client_id: string | null; agreed_amount_usd: number | null;
        startup_id: string | null;
        completed_at: string | null; created_at: string; updated_at: string;
        // the showcase page (0121)
        tagline_ar: string | null; category: string | null; product_type: ProductType | null;
        skills: string[]; links: ProjectLink[]; demo_url: string | null; video_url: string | null;
        images: string[]; in_gallery: boolean; gallery_at: string | null;
        gallery_hidden_at: string | null; gallery_hidden_note: string | null;
        course_id: string | null; assignment_id: string | null; submission_id: string | null;
      }>;
      exhibition_entries: Table<ExhibitionEntry>;
      opportunities: Table<Opportunity>;
      opportunity_applications: Table<OpportunityApplication>;
      startups: Table<Startup>;
      startup_members: Table<{
        startup_id: string; profile_id: string; role: StartupMemberRole;
        title_ar: string | null; joined_at: string;
      }>;
      canvases: Table<{
        id: string; startup_id: string; kind: CanvasKind; title_ar: string;
        summary_ar: string | null; visibility: CanvasVisibility;
        created_by: string | null; created_at: string; updated_at: string;
      }>;
      canvas_blocks: Table<{
        id: string; canvas_id: string; key: string; title_ar: string;
        hint_ar: string | null; sort_order: number;
      }>;
      canvas_templates: Table<{
        kind: CanvasKind; key: string; title_ar: string; hint_ar: string | null; sort_order: number;
      }>;
      canvas_versions: Table<{
        id: string; canvas_id: string; version: number; snapshot: unknown;
        note_ar: string | null; created_by: string | null; created_at: string;
      }>;
      canvas_card_links: Table<{
        card_id: string; target_kind: 'goal' | 'project' | 'opportunity';
        target_id: string; created_at: string;
      }>;
      incubation_stages: Table<{
        stage: StartupStage; sort_order: number; title_ar: string; purpose_ar: string;
      }>;
      incubation_requirements: Table<{
        key: string; stage: StartupStage; title_ar: string; detail_ar: string | null;
        check_kind: string; check_arg: string | null; is_required: boolean; sort_order: number;
      }>;
      startup_requirement_ticks: Table<{
        startup_id: string; requirement_key: string; note_ar: string | null;
        ticked_by: string | null; ticked_at: string;
      }>;
      startup_mentor_access: Table<{
        startup_id: string; mentor_id: string; note_ar: string | null;
        granted_by: string | null; granted_at: string; expires_on: string | null;
      }>;
      roadmap_items: Table<{
        id: string; startup_id: string; title_ar: string; detail_ar: string | null;
        year: number; quarter: number; status: RoadmapStatus;
        project_id: string | null; goal_id: string | null; sort_order: number;
        created_by: string | null; created_at: string;
      }>;
      startup_shares: Table<{
        id: string; token: string; startup_id: string; scope: ShareScope;
        canvas_id: string | null; label_ar: string | null; expires_on: string | null;
        revoked_at: string | null; created_by: string | null; created_at: string; views: number;
      }>;
      startup_documents: Table<{
        id: string; startup_id: string; kind: CompanyDocumentKind; title_ar: string;
        summary_ar: string | null; url: string | null; storage_path: string | null;
        version: number; uploaded_by: string | null; created_at: string;
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
        label: string | null; created_at: string; is_upload: boolean;
      }>;
      project_milestones: Table<{
        id: string; project_id: string; title_ar: string; description_ar: string | null;
        is_done: boolean; due_on: string | null; sort_order: number;
      }>;
      teams: Table<Team>;
      team_members: Table<TeamMember>;
      team_tasks: Table<TeamTask>;
      sprints: Table<Sprint>;
      messages: Table<Message>;
      conversations: Table<Conversation>;
      conversation_participants: Table<{
        conversation_id: string; profile_id: string; last_read_at: string | null; joined_at: string;
        /** Muted for this member until then (0126). */
        muted_until: string | null;
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
      payer_accounts: Table<{
        id: string; profile_id: string; method_key: string | null; holder_name: string;
        account_ref: string; label: string | null; is_default: boolean; created_at: string;
      }>;
      invoices: Table<{
        id: string; invoice_no: string; payment_id: string; profile_id: string | null;
        payer_name: string; payer_account: string | null; description_ar: string;
        amount_usd: number; paid_currency: string; paid_amount: number | null;
        method_label: string | null; reference: string | null; payment_code: string | null;
        status: 'issued' | 'refunded'; issued_at: string; refunded_at: string | null;
      }>;
      booking_events: Table<BookingEvent>;
      booking_review_items: Table<BookingReviewItem>;
      mentor_session_types: Table<{
        mentor_id: string; session_type_id: string; is_active: boolean;
        /** The mentor's own price for this session type; null = the level's default (0077). */
        price_usd: number | null;
      }>;
      mentor_availability: Table<{
        id: string; mentor_id: string; day_of_week: number; start_time: string; end_time: string;
      }>;
      mentor_time_off: Table<{
        id: string; mentor_id: string; starts_at: string; ends_at: string; reason: string | null;
      }>;
      mentor_availability_exceptions: Table<{
        id: string; mentor_id: string; on_date: string; is_open: boolean;
        start_time: string | null; end_time: string | null; reason_ar: string | null;
      }>;
      platform_settings: Table<{ key: string; value: string; description_ar: string | null }>;
      wallet_entries: Table<WalletEntry>;
      payout_accounts: Table<PayoutAccount>;
      payout_requests: Table<PayoutRequest>;
      mentor_levels: Table<{
        level: MentorLevel; session_price_usd: number; platform_share_usd: number;
        mentor_share_usd: number; min_sessions: number; min_rating: number; sort_order: number;
        min_session_usd: number; max_session_usd: number; commission_pct: number;
        title: string; badge: string; fits_ar: string | null; fits_en: string | null;
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
        conversation_id: string; profile_id: string; unread_count: number; last_message_at: string | null; is_muted: boolean;
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
      studio_create_course: {
        Args: { p_title_ar: string; p_title_en?: string | null; p_description_ar?: string | null; p_level?: CourseLevel };
        Returns: string;
      };
      studio_update_course: {
        Args: { p_course: string; p_title_ar: string; p_title_en: string | null; p_description_ar: string | null; p_level: CourseLevel; p_estimated_hours?: number | null };
        Returns: undefined;
      };
      studio_delete_course: { Args: { p_course: string }; Returns: undefined };
      studio_add_module: { Args: { p_course: string; p_title_ar: string }; Returns: string };
      studio_update_module: { Args: { p_module: string; p_title_ar: string }; Returns: undefined };
      studio_delete_module: { Args: { p_module: string }; Returns: undefined };
      studio_move_module: { Args: { p_module: string; p_direction: number }; Returns: undefined };
      studio_save_lesson: { Args: { p_module: string; p_lesson: string | null; p: Record<string, unknown> }; Returns: string };
      studio_delete_lesson: { Args: { p_lesson: string }; Returns: undefined };
      studio_move_lesson: { Args: { p_lesson: string; p_direction: number }; Returns: undefined };
      studio_create_path: {
        Args: { p_title_ar: string; p_title_en: string | null; p_school: string; p_tagline_ar?: string | null; p_description_ar?: string | null; p_tags?: string[] };
        Returns: string;
      };
      studio_update_path: {
        Args: { p_path: string; p_title_ar: string; p_title_en: string | null; p_school: string; p_tagline_ar: string | null; p_description_ar: string | null; p_tags: string[] };
        Returns: undefined;
      };
      studio_set_path_courses: { Args: { p_path: string; p_courses: string[]; p_optional?: string[] }; Returns: undefined };
      studio_delete_path: { Args: { p_path: string }; Returns: undefined };
      studio_submit: { Args: { p_kind: string; p_id: string }; Returns: undefined };
      studio_withdraw: { Args: { p_kind: string; p_id: string }; Returns: undefined };
      review_studio_item: { Args: { p_kind: string; p_id: string; p_approve: boolean; p_note?: string | null }; Returns: undefined };
      team_session_allowance: {
        Args: { p_team: string };
        Returns: { week_start: string; used: number; remaining: number; sessions: unknown }[];
      };
      cancel_internal_session: {
        Args: { p_session: string };
        Returns: undefined;
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
      booking_requires_evaluation: { Args: { p_booking: string }; Returns: boolean };
      my_owed_evaluations: {
        Args: Record<string, never>;
        Returns: {
          booking_id: string; booking_code: string; student_name: string;
          ended_at: string; due_at: string; items: number; held_usd: number;
        }[];
      };
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
      student_league: {
        Args: { p_metric?: string; p_window?: string; p_path?: string | null; p_limit?: number };
        Returns: {
          rank: number; profile_id: string; techmood_id: string; name: string; avatar_url: string | null;
          score: number; points: number; stars: number | null; rated: number; streak: number; is_me: boolean;
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
      set_meeting_link: { Args: { p_booking: string; p_url: string }; Returns: undefined };
      toggle_follow: { Args: { p_profile: string }; Returns: boolean };
      follow_stats: {
        Args: { p_profile: string };
        Returns: { followers: number; following: number; i_follow: boolean }[];
      };
      my_following: {
        Args: Record<string, never>;
        Returns: { profile_id: string; full_name: string; techmood_id: string; avatar_url: string | null; since: string }[];
      };
      toggle_project_like: { Args: { p_project: string }; Returns: boolean };
      project_like_stats: {
        Args: { p_projects: string[] };
        Returns: { project_id: string; likes: number; i_like: boolean }[];
      };
      booking_meeting: {
        Args: { p_booking: string };
        Returns: { has_link: boolean; url: string | null; opens_at: string; closes_at: string; can_join: boolean }[];
      };
      mentor_decline_booking: { Args: { p_booking: string; p_reason: string }; Returns: undefined };
      record_attendance: { Args: { p_booking: string; p_outcome: BookingAttendance }; Returns: undefined };
      reschedule_after_absence: { Args: { p_booking: string; p_starts_at: string }; Returns: undefined };
      set_conversation_muted: { Args: { p_conversation: string; p_hours: number | null }; Returns: string | null };
      my_unread_messages: { Args: Record<string, never>; Returns: number };
      lesson_quiz: { Args: { p_lesson: string }; Returns: unknown };
      submit_lesson_quiz: { Args: { p_lesson: string; p_answers: number[] }; Returns: unknown };
      answer_lesson_quiz_question: { Args: { p_lesson: string; p_index: number; p_choice: number }; Returns: unknown };
      lesson_quiz_progress: { Args: { p_lesson: string }; Returns: unknown };
      claim_quiz_generation: { Args: { p_lesson: string }; Returns: boolean };
      claim_submission_precheck: { Args: { p_submission: string }; Returns: string };
      conversation_previews: { Args: { p_ids: string[] }; Returns: { conversation_id: string; body_ar: string; created_at: string }[] };
      mark_welcomed: { Args: Record<string, never>; Returns: undefined };
      ai_gemini_ready: { Args: Record<string, never>; Returns: boolean };
      claim_ai_model_call: { Args: { p_thread?: string | null }; Returns: boolean };
      my_activity: { Args: { p_days?: number }; Returns: { on_date: string; xp: number; lessons: number; acts: number }[] };
      my_challenges: {
        Args: Record<string, never>;
        Returns: { key: string; title_ar: string; title_en: string; icon: string; goal: number; progress: number; week_ends: string; days_left: number }[];
      };
      my_achievement_progress: { Args: Record<string, never>; Returns: { slug: string; current: number; goal: number }[] };
      my_achievements: {
        Args: Record<string, never>;
        Returns: {
          slug: string; name_ar: string; name_en: string | null; description_ar: string | null; description_en: string | null;
          icon: string | null; awarded_at: string | null; times: number | null;
        }[];
      };
      following_feed: {
        Args: { p_limit?: number };
        Returns: {
          kind: string; happened_at: string; techmood_id: string; name: string; avatar_url: string | null;
          title: string | null; detail: string | null; link: string | null;
        }[];
      };
      following_week: {
        Args: Record<string, never>;
        Returns: { rank: number; techmood_id: string; name: string; avatar_url: string | null; xp: number; streak: number; is_me: boolean }[];
      };
      suggested_people: {
        Args: { p_limit?: number };
        Returns: { techmood_id: string; name: string; avatar_url: string | null; headline: string | null; xp: number; followers: number }[];
      };
      showcase_evaluator: {
        Args: { p_project: string };
        Returns: { full_name: string; techmood_id: string; avatar_url: string | null; reviewed_at: string | null }[];
      };
      admin_attendance_disputes: {
        Args: Record<string, never>;
        Returns: {
          booking_id: string; booking_code: string; student_name: string | null; mentor_name: string;
          scheduled_start: string; price_usd: number; reported_at: string;
        }[];
      };
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
          p_domains: string[];
          p_years: number;
          p_bio?: string | null;
          p_weekly_hours?: number | null;
          p_motivation?: string | null;
          p_experience?: string | null;
          p_linkedin_url?: string | null;
          p_portfolio_url?: string | null;
          p_languages?: string[];
          p_cv_url?: string | null;
          p_certificate_urls?: string[];
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
      compute_commission: { Args: { p_kind: EscrowKind; p_amount: number }; Returns: number };
      open_escrow: {
        Args: {
          p_kind: EscrowKind; p_project: string | null; p_payee: string;
          p_amount: number; p_method_key: string;
        };
        Returns: Database['public']['Tables']['escrows']['Row'];
      };
      submit_escrow_proof: {
        Args: { p_escrow: string; p_proof_path?: string | null; p_reference?: string | null };
        Returns: undefined;
      };
      release_escrow: { Args: { p_escrow: string; p_note?: string | null }; Returns: undefined };
      refund_escrow: { Args: { p_escrow: string; p_reason: string }; Returns: undefined };
      dispute_escrow: { Args: { p_escrow: string; p_reason: string }; Returns: undefined };
      my_escrows: {
        Args: Record<string, never>;
        Returns: {
          id: string; escrow_code: string; kind: EscrowKind; project_id: string | null;
          project_title: string | null; counterpart: string | null; side: 'paying' | 'earning';
          amount_usd: number; commission_usd: number; net_usd: number;
          status: EscrowStatus; created_at: string;
        }[];
      };
      propose_terms: {
        Args: { p_application: string; p_amount: number; p_days?: number | null; p_message?: string | null };
        Returns: Database['public']['Tables']['proposal_terms']['Row'];
      };
      accept_terms: { Args: { p_terms: string }; Returns: undefined };
      negotiation: {
        Args: { p_application: string };
        Returns: {
          id: string; by_profile: string; by_name: string; amount_usd: number;
          days: number | null; message_ar: string | null; status: TermsStatus; created_at: string;
        }[];
      };
      review_client_work: {
        Args: { p_project: string; p_scores: Partial<Record<ClientCriterion, number>>; p_comment?: string | null };
        Returns: string;
      };
      client_reviews_for: {
        Args: { p_profile: string };
        Returns: {
          id: string; project_title: string | null; client_name: string | null;
          stars: number; comment_ar: string | null;
          criteria: Partial<Record<ClientCriterion, number>>; created_at: string;
        }[];
      };
      list_project_for_sale: {
        Args: {
          p_project: string; p_price: number; p_summary: string; p_delivery_url: string;
          p_licence?: SaleLicence; p_includes?: string[]; p_demo_url?: string | null;
          p_discount_pct?: number; p_discount_ends_at?: string | null;
          p_negotiable?: boolean; p_accept_terms?: boolean;
        };
        Returns: Database['public']['Tables']['project_listings']['Row'];
      };
      withdraw_listing: { Args: { p_listing: string }; Returns: undefined };
      buy_project: {
        Args: { p_listing: string; p_method_key: string; p_offer?: string | null; p_accept_terms?: boolean };
        Returns: Database['public']['Tables']['project_sales']['Row'];
      };
      market_listings: {
        Args: { p_search?: string | null; p_limit?: number };
        Returns: {
          id: string; listing_code: string; project_id: string; project_title: string | null;
          seller_id: string; seller_name: string | null; team_title: string | null;
          price_usd: number; effective_price: number; discount_pct: number; discount_ends_at: string | null;
          licence: SaleLicence; summary_ar: string; includes: string[];
          status: ListingStatus; entry_code: string | null; technologies: string[];
          demo_url: string | null; verified: boolean; sales_count: number; seller_rating: number | null;
        }[];
      };
      my_purchases: {
        Args: Record<string, never>;
        Returns: {
          sale_id: string; listing_code: string; project_id: string; project_code: string;
          project_title: string; seller_name: string;
          amount_usd: number; licence: SaleLicence; escrow_id: string | null;
          escrow_status: EscrowStatus | null; delivery_url: string | null;
          completed: boolean; my_stars: number | null; bought_at: string;
        }[];
      };
      // the project showcase (0121)
      gallery_projects: {
        Args: {
          p_mode?: 'all' | 'gallery' | 'market'; p_search?: string | null; p_category?: string | null;
          p_type?: ProductType | null; p_sort?: 'new' | 'popular' | 'price_low' | 'price_high';
          p_limit?: number; p_offset?: number; p_owner?: string | null;
          p_group?: 'projects' | 'services' | null;
        };
        Returns: ShowcaseCard[];
      };
      showcase_comments: {
        Args: { p_project: string };
        Returns: {
          id: string; parent_id: string | null; body_ar: string; created_at: string;
          author_id: string; author_name: string | null; author_avatar: string | null; author_techmood_id: string | null;
          is_owner: boolean; can_delete: boolean;
        }[];
      };
      showcase_people: {
        Args: { p_project: string };
        Returns: { profile_id: string; full_name: string | null; techmood_id: string | null; avatar_url: string | null; is_leader: boolean; role_ar: string | null }[];
      };
      add_project_comment: { Args: { p_project: string; p_body: string; p_parent?: string | null }; Returns: string };
      delete_project_comment: { Args: { p_comment: string }; Returns: undefined };
      showcase_project: { Args: { p_code: string }; Returns: ShowcasePage[] };
      can_edit_showcase: { Args: { p_project: string }; Returns: boolean };
      // lessons open in order (0124)
      lesson_unlocked: { Args: { p_lesson: string; p_profile?: string | null }; Returns: boolean };
      course_lesson_locks: { Args: { p_course: string }; Returns: { lesson_id: string; unlocked: boolean; previous_id: string | null }[] };
      showcase_reviews: {
        Args: { p_project: string };
        Returns: { stars: number; comment_ar: string | null; buyer_name: string | null; created_at: string }[];
      };
      my_project_stats: {
        Args: { p_project: string };
        Returns: {
          likes: number; views: number; link_clicks: number; sales_count: number;
          revenue_usd: number; rating: number | null; reviews_count: number; open_offers: number;
        }[];
      };
      record_project_hit: { Args: { p_project: string; p_kind?: string; p_visitor?: string | null }; Returns: undefined };
      market_terms_version: { Args: Record<string, never>; Returns: string };
      make_offer: { Args: { p_listing: string; p_amount: number; p_message?: string | null; p_accept_terms?: boolean }; Returns: string };
      respond_to_offer: {
        Args: { p_offer: string; p_action: 'accept' | 'reject' | 'counter'; p_counter?: number | null; p_note?: string | null };
        Returns: undefined;
      };
      answer_offer: { Args: { p_offer: string; p_action: 'accept' | 'reject' | 'withdraw' }; Returns: undefined };
      my_listing_offers: {
        Args: Record<string, never>;
        Returns: {
          id: string; role: 'buyer' | 'seller'; listing_id: string; project_id: string; project_code: string;
          project_title: string; other_name: string | null; list_price: number; amount_usd: number;
          counter_usd: number | null; agreed_usd: number | null; message_ar: string | null;
          seller_note_ar: string | null; status: OfferStatus; expires_at: string; created_at: string;
        }[];
      };
      rate_purchase: { Args: { p_sale: string; p_stars: number; p_comment?: string | null }; Returns: undefined };
      admin_set_project_hidden: { Args: { p_project: string; p_hidden: boolean; p_note?: string | null }; Returns: undefined };
      delete_showcase_project: { Args: { p_project: string }; Returns: undefined };
      admin_pending_listings: {
        Args: Record<string, never>;
        Returns: {
          id: string; listing_code: string; project_id: string; project_title: string;
          seller_id: string; seller_name: string; price_usd: number; licence: SaleLicence;
          summary_ar: string; includes: string[]; demo_url: string | null; delivery_url: string | null;
          seller_warnings: number; created_at: string;
        }[];
      };
      review_listing: { Args: { p_listing: string; p_approve: boolean; p_note?: string | null }; Returns: undefined };
      set_listing_discount: { Args: { p_listing: string; p_pct: number; p_ends_at?: string | null }; Returns: undefined };
      // business, blog and workshops (0150)
      submit_business_inquiry: {
        Args: { p_company: string; p_contact_name: string; p_email: string; p_phone: string | null; p_need: BusinessNeed; p_message: string };
        Returns: string;
      };
      set_business_inquiry_status: { Args: { p_id: string; p_status: 'new' | 'contacted' | 'closed' }; Returns: undefined };
      save_blog_post: {
        Args: { p_id: string | null; p_slug: string; p_title: string; p_excerpt: string | null; p_body: string;
                p_cover_url: string | null; p_category: BlogCategory; p_publish: boolean };
        Returns: string;
      };
      remove_blog_post: { Args: { p_id: string }; Returns: undefined };
      can_host_workshop: { Args: Record<string, never>; Returns: boolean };
      save_workshop: {
        Args: { p_id: string | null; p_title: string; p_description: string; p_starts_at: string; p_duration: number;
                p_capacity: number | null; p_live_url: string | null; p_recording_url: string | null };
        Returns: string;
      };
      cancel_workshop: { Args: { p_id: string }; Returns: undefined };
      register_workshop: { Args: { p_id: string; p_register?: boolean }; Returns: undefined };
      workshop_list: { Args: { p_past?: boolean }; Returns: WorkshopRow[] };
      workshop_detail: { Args: { p_id: string }; Returns: (WorkshopRow & { can_edit: boolean; live_url: string | null; recording_url: string | null })[] };
      // offers in the market (0149): a returning buyer's discount, and this buyer's own price
      set_repeat_buyer_discount: { Args: { p_listing: string; p_pct: number }; Returns: undefined };
      my_listing_price: {
        Args: { p_listing: string };
        Returns: { price: number; list_price: number; returning_buyer: boolean; repeat_buyer_pct: number; discount_ends_at: string | null }[];
      };
      listing_delivery_url: { Args: { p_listing: string }; Returns: string | null };
      can_manage_startup: { Args: { p_startup: string }; Returns: boolean };
      my_notifications: {
        Args: { p_kind?: NotificationKind | null; p_unread?: boolean; p_limit?: number };
        Returns: {
          id: string; kind: NotificationKind; title_ar: string; body_ar: string | null;
          link: string | null; entity_type: string | null; entity_id: string | null;
          priority: NotifyPriority; is_read: boolean; created_at: string;
        }[];
      };
      notification_counts: {
        Args: Record<string, never>;
        Returns: { kind: NotificationKind; unread: number; total: number }[];
      };
      wants_notification: {
        Args: { p_profile: string; p_kind: NotificationKind; p_channel: 'in_app' | 'email' };
        Returns: boolean;
      };
      send_broadcast: { Args: { p_broadcast: string }; Returns: number };
      broadcast_log: {
        Args: Record<string, never>;
        Returns: {
          id: string; title_ar: string; kind: NotificationKind; priority: NotifyPriority;
          audience_role: UserRole | null; sent_at: string | null; recipients: number;
          read_count: number; emails: number; emails_sent: number; emails_failed: number;
        }[];
      };
      is_startup_mentor: { Args: { p_startup: string }; Returns: boolean };
      my_mentored_companies: {
        Args: Record<string, never>;
        Returns: {
          startup_id: string; name_ar: string; one_liner_ar: string | null;
          stage: StartupStage; granted_at: string; expires_on: string | null; canvases: number;
        }[];
      };
      create_company_booking_request: {
        Args: {
          p_startup: string; p_mentor: string; p_session_type: string; p_starts_at: string;
          p_method_key: string; p_members?: string[] | null; p_goal?: string | null;
          p_grant_mentor?: boolean;
        };
        Returns: Booking;
      };
      roadmap: {
        Args: { p_startup: string };
        Returns: {
          source: 'item' | 'goal' | 'project'; item_id: string; title_ar: string;
          detail_ar: string | null; year: number; quarter: number;
          state: string; link: string | null;
        }[];
      };
      roadmap_item_to_project: { Args: { p_item: string }; Returns: string };
      shared_view: {
        Args: { p_token: string };
        Returns: {
          scope: ShareScope; company_name: string; one_liner: string | null;
          label_ar: string | null; canvas_id: string | null; canvas_title: string | null;
          payload: Record<string, unknown>;
        }[];
      };
      record_share_view: { Args: { p_token: string }; Returns: undefined };
      revoke_share: { Args: { p_share: string }; Returns: undefined };
      stage_progress: {
        Args: { p_startup: string; p_stage?: StartupStage | null };
        Returns: {
          requirement_key: string; stage: StartupStage; title_ar: string;
          detail_ar: string | null; is_required: boolean; met: boolean;
        }[];
      };
      advance_startup_stage: { Args: { p_startup: string; p_note?: string | null }; Returns: StartupStage };
      startup_overview: {
        Args: { p_startup: string };
        Returns: {
          members: number; projects: number; projects_done: number;
          goals: number; goals_achieved: number; mentors: number;
          open_positions: number; documents: number; plan_percent: number;
          canvas_cards: number; stage: StartupStage; stage_order: number;
          stage_total: number; stage_met: number; stage_required: number;
        }[];
      };
      create_canvas: {
        Args: { p_startup: string; p_kind: CanvasKind; p_title?: string | null; p_blocks?: string[] | null };
        Returns: Database['public']['Tables']['canvases']['Row'];
      };
      move_canvas_card: { Args: { p_card: string; p_block: string; p_index?: number | null }; Returns: undefined };
      snapshot_canvas: { Args: { p_canvas: string; p_note?: string | null }; Returns: number };
      restore_canvas_version: { Args: { p_version: string }; Returns: undefined };
      card_to_goal: {
        Args: { p_card: string; p_metric: string; p_target: number; p_due: string; p_title?: string | null };
        Returns: string;
      };
      card_to_project: { Args: { p_card: string; p_title?: string | null }; Returns: string };
      swot_to_goal: {
        Args: { p_item: string; p_metric: string; p_target: number; p_due: string; p_title?: string | null };
        Returns: string;
      };
      canvas_board: {
        Args: { p_canvas: string };
        Returns: {
          block_key: string; block_title: string; block_hint: string | null; block_sort: number;
          card_id: string | null; body_ar: string | null; colour: CardColour | null;
          note_ar: string | null; tags: string[] | null; sort_order: number | null;
          linked: { kind: string; id: string }[];
        }[];
      };
      market_overview: {
        Args: Record<string, never>;
        Returns: { jobs: number; freelancers: number; teams: number; companies: number }[];
      };
      market_talent: {
        Args: { p_search?: string | null; p_skill?: string | null; p_limit?: number };
        Returns: {
          profile_id: string; techmood_id: string; full_name: string; headline: string | null;
          avatar_url: string | null; rate_kind: 'hourly' | 'project';
          rate_min_usd: number | null; rate_max_usd: number | null;
          stars_avg: number; total_xp: number; skills: string[];
          projects: number; certificates: number;
        }[];
      };
      market_teams: {
        Args: { p_search?: string | null; p_limit?: number };
        Returns: {
          team_id: string; title_ar: string; summary_ar: string | null;
          rate_from_usd: number | null; members: number; stars_avg: number;
          projects: number; needs: string[];
        }[];
      };
      trust_signals: {
        Args: { p_profile: string };
        Returns: { signal: TrustSignal; label_ar: string; count: number }[];
      };
      opportunity_learning: {
        Args: { p_opportunity: string };
        Returns: { path_id: string; slug: string; title_ar: string; teaches: string[] }[];
      };
      my_market: {
        Args: Record<string, never>;
        Returns: {
          bucket: MarketBucket; item_id: string; title_ar: string | null;
          detail_ar: string | null; state: string; link: string; at: string;
        }[];
      };
      invite_to_opportunity: {
        Args: { p_opportunity: string; p_profile?: string | null; p_team?: string | null; p_message?: string | null };
        Returns: string;
      };
      respond_to_invite: { Args: { p_invite: string; p_accept: boolean }; Returns: undefined };
      toggle_market_save: { Args: { p_kind: MarketSaveKind; p_target: string }; Returns: boolean };
      create_team_booking_request: {
        Args: {
          p_team: string; p_mentor: string; p_session_type: string; p_starts_at: string;
          p_method_key: string; p_members?: string[] | null; p_goal?: string | null;
        };
        Returns: Booking;
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
      can_post_opportunity: {
        Args: { p_kind: OpportunityKind; p_team?: string | null; p_startup?: string | null };
        Returns: boolean;
      };
      opportunity_match: {
        Args: { p_opportunity: string; p_profile: string };
        Returns: {
          meets_stars: boolean; meets_path: boolean; matched_skills: string[];
          missing_skills: string[]; profile_stars: number; profile_xp: number;
        }[];
      };
      apply_to_opportunity: {
        Args: {
          p_opportunity: string; p_cover?: string | null;
          p_amount?: number | null; p_days?: number | null; p_sections?: string[];
        }; Returns: OpportunityApplication };
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
      /** Joins a path (0118); refuses a hidden or switched-off one. Returns the enrolment id. */
      enrol_in_path: { Args: { p_path: string }; Returns: string };
      ai_settings: {
        Args: Record<string, never>;
        Returns: { memory_enabled: boolean; actions_enabled: boolean }[];
      };
      set_ai_preferences: {
        Args: { p_memory?: boolean | null; p_actions?: boolean | null };
        Returns: undefined;
      };
      ai_memory_json: { Args: Record<string, never>; Returns: unknown };
      ai_remember: {
        Args: {
          p_content: string; p_kind?: AiMemoryKind;
          p_thread?: string | null; p_from_assistant?: boolean;
        };
        Returns: string;
      };
      my_ai_memory: {
        Args: Record<string, never>;
        Returns: {
          id: string; kind: AiMemoryKind; content_ar: string;
          from_assistant: boolean; is_active: boolean; created_at: string;
        }[];
      };
      start_ai_thread: {
        Args: {
          p_title: string; p_surface?: AiSurface; p_scope?: AiScope;
          p_entity_type?: string | null; p_entity_id?: string | null;
        };
        Returns: string;
      };
      my_ai_threads: {
        Args: { p_include_archived?: boolean };
        Returns: {
          id: string; title_ar: string; surface: AiSurface; scope: AiScope;
          entity_type: string | null; entity_id: string | null;
          is_archived: boolean; messages: number; last_message_at: string;
        }[];
      };
      ai_say: {
        Args: {
          p_thread: string; p_role: AiRole; p_content: string;
          p_surface?: AiSurface | null; p_scope?: AiScope | null;
          p_model?: string | null; p_error?: string | null;
        };
        Returns: string;
      };
      ai_context: {
        Args: {
          p_surface?: AiSurface; p_scope?: AiScope;
          p_entity_type?: string | null; p_entity_id?: string | null;
        };
        Returns: unknown;
      };
      propose_ai_action: {
        Args: {
          p_thread: string | null; p_kind: string; p_summary: string;
          p_params?: Record<string, unknown>;
        };
        Returns: string;
      };
      confirm_ai_action: { Args: { p_action: string }; Returns: unknown };
      decline_ai_action: { Args: { p_action: string }; Returns: undefined };
      ai_thread_messages: {
        Args: { p_thread: string };
        Returns: {
          id: string; role: AiRole; content: string;
          error_ar: string | null; created_at: string;
        }[];
      };
      ai_thread_actions: {
        Args: { p_thread?: string | null };
        Returns: {
          id: string; kind: string; title_ar: string; summary_ar: string;
          params: Record<string, unknown>; status: AiActionStatus;
          error_ar: string | null; proposed_at: string;
        }[];
      };
      ai_suggestions_for: {
        Args: { p_surface: AiSurface };
        Returns: { label_ar: string; prompt_ar: string; icon: string | null }[];
      };
      ai_restrictions: {
        Args: Record<string, never>;
        Returns: {
          kind: string; title_ar: string;
          detail_ar: string | null; refusal_ar: string | null;
        }[];
      };
      compare_candidates: {
        Args: { p_opportunity: string };
        Returns: {
          application_id: string; profile_id: string; full_name: string;
          techmood_id: string; invited_team: string | null; team_title: string | null;
          stage: ApplicationStage; proposed_amount: number | null; proposed_days: number | null;
          stars: number | null; rated_count: number; projects_done: number;
          work_approved: number; xp: number;
          matched_skills: string[]; missing_skills: string[];
          meets_stars: boolean | null; meets_path: boolean | null; applied_at: string;
        }[];
      };
      review_client: {
        Args: { p_project: string; p_scores: Record<string, number>; p_comment?: string | null };
        Returns: string;
      };
      client_overview: {
        Args: Record<string, never>;
        Returns: {
          open_briefs: number; proposals: number; new_proposals: number;
          active_projects: number; completed: number; hires: number;
          in_escrow_usd: number; released_usd: number; awaiting_review: number;
        }[];
      };
      client_profile: {
        Args: { p_profile: string };
        Returns: {
          briefs_posted: number; projects_done: number; hires: number;
          stars: number | null; reviews: number; paid_on_time: number | null;
        }[];
      };
      close_mentorship_goal: {
        Args: { p_goal: string; p_status: MentorshipGoalStatus; p_outcome?: string | null };
        Returns: undefined;
      };
      link_session_to_goal: { Args: { p_booking: string; p_goal: string | null }; Returns: undefined };
      mentee_overview: {
        Args: Record<string, never>;
        Returns: {
          sessions_attended: number; mentors: number; hours: number; upcoming: number;
          goals_active: number; goals_achieved: number;
          rating_received: number | null; awaiting_rating: number;
        }[];
      };
      my_mentorship: {
        Args: Record<string, never>;
        Returns: {
          goal_id: string; title_ar: string; detail_ar: string | null;
          status: MentorshipGoalStatus; target_on: string | null; outcome_ar: string | null;
          mentor_id: string | null; mentor_name: string | null;
          sessions: number; last_session: string | null;
        }[];
      };
      is_project_party: { Args: { p_project: string }; Returns: boolean };
      schedule_project_meeting: {
        Args: { p_project: string; p_start: string; p_end: string; p_topic?: string | null };
        Returns: {
          id: string; session_code: string; project_id: string | null;
          topic_ar: string | null; start_at: string; end_at: string;
          status: VideoSessionStatus;
        };
      };
      cancel_project_meeting: {
        Args: { p_session: string; p_reason?: string | null };
        Returns: undefined;
      };
      project_meetings: {
        Args: { p_project: string };
        Returns: {
          id: string; session_code: string; topic_ar: string | null;
          start_at: string; end_at: string; status: VideoSessionStatus; attended: number;
        }[];
      };
      credential_lesson_state: {
        Args: { p_lesson: string };
        Returns: {
          is_credential: boolean; provider_name: string; credential_name: string | null;
          credential_url: string | null; requires_application: boolean;
          applied: boolean; submitted: boolean; credential_status: CredentialStatus | null;
          review_note: string | null; verified: boolean; completed: boolean;
        }[];
      };
      submit_credential: {
        Args: { p_lesson: string; p_url: string; p_code?: string | null; p_issued?: string | null };
        Returns: string;
      };
      review_credential: {
        Args: { p_submission: string; p_accept: boolean; p_note?: string | null };
        Returns: undefined;
      };
      credential_review_queue: {
        Args: Record<string, never>;
        Returns: {
          id: string; learner_name: string; techmood_id: string; provider_name: string;
          credential_name: string; evidence_url: string; credential_code: string | null;
          issued_on: string | null; lesson_title: string; course_title: string;
          application_done: boolean; submitted_at: string;
        }[];
      };
      course_credential_progress: {
        Args: { p_course: string };
        Returns: {
          credential_lessons: number; applied: number; submitted: number;
          verified: number; completed: number;
        }[];
      };
      profile_credentials: {
        Args: { p_profile: string };
        Returns: {
          provider_slug: string; provider_name: string; credential_name: string;
          evidence_url: string; issued_on: string | null; verified_at: string | null;
          course_title: string;
        }[];
      };
      profile_skill_evidence: {
        Args: { p_profile: string };
        Returns: {
          skill_slug: string; skill_name: string; source_kind: 'credential' | 'application';
          source_label: string; provider: string | null; stars: number | null;
          link: string | null; at: string | null;
        }[];
      };
      // رصيد TechMood (0151), packages (0152), auctions (0153), Premium (0154)
      my_credit_balance: { Args: Record<string, never>; Returns: number };
      my_credit_history: {
        Args: { p_limit?: number };
        Returns: { id: string; amount_usd: number; kind: 'topup' | 'spend' | 'refund' | 'adjust'; description_ar: string; created_at: string }[];
      };
      request_topup: { Args: { p_amount: number; p_method: string }; Returns: string };
      topup_instructions: { Args: { p_topup: string }; Returns: Database['public']['Functions']['payment_instructions']['Returns'] };
      submit_topup_proof: { Args: { p_topup: string; p_proof_path: string | null; p_reference: string | null }; Returns: undefined };
      cancel_topup: { Args: { p_topup: string }; Returns: undefined };
      review_topup: { Args: { p_topup: string; p_approve: boolean; p_reason?: string | null }; Returns: undefined };
      pay_with_credit: { Args: { p_payment: string }; Returns: undefined };
      package_quote: {
        Args: { p_mentor: string; p_session_type: string };
        Returns: { sessions: number; discount_pct: number; unit_usd: number; total_usd: number; saves_usd: number }[];
      };
      buy_session_package: { Args: { p_mentor: string; p_session_type: string; p_sessions: number }; Returns: string };
      my_session_packages: {
        Args: Record<string, never>;
        Returns: { id: string; package_code: string; mentor_id: string; mentor_name: string | null; session_type_id: string;
                   session_name: string; sessions_total: number; sessions_left: number; discount_pct: number;
                   paid_usd: number; created_at: string }[];
      };
      pay_with_package: { Args: { p_payment: string; p_package: string }; Returns: undefined };
      start_auction: { Args: { p_listing: string; p_start: number; p_step: number; p_hours: number }; Returns: string };
      cancel_auction: { Args: { p_auction: string }; Returns: undefined };
      place_bid: { Args: { p_auction: string; p_amount: number }; Returns: undefined };
      auction_state: {
        Args: { p_listing: string };
        Returns: { id: string; start_usd: number; step_usd: number; ends_at: string; status: 'open' | 'won' | 'no_bids' | 'cancelled';
                   top_usd: number | null; bids: number; next_min_usd: number; i_lead: boolean; i_won: boolean;
                   is_seller: boolean; winning_usd: number | null; my_offer_id: string | null }[];
      };
      auction_bids_public: {
        Args: { p_auction: string };
        Returns: { amount_usd: number; bidder: string; created_at: string; is_me: boolean }[];
      };
      is_premium: { Args: { p_profile: string }; Returns: boolean };
      premium_offer: {
        Args: Record<string, never>;
        Returns: { monthly_usd: number; yearly_usd: number; my_until: string | null; ai_daily: number; ai_daily_premium: number }[];
      };
      subscribe_premium: { Args: { p_plan: 'month' | 'year' }; Returns: string };
      payment_instructions: {
        Args: { p_payment: string };
        Returns: {
          method_key: string; name_ar: string; name_en: string; icon: string | null;
          instructions_ar: string | null; recipient_name: string | null;
          account_number: string | null; wallet_number: string | null; iban: string | null;
          swift: string | null; bank_name: string | null; bank_address: string | null;
          city: string | null; country: string | null; account_email: string | null;
          display_fields: PayField[]; international_fields: PayField[];
          requires_receipt: boolean; requires_reference: boolean;
          reference_label_ar: string | null; amount_usd: number; payment_code: string;
        }[];
      };
      payment_options: {
        Args: { p_payment: string };
        Returns: {
          key: string; name_ar: string; name_en: string; icon: string | null;
          category: string; is_current: boolean;
        }[];
      };
      choose_payment_method: { Args: { p_payment: string; p_method: string }; Returns: undefined };
      admin_payment_accounts: { Args: Record<string, never>; Returns: PaymentMethod[] };
      save_payment_account: {
        Args: {
          p_key: string; p_enabled: boolean; p_recipient_name?: string | null;
          p_account_number?: string | null; p_wallet_number?: string | null;
          p_iban?: string | null; p_swift?: string | null; p_bank_name?: string | null;
          p_instructions?: string | null; p_use_for?: string[] | null;
          p_supports_payout?: boolean | null; p_account_email?: string | null;
          p_bank_address?: string | null; p_display_fields?: PayField[] | null;
          p_international_fields?: PayField[] | null;
        };
        Returns: undefined;
      };
      request_payment_info: { Args: { p_payment: string; p_question: string }; Returns: undefined };
      answer_payment_info: {
        Args: { p_payment: string; p_note: string; p_proof_path?: string | null; p_reference?: string | null };
        Returns: undefined;
      };
      report_payment_currency: {
        Args: { p_payment: string; p_currency: string; p_amount: number; p_rate?: number | null };
        Returns: undefined;
      };
      start_payout_transfer: { Args: { p_request: string }; Returns: undefined };
      attach_payout_proof: { Args: { p_request: string; p_path: string }; Returns: undefined };
      finance_timeline: {
        Args: { p_type: FinanceEntity; p_id: string };
        Returns: {
          event_key: string; note_ar: string | null; actor_name: string | null;
          actor_is_admin: boolean; at: string;
        }[];
      };
      suggested_project_split: {
        Args: { p_project: string };
        Returns: { profile_id: string; full_name: string; tasks_done: number; percent: number }[];
      };
      set_project_split: {
        Args: { p_project: string; p_splits: { profile_id: string; percent: number }[] };
        Returns: undefined;
      };
      wallet_overview: {
        Args: Record<string, never>;
        Returns: {
          paid_usd: number; under_review_usd: number; refunded_usd: number; open_payments: number;
          pending_usd: number; available_usd: number; withdrawal_pending_usd: number;
          withdrawn_usd: number; total_earned_usd: number; open_withdrawals: number;
        }[];
      };
      wallet_transactions: {
        Args: { p_filter?: string; p_limit?: number };
        Returns: {
          entity_type: 'payment' | 'payout' | 'ledger'; entity_id: string; code: string | null;
          kind: string; label_ar: string; amount_usd: number; status: string; at: string;
        }[];
      };
      finance_overview: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: {
          gmv_usd: number; platform_revenue_usd: number; user_earnings_usd: number;
          refunded_usd: number; pending_verification_usd: number; pending_verification: number;
          needs_info: number; pending_withdrawals_usd: number; pending_withdrawals: number;
          held_in_escrow_usd: number; disputes: number; owed_to_users_usd: number;
        }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      channel_id: { Args: Record<string, never>; Returns: string };
      is_mentor: { Args: Record<string, never>; Returns: boolean };
      session_quote: {
        Args: { p_mentor: string; p_session_type: string };
        Returns: {
          price_usd: number; platform_share_usd: number; mentor_share_usd: number;
          min_usd: number; max_usd: number; default_usd: number; commission_pct: number;
          duration_minutes: number;
        }[];
      };
      mentor_price_list: {
        Args: { p_mentor: string };
        Returns: {
          session_type_id: string; name_ar: string; name_en: string | null; duration_minutes: number;
          price_usd: number; mentor_share_usd: number; min_usd: number; max_usd: number;
          default_usd: number; is_custom: boolean; is_active: boolean;
        }[];
      };
      set_session_price: { Args: { p_session_type: string; p_price: number | null }; Returns: undefined };
      save_mentor_level: {
        Args: {
          p_level: MentorLevel; p_default_usd: number; p_min_usd: number; p_max_usd: number;
          p_commission_pct: number;
        };
        Returns: undefined;
      };
      save_commission_tier: {
        Args: { p_kind: string; p_min_amount: number; p_rate: number; p_note?: string | null; p_remove?: boolean };
        Returns: undefined;
      };
      save_platform_setting: { Args: { p_key: string; p_value: string }; Returns: undefined };
      set_mentor_accepting: {
        Args: { p_accepting: boolean; p_until?: string | null; p_note?: string | null; p_mentor?: string | null };
        Returns: undefined;
      };
      refunds_owed: {
        Args: Record<string, never>;
        Returns: {
          booking_id: string; booking_code: string; student_name: string | null; mentor_name: string | null;
          amount_usd: number; reason_ar: string | null; auto_declined: boolean; since: string;
        }[];
      };
      set_path_mode: { Args: { p_path: string; p_mode: 'auto' | 'draft' | 'archived' }; Returns: ContentStatus };
      course_counts_in_path: { Args: { p_course: string }; Returns: boolean };
      add_rating_details: {
        Args: { p_kind: 'session' | 'client_work' | 'client'; p_id: string; p_recommend: boolean | null; p_liked?: string | null; p_improve?: string | null };
        Returns: undefined;
      };
      rate_course: {
        Args: { p_course: string; p_scores: Partial<Record<CourseCriterion, number>>; p_recommend?: boolean | null; p_liked?: string | null; p_improve?: string | null };
        Returns: string;
      };
      course_rating: {
        Args: { p_course: string };
        Returns: { stars_avg: number | null; rated_count: number; recommend_pct: number | null; criteria: Partial<Record<CourseCriterion, number>> }[];
      };
      mentor_performance: {
        Args: { p_mentor: string };
        Returns: {
          stars_avg: number | null; rated_count: number; sessions_held: number; attendance_pct: number | null;
          satisfaction_pct: number | null; recommend_pct: number | null; rebook_pct: number | null;
        }[];
      };
      feedback_digest: {
        Args: { p_profile: string };
        Returns: { source: 'session' | 'work' | 'as_client'; criterion: string; stars_avg: number; rated: number; kind: 'strength' | 'improve' | 'steady' }[];
      };
      feedback_texts: {
        Args: { p_profile: string };
        Returns: {
          source: 'session' | 'work' | 'as_client'; stars: number; recommend: boolean | null;
          liked_ar: string | null; improve_ar: string | null; comment_ar: string | null; created_at: string;
        }[];
      };
      open_ticket: {
        Args: {
          p_category: TicketCategory; p_subject: string; p_description: string;
          p_related?: TicketRelated | null; p_related_id?: string | null;
          p_attachment?: string | null; p_reported?: string | null;
        };
        Returns: SupportTicket;
      };
      post_ticket_message: {
        Args: { p_ticket: string; p_body: string; p_attachment?: string | null; p_internal?: boolean };
        Returns: string;
      };
      set_ticket_status: { Args: { p_ticket: string; p_status: TicketStatus; p_note?: string | null }; Returns: undefined };
      escalation_label: { Args: { p_reason: string }; Returns: string };
      my_tickets: {
        Args: Record<string, never>;
        Returns: {
          id: string; code: string; category: TicketCategory; subject_ar: string; status: TicketStatus;
          needs_human: boolean; updated_at: string; created_at: string;
        }[];
      };
      admin_tickets: {
        Args: { p_filter?: string };
        Returns: {
          id: string; code: string; category: TicketCategory; subject_ar: string; status: TicketStatus;
          priority: TicketPriority; needs_human: boolean; escalation_reason: string | null;
          ai_category: TicketCategory | null; ai_confidence: number | null; ai_suggested_action: string | null;
          reporter_id: string; reporter_name: string; reporter_techmood_id: string;
          reported_profile_id: string | null; reported_name: string | null; case_id: string | null;
          updated_at: string; created_at: string;
        }[];
      };
      is_restricted: { Args: { p_profile: string; p_feature: RestrictedFeature }; Returns: boolean };
      set_payment_payer: {
        Args: {
          p_payment: string; p_account?: string | null; p_holder?: string | null;
          p_account_ref?: string | null; p_method_key?: string | null; p_save?: boolean;
        };
        Returns: undefined;
      };
      push_public_key: { Args: Record<string, never>; Returns: string | null };
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent?: string | null };
        Returns: undefined;
      };
      remove_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
      my_level_progress: {
        Args: Record<string, never>;
        Returns: {
          current_level: MentorLevel | null; current_title: string | null;
          next_level: MentorLevel | null; next_title: string | null;
          sessions_count: number | null; sessions_guide: number | null;
          rating_avg: number | null; rating_guide: number | null;
          /** the next level's usual sessions and rating are met — a guide, not a gate */
          meets_guide: boolean;
          /** may send a request now */
          eligible: boolean;
          /** after a decline, when asking opens again */
          opens_at: string | null;
          pending_request: string | null; last_status: 'pending' | 'approved' | 'declined' | 'withdrawn' | null;
          last_note: string | null;
        }[];
      };
      submit_level_upgrade: { Args: { p_answers: Record<string, string> }; Returns: string };
      review_level_upgrade: { Args: { p_request: string; p_approve: boolean; p_note?: string | null }; Returns: undefined };
      admin_place_mentor: { Args: { p_mentor: string; p_level: MentorLevel; p_note: string }; Returns: undefined };
      admin_level_upgrades: {
        Args: Record<string, never>;
        Returns: {
          id: string; mentor_id: string; mentor_name: string;
          from_level: MentorLevel; from_title: string | null; to_level: MentorLevel; to_title: string | null;
          answers: Record<string, string>; sessions_at_request: number; rating_at_request: number | null;
          sessions_now: number; rating_now: number | null; sessions_guide: number | null; rating_guide: number | null;
          years_experience: number | null; domains: string[] | null; headline_ar: string | null;
          experience_ar: string | null; portfolio_url: string | null; linkedin_url: string | null;
          created_at: string;
        }[];
      };
      invoice_issuer: { Args: Record<string, never>; Returns: { name: string; details: string }[] };
      my_mentor_application: {
        Args: Record<string, never>;
        Returns: {
          request_id: string; status: RoleStatus; review_note: string | null;
          has_details: boolean; submitted_at: string;
        }[];
      };
      my_restrictions: {
        Args: Record<string, never>;
        Returns: { feature: RestrictedFeature; reason_ar: string; ends_at: string | null }[];
      };
      open_case: {
        Args: { p_title: string; p_ticket?: string | null; p_reported?: string | null };
        Returns: Database['public']['Tables']['cases']['Row'];
      };
      link_to_case: { Args: { p_case: string; p_type: CaseLinkType; p_id: string; p_note?: string | null }; Returns: undefined };
      add_case_note: { Args: { p_case: string; p_body: string }; Returns: undefined };
      add_case_evidence: {
        Args: { p_case: string; p_label: string; p_path?: string | null; p_url?: string | null };
        Returns: undefined;
      };
      save_ai_assist: {
        Args: {
          p_case: string | null; p_ticket: string | null; p_summary: string; p_next_step: string;
          p_category?: TicketCategory | null; p_confidence?: number | null;
        };
        Returns: undefined;
      };
      admin_case_action: {
        Args: {
          p_case: string; p_action: AdminActionKind; p_reason: string; p_target_profile?: string | null;
          p_target_id?: string | null; p_feature?: RestrictedFeature | null; p_duration_days?: number | null;
          p_notify?: boolean;
        };
        Returns: undefined;
      };
      case_facts: {
        Args: { p_case: string };
        Returns: { code: string; title: string; facts: string[]; evidence: number; messages: number; attachments: number } | null;
      };
      admin_cases: {
        Args: { p_filter?: string };
        Returns: {
          id: string; code: string; title_ar: string; status: CaseStatus; priority: TicketPriority;
          reporter_name: string | null; reported_name: string | null; tickets: number; updated_at: string;
        }[];
      };
      admin_overview: {
        Args: Record<string, never>;
        Returns: {
          users: number; active_today: number; mentors: number; open_tickets: number; pending_payments: number;
          pending_withdrawals: number; open_reports: number; escalations: number; high_priority_reports: number;
          mentor_applications: number; open_cases: number; refunds_owed: number;
        }[];
      };
      admin_event_feed: {
        Args: { p_limit?: number };
        Returns: {
          at: string; tone: 'red' | 'orange' | 'yellow' | 'blue' | 'green' | 'purple';
          kind: string; title_ar: string; link: string | null; profile_id: string | null;
        }[];
      };
      admin_users: {
        Args: { p_role?: UserRole | null; p_query?: string | null; p_limit?: number };
        Returns: {
          id: string; techmood_id: string; full_name: string; username: string | null; roles: UserRole[];
          restricted: boolean; open_reports: number; created_at: string;
        }[];
      };
      admin_user_summary: {
        Args: { p_profile: string };
        Returns: {
          roles: { role: UserRole; status: string }[]; xp: number; stars: number | null;
          wallet_available: number | null; wallet_pending: number | null; enrolments: number; certificates: number;
          bookings: number; sessions_as_mentor: number; teams: number; projects: number; tickets_filed: number;
          reports_about: number; warnings: number;
          active_restrictions: { id: string; feature: RestrictedFeature; reason: string; ends_at: string | null }[];
          cases: { id: string; code: string; title: string; status: CaseStatus }[];
        } | null;
      };
      admin_user_activity: {
        Args: { p_profile: string; p_limit?: number };
        Returns: { at: string; area: string; title_ar: string; link: string | null }[];
      };
      admin_scheduled_jobs: {
        Args: Record<string, never>;
        Returns: { job: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null; last_message: string | null }[];
      };
      admin_cohorts: {
        Args: { p_months?: number };
        Returns: {
          path_id: string; path_title_ar: string; cohort_month: string; enrolled: number;
          active_30d: number; completed: number; completion_pct: number;
        }[];
      };
      admin_ai_overview: {
        Args: { p_days?: number };
        Returns: {
          threads: number; people: number; messages: number; model_errors: number; proposals: number;
          confirmed: number; declined: number; failed: number; escalations: number;
        }[];
      };
      admin_ai_threads: {
        Args: { p_limit?: number };
        Returns: {
          id: string; profile_id: string; full_name: string; techmood_id: string; surface: string; scope: string;
          messages: number; errors: number; created_at: string; last_message_at: string | null;
        }[];
      };
      admin_ai_actions: {
        Args: { p_status?: string | null; p_limit?: number };
        Returns: {
          id: string; profile_id: string; full_name: string; kind: string; summary_ar: string; status: string;
          error_ar: string | null; proposed_at: string; decided_at: string | null;
        }[];
      };
      admin_ai_log: {
        Args: { p_errors_only?: boolean; p_limit?: number };
        Returns: { at: string; profile_id: string; surface: string; model: string | null; error_ar: string | null }[];
      };
      admin_read_ai_thread: {
        Args: { p_thread: string; p_case: string; p_reason: string };
        Returns: { role: string; content: string; created_at: string }[];
      };
      admin_weekly_metrics: {
        Args: { p_weeks?: number };
        Returns: {
          week: string; signups: number; active_people: number; enrolments: number; certificates: number;
          sessions_completed: number; tickets_opened: number; tickets_resolved: number;
        }[];
      };
      admin_signup_funnel: {
        Args: { p_days?: number };
        Returns: { step: 'signed_up' | 'onboarded' | 'enrolled' | 'first_lesson' | 'certified_or_session'; people: number }[];
      };
      admin_ticket_stats: {
        Args: { p_days?: number };
        Returns: { category: TicketCategory; opened: number; escalated: number; resolved: number; avg_hours_to_resolve: number | null }[];
      };
      admin_top_paths: {
        Args: { p_limit?: number };
        Returns: { path_id: string; title_ar: string; enrolled: number; completed: number }[];
      };
      admin_team: {
        Args: Record<string, never>;
        Returns: { profile_id: string; full_name: string; techmood_id: string; status: string; since: string; granted_by: string | null }[];
      };
      set_admin_role: { Args: { p_profile: string; p_grant: boolean; p_reason: string }; Returns: undefined };
      admin_audit_trail: {
        Args: { p_action?: string | null; p_limit?: number };
        Returns: {
          at: string; actor_name: string | null; action: string; entity_table: string; entity_id: string | null;
          detail: Record<string, unknown> | null;
        }[];
      };
      course_feedback_texts: {
        Args: { p_course: string };
        Returns: { stars: number; recommend: boolean | null; liked_ar: string | null; improve_ar: string | null; created_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
