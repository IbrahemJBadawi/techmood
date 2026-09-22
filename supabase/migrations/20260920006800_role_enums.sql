-- =============================================================================
-- 0068 — Two roles the platform has been missing a word for
--
-- The behaviour of both already exists. Somebody books a mentor today without
-- being a "student" in any meaningful sense, and somebody posts a paid brief,
-- reads proposals, signs terms, funds an escrow and reviews the work today
-- without the platform ever calling them a client. What was missing was the
-- word — and with it a home page, a navigation and a reputation of their own.
--
--   mentee — here for guidance, not for the academy.
--   client — here with a need, not with a service. A person, a student, a
--            founder, a startup, an organisation, or somebody with an idea.
--
-- Both are **chosen, not reviewed**. Student is automatic for every account;
-- mentor, freelancer, founder, company and team lead are read by a human
-- because they make a claim about the person. Asking for guidance or having
-- work to hand out makes no claim at all, so a review would be theatre.
--
-- Enum values land in their own migration so the layer in 0069 can use them.
-- =============================================================================

alter type public.user_role add value 'mentee' before 'mentor';
alter type public.user_role add value 'client' after 'freelancer';

-- A brief can be open to the market, or shown only to the people invited to it.
-- Invite-only was already possible in spirit (`opportunity_invites` exists);
-- nothing said it out loud, so every brief was public whether its author meant
-- it or not.
create type public.opportunity_visibility as enum ('public', 'invite_only');

-- The other half of a review that was only ever written in one direction.
-- `client_criterion` says what a client judges the work on; this says what the
-- person who did the work judges the client on.
create type public.worker_criterion as enum (
  'clarity',          -- كان يعرف ما يريد
  'communication',    -- ردّ في وقته
  'professionalism',  -- تعامل باحترام
  'payment',          -- دفع كما اتّفقنا
  'scope'             -- لم يوسّع الاتفاق بعد بدايته
);

create type public.mentorship_goal_status as enum ('active', 'achieved', 'dropped');
