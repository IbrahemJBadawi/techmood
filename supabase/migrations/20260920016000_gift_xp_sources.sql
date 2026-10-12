-- ============================================================================
-- 0160 — two XP sources for gifts between members (used by 0161)
--
-- An enum value cannot be used in the transaction that adds it, so the values
-- come first, on their own.
-- ============================================================================
alter type public.xp_source add value if not exists 'gift_sent';
alter type public.xp_source add value if not exists 'gift_received';
