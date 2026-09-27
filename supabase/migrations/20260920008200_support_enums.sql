-- =============================================================================
-- 0082 — The words Help & Reports and case management are written in
--
-- Enum types (and a new value on an existing one) have to be committed before
-- a later migration uses them, so they live here on their own.
-- =============================================================================

-- What the problem is about. The person reporting picks it; nothing else
-- depends on them getting it exactly right — the admin can re-file it.
create type public.ticket_category as enum (
  'payment', 'booking', 'mentor', 'mentee', 'freelancer', 'client',
  'content', 'account', 'behavior', 'fraud', 'copyright', 'technical', 'other'
);

create type public.ticket_status as enum (
  'open',           -- just written
  'assistant',      -- the automated first line is answering
  'needs_human',    -- escalated: a person has to look
  'pending_user',   -- waiting for the reporter to answer
  'under_review',   -- an admin is on it
  'resolved',
  'rejected',
  'closed'
);

create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');

-- Who wrote a line in a ticket's conversation.
create type public.ticket_author as enum ('user', 'assistant', 'admin', 'system');

create type public.case_status as enum ('open', 'investigating', 'awaiting_info', 'decided', 'closed');

-- The things an admin can do about a case. Each is written down as an event.
create type public.admin_action_kind as enum (
  'request_info', 'warn', 'restrict_feature', 'suspend_session', 'cancel_booking',
  'refund', 'reject_report', 'resolve', 'escalate', 'suspend_account', 'lift_restriction'
);

-- What a restriction takes away. 'everything' is an account suspension.
create type public.restricted_feature as enum (
  'booking', 'messaging', 'marketplace', 'withdrawals', 'reviews', 'everything'
);

alter type public.notification_kind add value if not exists 'support';
