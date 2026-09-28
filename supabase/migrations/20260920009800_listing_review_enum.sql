-- =============================================================================
-- 0098 — A listing waits for review, and can be refused
--
-- Its own migration: enum values cannot be used in the transaction that adds
-- them (0099 uses both).
-- =============================================================================

alter type public.listing_status add value if not exists 'pending_review' before 'listed';
alter type public.listing_status add value if not exists 'rejected' after 'withdrawn';
