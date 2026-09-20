-- =============================================================================
-- TechMood — 0015 Booking and payment state vocabulary
--
-- Enum changes live in their own migration on purpose: a value added by
-- ALTER TYPE ... ADD VALUE cannot be USED in the same transaction that adds it,
-- so the tables and functions that reference these values come in 0016.
--
-- Reconciling the two product documents:
--   * the booking spec adds 'expired' (a reservation that was never paid for)
--   * it lists neither 'draft' nor 'refunded', but does not rule them out —
--     the refund flow is referenced in the mentor-declined case — so both stay
--   * payment 'submitted' is renamed 'under_review', which is the word the spec
--     uses for "sent, waiting on TechMood"
--   * payment gains 'failed' for a card payment that the gateway rejected
-- =============================================================================

alter type public.booking_status add value if not exists 'expired' after 'refunded';

alter type public.payment_status rename value 'submitted' to 'under_review';
alter type public.payment_status add value if not exists 'failed' after 'rejected';
