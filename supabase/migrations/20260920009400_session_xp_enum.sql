-- =============================================================================
-- 0094 — An XP source for a confirmed booking
--
-- Its own migration: an enum value cannot be used in the transaction that adds
-- it (0095 uses it).
-- =============================================================================

alter type public.xp_source add value if not exists 'mentor_session_booked' after 'mentor_session_attended';
