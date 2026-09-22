-- =============================================================================
-- 0070 — A meeting between the two sides of a brief
--
-- I said this needed a new `booking_kind` and a pricing model. It does not, and
-- the mistake is worth naming: a booking is somebody **buying somebody else's
-- time**, which is why it carries a price, a mentor level, a payment and a
-- reservation hold. A client and the freelancer they already hired are not
-- buying anything from each other — they are two parties to a contract that
-- exists, agreeing to talk.
--
-- `team_internal` is already exactly that shape: a room, a start, an end, a
-- participant list, and no money anywhere near it. A project meeting is the
-- same thing with a different set of people, so it is a fourth session type,
-- not a fourth kind of booking.
-- =============================================================================

alter type public.video_session_type add value 'project_meeting' after 'team_internal';

-- Who somebody is in a room. A project meeting has two sides and the existing
-- words ('mentor', 'student') describe neither of them.
alter type public.session_role add value 'client' after 'leader';
alter type public.session_role add value 'contractor' after 'client';
