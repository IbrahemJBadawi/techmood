-- =============================================================================
-- 0049 — The values the market's next migration needs
--
-- A file of its own, as 0015, 0017 and 0027 were: a value added to an enum
-- cannot be used in the same transaction that added it, so the values land
-- here and 0050 uses them.
--
-- The application ladder the marketplace document describes has three steps
-- the enum never had — a poster reading the application, an interview, and an
-- offer made but not yet answered. Without them "submitted" silently covered
-- all three, and an applicant could not tell being read from being ignored.
--
-- And a project done for somebody else is not a personal project: 'client'
-- says who the work belongs to.
-- =============================================================================

alter type public.application_stage add value if not exists 'under_review' after 'submitted';
alter type public.application_stage add value if not exists 'interview'    after 'shortlisted';
alter type public.application_stage add value if not exists 'offer'        after 'interview';

alter type public.project_kind add value if not exists 'client' after 'startup';
