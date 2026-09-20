-- =============================================================================
-- TechMood — 0017 Team vocabulary
--
-- Enum values go in their own migration: a value added here cannot be used in
-- the same transaction, and 0018 uses all of them.
-- =============================================================================

-- A task that cannot move is not "in progress" and not "to do". Naming it is
-- what lets a team leader see where to intervene.
alter type public.team_task_column add value if not exists 'blocked' after 'doing';

create type public.team_kind as enum ('learning', 'project', 'freelance', 'startup');

create type public.team_status as enum ('active', 'completed', 'archived');

-- A closed workspace by default. 'listed' only exposes the professional profile
-- the team chose to publish — never its tasks, chat or documents.
create type public.team_visibility as enum ('private', 'listed');

create type public.team_join_policy as enum ('invite_only', 'request_allowed');

create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.sprint_status as enum ('planned', 'active', 'review', 'closed');

create type public.team_document_kind as enum (
  'requirements', 'specification', 'meeting_notes', 'decision', 'guideline',
  'design', 'report', 'deliverable', 'integration'
);

create type public.exhibition_status as enum ('draft', 'submitted', 'approved', 'rejected');

create type public.team_xp_source as enum (
  'task_completed', 'sprint_completed', 'project_completed',
  'on_time_delivery', 'mentor_review'
);

create type public.message_reaction as enum ('like', 'love', 'laugh', 'wow', 'thanks', 'celebrate');
