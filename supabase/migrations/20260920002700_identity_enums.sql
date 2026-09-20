-- =============================================================================
-- TechMood — 0027 Identity, onboarding and role vocabulary
--
-- The onboarding document adds a third admin decision — "Request More
-- Information" — which the current three-state review (approved / rejected /
-- suspended, plus pending_review) cannot express. It also introduces two
-- taxonomies the platform did not have (Fields and Interests) whose terms a
-- member may suggest, so terms need a review state of their own.
--
-- Enum changes live in their own migration because a value added by
-- ALTER TYPE ... ADD VALUE cannot be USED in the same transaction that adds it.
-- Everything that references these values arrives in 0028.
-- =============================================================================

-- A role request the admin sent back for more information. It is neither
-- approved nor rejected: the applicant still owns it and may answer.
alter type public.role_status add value if not exists 'needs_more_info' after 'pending_review';

-- Fields, Interests and Skills are open catalogues: anyone may suggest a term,
-- nobody may publish one. An unapproved term is never attachable to a profile.
create type public.taxonomy_status as enum ('approved', 'pending_review', 'rejected');

-- The interface language the member chose. Stored on the profile so the choice
-- follows the account across devices, not just the browser.
create type public.ui_language as enum ('ar', 'en');

-- The append-only trail behind a role request. `profile_roles.status` says
-- where the request stands now; these events say how it got there.
create type public.role_request_event as enum (
  'submitted', 'more_info_requested', 'more_info_provided',
  'approved', 'rejected', 'suspended', 'reinstated', 'withdrawn'
);
