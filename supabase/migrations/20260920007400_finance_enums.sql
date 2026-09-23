-- =============================================================================
-- 0074 — One more thing a payment can be waiting for
--
-- Until now a submitted payment could only be verified or rejected. The
-- common case in between — "the receipt is cut off", "which account did you
-- send it from?" — had to be a rejection, which reads as an accusation and
-- throws away a receipt that was probably fine. `needs_info` is a question.
-- =============================================================================

alter type public.payment_status add value if not exists 'needs_info' after 'under_review';
