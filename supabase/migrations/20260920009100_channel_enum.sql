-- =============================================================================
-- 0091 — A conversation kind for the TechMood channel
--
-- Its own migration: an enum value cannot be used in the transaction that
-- adds it (0092 uses it).
-- =============================================================================

alter type public.conversation_kind add value if not exists 'channel';
