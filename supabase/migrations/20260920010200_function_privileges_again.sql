-- =============================================================================
-- 0102 — Signed-out visitors, again: functions added since 0088
--
-- 0088 made PUBLIC and anon lose EXECUTE on new functions by default. On
-- Supabase a function is still granted to anon (and authenticated) by name when
-- it is created, whatever the migration's own default privileges say — the
-- security advisor found ten functions from 0092–0101 callable signed out:
-- trigger functions (which nobody should call at all) and two booking checks.
-- None leaks anything a visitor could use, but none is theirs to call.
--
-- Trigger functions lose EXECUTE for everybody; the two checks keep
-- authenticated (the rating page and the bookings policy use them).
-- =============================================================================

revoke execute on function public.issue_invoice_for_payment()     from public, anon, authenticated;
revoke execute on function public.join_channel()                  from public, anon, authenticated;
revoke execute on function public.notify_delivery_on_funding()    from public, anon, authenticated;
revoke execute on function public.on_booking_confirmed_xp()       from public, anon, authenticated;
revoke execute on function public.queue_push_for_notification()   from public, anon, authenticated;
revoke execute on function public.refuse_money_conversations()    from public, anon, authenticated;
revoke execute on function public.release_listing_on_cancel()     from public, anon, authenticated;
revoke execute on function public.require_payer_account()         from public, anon, authenticated;

revoke execute on function public.booking_reached_mentor(public.booking_status, timestamptz) from public, anon;
revoke execute on function public.booking_requires_evaluation(uuid)                         from public, anon;
