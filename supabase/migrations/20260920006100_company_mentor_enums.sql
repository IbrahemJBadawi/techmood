-- =============================================================================
-- 0061 — A company can be the party to a session
--
-- A company that books a mentor to review its business model is not a student
-- booking a session, and it is not a team either: the money is the company's,
-- the seats are its people's, and what the mentor is asked to look at is the
-- company's walls. Calling that a team booking would be the sort of small lie
-- that costs a schema its meaning later.
--
-- Values in their own file, as the convention has been since 0015; 0062 uses
-- them.
-- =============================================================================

alter type public.booking_kind add value if not exists 'company_mentor' after 'team_mentor';
alter type public.video_session_type add value if not exists 'company_mentor' after 'team_mentor';
