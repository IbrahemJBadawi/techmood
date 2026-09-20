-- =============================================================================
-- TechMood — 0001 Foundation: extensions, enums, helper functions
-- One Account -> One TechMood ID -> One Professional Identity -> One Reputation
-- =============================================================================

create extension if not exists "pgcrypto"      with schema extensions;
create extension if not exists "btree_gist"    with schema extensions;
create extension if not exists "pg_trgm"       with schema extensions;

-- ---------------------------------------------------------------------------
-- Identity & roles
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'student', 'freelancer', 'mentor', 'team_leader', 'founder', 'company', 'admin'
);

-- Student never needs review; every other role passes through pending_review.
create type public.role_status as enum (
  'approved', 'pending_review', 'rejected', 'suspended'
);

-- ---------------------------------------------------------------------------
-- Academy
-- ---------------------------------------------------------------------------
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.lesson_kind    as enum ('video', 'article', 'reading', 'exercise', 'live');
create type public.progress_status as enum ('locked', 'available', 'in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Evidence, submissions, evaluation
-- ---------------------------------------------------------------------------
create type public.evidence_kind as enum (
  'github', 'linkedin', 'youtube', 'drive', 'portfolio', 'website', 'file'
);

create type public.submission_kind as enum (
  'lesson_assignment', 'course_project', 'path_project', 'course_task', 'portfolio_evidence'
);

create type public.submission_status as enum (
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected'
);

create type public.evaluation_decision as enum (
  'approved', 'changes_requested', 'rejected'
);

create type public.reevaluation_status as enum ('open', 'scheduled', 'resolved', 'declined');

-- ---------------------------------------------------------------------------
-- XP (quantity / progress) is deliberately separate from Stars (quality).
-- ---------------------------------------------------------------------------
create type public.xp_source as enum (
  'lesson_completed',
  'assignment_evaluated',
  'course_project_evaluated',
  'course_completed',
  'path_project_evaluated',
  'path_completed',
  'mentor_session_attended',
  'team_contribution',
  'achievement_awarded'
);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create type public.certificate_kind   as enum ('course', 'path');
create type public.certificate_status as enum ('active', 'revoked');

-- ---------------------------------------------------------------------------
-- Mentors, bookings, payments
-- ---------------------------------------------------------------------------
create type public.mentor_level as enum ('L1', 'L2', 'L3', 'L4', 'L5', 'L6');

create type public.booking_kind as enum ('student_mentor', 'team_mentor');

-- The 10 booking states from the product spec. A booking is never "confirmed"
-- before its payment is verified AND the mentor has accepted it.
create type public.booking_status as enum (
  'draft',
  'payment_pending',
  'payment_submitted',
  'payment_verified',
  'mentor_pending',
  'confirmed',
  'completed',
  'cancelled',
  'rejected',
  'refunded'
);

create type public.payment_method as enum (
  'bank_of_palestine', 'palpay', 'jawwal_pay',
  'fawateeri_card', 'freelanso', 'western_union', 'moneygram', 'international_transfer'
);

create type public.payment_status as enum ('pending', 'submitted', 'verified', 'rejected', 'refunded');

create type public.call_kind as enum ('student_mentor', 'team_mentor', 'team_internal');

-- ---------------------------------------------------------------------------
-- Teams, projects, work
-- ---------------------------------------------------------------------------
create type public.team_member_role      as enum ('leader', 'member', 'mentor');
create type public.team_application_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.team_task_column      as enum ('todo', 'doing', 'review', 'done');
create type public.project_status        as enum ('planning', 'in_progress', 'in_review', 'completed', 'archived');
create type public.opportunity_kind      as enum ('freelance', 'job', 'team_seat', 'cofounder', 'internship', 'remote');
create type public.startup_stage         as enum ('idea', 'validation', 'mvp', 'users', 'business_model', 'startup');

-- ---------------------------------------------------------------------------
-- Messaging, notifications, wallet
-- ---------------------------------------------------------------------------
create type public.conversation_kind as enum ('admin', 'team', 'mentor_booking', 'learning_path');
create type public.notification_kind as enum (
  'evaluation', 'booking', 'payment', 'team', 'message', 'certificate', 'role_review', 'system'
);
create type public.ledger_kind   as enum ('earning', 'fee', 'commission', 'payout', 'refund');
create type public.ledger_status as enum ('pending', 'available', 'paid', 'cancelled');
