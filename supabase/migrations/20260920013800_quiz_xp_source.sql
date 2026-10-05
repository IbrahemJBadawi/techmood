-- =============================================================================
-- 0138 — An XP source for passing a lesson's quiz (0139)
--
-- On its own because a new enum value cannot be used in the transaction that
-- adds it.
-- =============================================================================

alter type public.xp_source add value if not exists 'lesson_quiz_passed';
