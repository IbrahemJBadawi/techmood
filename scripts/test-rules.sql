-- =============================================================================
-- TechMood — business rule tests
--
-- Runs against a freshly migrated + seeded database. Every check either passes
-- silently or aborts the run, so a clean exit means every rule below holds.
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages to notice;
\pset tuples_only on
\pset format unaligned

create or replace function public.assert(p_condition boolean, p_label text)
returns text language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAILED: %', p_label;
  end if;
  return 'ok   ' || p_label;
end $$;

-- Asserts that a statement is rejected, and that the message matches.
create or replace function public.assert_rejects(p_sql text, p_label text, p_expect text default null)
returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_expect is not null and position(lower(p_expect) in lower(sqlerrm)) = 0 then
      raise exception 'FAILED: % — rejected, but for the wrong reason: %', p_label, sqlerrm;
    end if;
    return 'ok   ' || p_label;
  end;
  raise exception 'FAILED: % — the statement was accepted but should have been rejected', p_label;
end $$;

-- ---------------------------------------------------------------------------
-- Actors
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'sara@example.com',  '{"full_name":"سارة يوسف"}'),
  ('22222222-2222-2222-2222-222222222222', 'khaled@example.com','{"full_name":"خالد أبو رجب"}'),
  ('33333333-3333-3333-3333-333333333333', 'lama@example.com',  '{"full_name":"لمى الخطيب"}'),
  ('44444444-4444-4444-4444-444444444444', 'admin@example.com', '{"full_name":"مشرف المنصة"}');

-- ===========================================================================
-- 1. Identity
-- ===========================================================================
select public.assert(
  (select count(*) from public.profiles) = 4,
  '1.1 signing up creates exactly one profile per account');

select public.assert(
  (select techmood_id ~ '^TMU-[0-9A-HJKMNP-TV-Z]{8}$' from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  '1.2 every profile gets a well-formed TechMood ID');

select public.assert(
  (select count(distinct techmood_id) from public.profiles) = 4,
  '1.3 TechMood IDs are unique');

select public.assert(
  (select status from public.profile_roles
    where profile_id = '11111111-1111-1111-1111-111111111111' and role = 'student') = 'approved',
  '1.4 the student role is approved without review');

-- Roles beyond student wait for a human.
insert into public.profile_roles (profile_id, role) values
  ('33333333-3333-3333-3333-333333333333', 'mentor');

select public.assert(
  (select status from public.profile_roles
    where profile_id = '33333333-3333-3333-3333-333333333333' and role = 'mentor') = 'pending_review',
  '1.5 a non-student role enters pending_review');

-- Promote the admin and approve the mentor (as the platform would).
insert into public.profile_roles (profile_id, role, status)
values ('44444444-4444-4444-4444-444444444444', 'admin', 'approved');
update public.profile_roles set status = 'approved'
 where profile_id = '33333333-3333-3333-3333-333333333333' and role = 'mentor';

-- A logged-in user must not be able to make themselves an admin.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  $$insert into public.profile_roles (profile_id, role, status)
    values ('11111111-1111-1111-1111-111111111111', 'admin', 'approved')$$,
  '1.6 a user cannot grant themselves the admin role');

-- RLS denies by filtering rows away, not by raising: the statement succeeds and
-- changes nothing. Asserting on the row's state is the honest check.
reset role;
insert into public.profile_roles (profile_id, role)
values ('22222222-2222-2222-2222-222222222222', 'freelancer');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.profile_roles set status = 'approved'
 where profile_id = '22222222-2222-2222-2222-222222222222' and role = 'freelancer';
reset role;

select public.assert(
  (select status from public.profile_roles
    where profile_id = '22222222-2222-2222-2222-222222222222' and role = 'freelancer') = 'pending_review',
  '1.7 a user cannot approve their own pending role application');

-- ===========================================================================
-- 2. XP economy
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.lesson_progress (profile_id, lesson_id, status)
select '11111111-1111-1111-1111-111111111111', l.id, 'completed'
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'python-for-ai';

reset role;

select public.assert(
  (select coalesce(sum(xp), 0) from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111' and source = 'lesson_completed') = 10,
  '2.1 completing two lessons awards 5 XP each, not hundreds');

-- Re-completing the same lesson must not pay twice.
set role authenticated;
update public.lesson_progress set status = 'available'
 where profile_id = '11111111-1111-1111-1111-111111111111';
update public.lesson_progress set status = 'completed'
 where profile_id = '11111111-1111-1111-1111-111111111111';
reset role;

select public.assert(
  (select coalesce(sum(xp), 0) from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111' and source = 'lesson_completed') = 10,
  '2.2 XP is idempotent — re-completing a lesson pays nothing extra');

set role authenticated;
select public.assert_rejects(
  $$select public.award_xp('11111111-1111-1111-1111-111111111111', 'lesson_completed', 'x', gen_random_uuid())$$,
  '2.3 a client cannot call award_xp() directly to mint XP',
  'permission denied');

select public.assert_rejects(
  $$select public.notify('22222222-2222-2222-2222-222222222222', 'system', 'رسالة مزروعة')$$,
  '2.4 a client cannot call notify() to write into another inbox',
  'permission denied');
reset role;

-- ===========================================================================
-- 3. Submissions, evaluation history, re-evaluation
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  format($$select public.submit_work(%L, '[]'::jsonb)$$,
    (select a.id from public.assignments a
     join public.lessons l on l.id = a.lesson_id
     where l.title_ar = 'Python للمبتدئين')),
  '3.1 submitting without the required evidence is refused',
  'missing required evidence');

select public.submit_work(
  (select a.id from public.assignments a
   join public.lessons l on l.id = a.lesson_id
   where l.title_ar = 'Python للمبتدئين'),
  '[{"kind":"github","url":"https://github.com/sara/first","label":"repo"}]'::jsonb,
  'أول محاولة'
) as first_submission \gset

select public.assert(
  (select current_version from public.submissions where id = :'first_submission') = 1,
  '3.2 a first submission creates version 1');

-- A student may not grade their own work.
select public.assert_rejects(
  format($$select public.evaluate_submission(%L, 'approved', 5::smallint, 'ممتاز')$$, :'first_submission'),
  '3.3 a student cannot evaluate a submission',
  'only a mentor or an admin');

-- The mentor asks for changes.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.evaluate_submission(:'first_submission', 'changes_requested', 2::smallint, 'سمِّ المتغيرات بوضوح أكبر');

-- The student revises and resubmits.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.submit_work(
  (select assignment_id from public.submissions where id = :'first_submission'),
  '[{"kind":"github","url":"https://github.com/sara/first-v2","label":"repo"}]'::jsonb,
  'بعد التعديل'
);

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.evaluate_submission(:'first_submission', 'approved', 4::smallint, 'أفضل بكثير');
reset role;

select public.assert(
  (select current_version from public.submissions where id = :'first_submission') = 2,
  '3.4 resubmitting creates a second version');

select public.assert(
  (select count(*) from public.submission_versions where submission_id = :'first_submission') = 2,
  '3.5 the original submission version is kept, not overwritten');

select public.assert(
  (select count(*) from public.evaluations where submission_id = :'first_submission') = 2,
  '3.6 both evaluations are kept — the first score survives the re-evaluation');

select public.assert(
  (select stars from public.evaluations
    where submission_id = :'first_submission' order by created_at limit 1) = 2,
  '3.7 the first evaluation still reads 2 stars after the second review');

select public.assert(
  (select xp from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111'
      and source = 'assignment_evaluated') = 12,
  '3.8 an approved 4-star assignment pays 4 x 3 = 12 XP');

-- ===========================================================================
-- 4. RLS — the audit's "change the id in the URL" problem
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';  -- a different student

select public.assert(
  (select count(*) from public.submissions where id = :'first_submission') = 0,
  '4.1 another student cannot read a classmate submission');

select public.assert(
  (select count(*) from public.evaluations where submission_id = :'first_submission') = 0,
  '4.2 another student cannot read a classmate evaluation');

select public.assert(
  (select count(*) from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111') = 0,
  '4.3 another student cannot read a classmate XP ledger');

update public.profiles set full_name = 'اسم مزروع'
 where id = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select full_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') = 'سارة يوسف',
  '4.4 writing to another profile changes nothing');

-- The mentor, by contrast, is meant to see submitted work.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.submissions where id = :'first_submission') = 1,
  '4.5 a mentor can read submitted work they are expected to review');

reset role;

-- ===========================================================================
-- 5. Certificates are issued from approved work, never from a checkbox
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  format($$select public.issue_certificate('course', %L)$$,
    (select id from public.courses where slug = 'python-for-ai')),
  '5.1 a certificate is refused while required work is unapproved',
  'requirements are not met');
reset role;

-- Approve the rest of the course's required work, the way a mentor would.
do $$
declare
  v_student uuid := '11111111-1111-1111-1111-111111111111';
  v_mentor  uuid := '33333333-3333-3333-3333-333333333333';
  rec       record;
  v_sub     uuid;
  v_ver     uuid;
begin
  for rec in
    select asg.id as assignment_id
    from public.assignments asg
    left join public.lessons les on les.id = asg.lesson_id
    left join public.modules mod on mod.id = les.module_id
    join public.courses crs on crs.id = coalesce(asg.course_id, mod.course_id)
    where crs.slug = 'python-for-ai' and asg.is_required
  loop
    insert into public.submissions (assignment_id, profile_id, status, current_version)
    values (rec.assignment_id, v_student, 'approved', 1)
    on conflict (assignment_id, profile_id) do update
      set status = 'approved'
    returning id into v_sub;

    select id into v_ver from public.submission_versions
     where submission_id = v_sub order by version desc limit 1;

    if v_ver is null then
      insert into public.submission_versions (submission_id, version)
      values (v_sub, 1)
      returning id into v_ver;
    end if;

    insert into public.evaluations (submission_id, version_id, evaluator_id, decision, stars)
    values (v_sub, v_ver, v_mentor, 'approved', 5);
  end loop;
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select (public.issue_certificate('course',
  (select id from public.courses where slug = 'python-for-ai'))).certificate_code as cert \gset
reset role;

select public.assert(
  :'cert' ~ '^TM-C-[0-9A-HJKMNP-TV-Z]{8}$',
  '5.2 an eligible course issues a certificate with a verifiable code');

select public.assert(
  (select (snapshot ->> 'techmood_id') = (select techmood_id from public.profiles
     where id = '11111111-1111-1111-1111-111111111111')
   from public.certificates where certificate_code = :'cert'),
  '5.3 the certificate carries the holder TechMood ID');

select public.assert(
  (select count(*) from public.verify_certificate(:'cert') where status = 'active') = 1,
  '5.4 the public verification endpoint resolves the code');

select public.assert(
  (select count(*) from public.verify_certificate('TM-C-00000000')) = 0,
  '5.5 an unknown code verifies as nothing');

select public.assert(
  (select xp from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111'
      and source = 'course_completed') = 25,
  '5.6 completing a course awards a flat 25 XP');

-- ===========================================================================
-- 6. Mentor availability and the booking state machine
-- ===========================================================================
insert into public.mentor_profiles (profile_id, level, session_minutes)
values ('33333333-3333-3333-3333-333333333333', 'L1', 60);

select public.assert_rejects(
  $$insert into public.mentor_availability (mentor_id, day_of_week, start_time, end_time)
    values ('33333333-3333-3333-3333-333333333333', 2, '09:00', '16:00')$$,
  '6.1 a mentor cannot publish more than 5 hours in one day',
  'at most 5 hours');

-- A real window: every weekday 09:00-14:00 (exactly the 5-hour cap).
insert into public.mentor_availability (mentor_id, day_of_week, start_time, end_time)
select '33333333-3333-3333-3333-333333333333', d, '09:00', '14:00'
from generate_series(0, 6) d;

select public.assert(
  (select count(*) from public.mentor_availability
    where mentor_id = '33333333-3333-3333-3333-333333333333') = 7,
  '6.2 availability is published for all seven days');

select public.assert_rejects(
  $$insert into public.bookings
      (kind, student_id, mentor_id, scheduled_start, scheduled_end, price_usd, platform_share_usd, mentor_share_usd)
    values ('student_mentor', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
            now() + interval '1 day', now() + interval '1 day 1 hour', 15, 5, 10)$$,
  '6.3 a session cannot be booked inside the 72-hour notice window',
  'at least 72 hours');

select public.assert_rejects(
  $$insert into public.bookings
      (kind, student_id, mentor_id, scheduled_start, scheduled_end, price_usd, platform_share_usd, mentor_share_usd)
    values ('student_mentor', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
            date_trunc('day', now() + interval '7 days') + interval '20 hours',
            date_trunc('day', now() + interval '7 days') + interval '21 hours', 15, 5, 10)$$,
  '6.4 a slot outside published availability is refused',
  'outside the mentor published availability');

select public.assert_rejects(
  $$insert into public.bookings
      (kind, student_id, mentor_id, scheduled_start, scheduled_end, price_usd, platform_share_usd, mentor_share_usd)
    values ('student_mentor', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
            date_trunc('day', now() + interval '7 days') + interval '10 hours',
            date_trunc('day', now() + interval '7 days') + interval '11 hours', 15, 6, 10)$$,
  '6.5 the platform and mentor shares must add up to the session price');

insert into public.bookings
  (kind, student_id, mentor_id, scheduled_start, scheduled_end, price_usd, platform_share_usd, mentor_share_usd, topic_ar, status)
values ('student_mentor', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        date_trunc('day', now() + interval '7 days') + interval '10 hours',
        date_trunc('day', now() + interval '7 days') + interval '11 hours',
        15, 5, 10, 'مراجعة مشروع GenAI', 'draft')
returning id as booking \gset

select public.assert_rejects(
  format($$update public.bookings set status = 'confirmed' where id = %L$$, :'booking'),
  '6.6 a booking cannot jump straight from draft to confirmed',
  'illegal booking transition');

update public.bookings set status = 'payment_pending' where id = :'booking';

-- A draft does not hold the slot on purpose: an abandoned cart must not block
-- other students. Once the booking is live, the slot is exclusively its own.
select public.assert_rejects(
  $$insert into public.bookings
      (kind, student_id, mentor_id, scheduled_start, scheduled_end, price_usd, platform_share_usd, mentor_share_usd, status)
    values ('student_mentor', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
            date_trunc('day', now() + interval '7 days') + interval '10 hours 30 minutes',
            date_trunc('day', now() + interval '7 days') + interval '11 hours 30 minutes', 15, 5, 10, 'payment_pending')$$,
  '6.7 a live booking blocks an overlapping slot for the same mentor');

insert into public.payments (booking_id, method_key, amount_usd, status, reference, submitted_at)
values (:'booking', 'jawwal_pay', 15, 'under_review', 'JP-99213', now())
returning id as payment \gset

update public.bookings set status = 'payment_submitted' where id = :'booking';

select public.assert_rejects(
  format($$update public.bookings set status = 'confirmed' where id = %L$$, :'booking'),
  '6.8 a booking cannot be confirmed while the payment is only submitted',
  'illegal booking transition');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.verify_payment(%L, true)$$, :'payment'),
  '6.9 a student cannot verify their own payment',
  'only an admin');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.verify_payment(:'payment', true);
reset role;

select public.assert(
  (select status from public.bookings where id = :'booking') = 'mentor_pending',
  '6.10 a verified payment moves the booking to the mentor for a decision');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.mentor_decide_booking(%L, true)$$, :'booking'),
  '6.11 only the booked mentor may accept the booking',
  'only the booked mentor');

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.mentor_decide_booking(:'booking', true);
reset role;

select public.assert(
  (select status from public.bookings where id = :'booking') = 'confirmed',
  '6.12 payment verified + mentor accepted = confirmed');

select public.assert(
  (select count(*) from public.conversations where booking_id = :'booking') = 1,
  '6.13 confirming a booking opens its mentor conversation');

-- Payment proof privacy: the mentor is a party to the session, not to the receipt.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.payments where id = :'payment') = 0,
  '6.14 the mentor cannot read the student payment record');
reset role;

update public.bookings set status = 'completed' where id = :'booking';

select public.assert(
  (select mentor_share_usd from public.wallet_entries
    w join public.bookings b on b.id = w.ref_id
    where w.profile_id = '33333333-3333-3333-3333-333333333333' and w.kind = 'earning'
    limit 1) = 10.00,
  '6.15 a completed session credits the mentor their share');

select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 10.00,
  '6.16 the wallet balance is derived from the ledger');

select public.assert(
  (select sessions_count from public.mentor_profiles
    where profile_id = '33333333-3333-3333-3333-333333333333') = 1,
  '6.17 a completed session counts towards the mentor level requirements');

-- ===========================================================================
-- 7. Messaging rules
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select id as conv from public.conversations where booking_id = :'booking' \gset

select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '11111111-1111-1111-1111-111111111111', 'شوف المشروع هنا https://drive.google.com/x')$$, :'conv'),
  '7.1 links are not allowed inside TechMood messages',
  'links and images are not allowed');

insert into public.messages (conversation_id, sender_id, body_ar)
values (:'conv', '11111111-1111-1111-1111-111111111111', 'جاهزة للجلسة، شكراً لك');

select public.assert(
  (select count(*) from public.messages where conversation_id = :'conv') = 1,
  '7.2 an ordinary message is accepted');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert(
  (select count(*) from public.messages where conversation_id = :'conv') = 0,
  '7.3 a non-participant cannot read the conversation');

select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '22222222-2222-2222-2222-222222222222', 'مرحبا')$$, :'conv'),
  '7.4 a non-participant cannot post into the conversation');
reset role;

-- ===========================================================================
-- 8. Team rules
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.teams (slug, title_ar, leader_id, needs)
values ('genai-capstone', 'فريق مشروع GenAI', '11111111-1111-1111-1111-111111111111', array['Frontend','AI'])
returning id as team \gset

insert into public.team_members (team_id, profile_id, role)
values (:'team', '11111111-1111-1111-1111-111111111111', 'leader');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.team_applications (team_id, profile_id, role_wanted)
values (:'team', '22222222-2222-2222-2222-222222222222', 'Backend')
returning id as application \gset

select public.assert_rejects(
  format($$select public.decide_team_application(%L, true)$$, :'application'),
  '8.1 an applicant cannot accept their own join request',
  'only the team leader');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.decide_team_application(:'application', true);
reset role;

select public.assert(
  (select count(*) from public.team_members
    where team_id = :'team' and profile_id = '22222222-2222-2222-2222-222222222222') = 1,
  '8.2 accepting an application is what creates membership');

insert into public.call_sessions (kind, team_id, starts_at, created_by)
values ('team_internal', :'team', date_trunc('week', now()) + interval '1 day', '11111111-1111-1111-1111-111111111111'),
       ('team_internal', :'team', date_trunc('week', now()) + interval '3 days', '11111111-1111-1111-1111-111111111111');

select public.assert_rejects(
  format($$insert into public.call_sessions (kind, team_id, starts_at, created_by)
           values ('team_internal', %L, date_trunc('week', now()) + interval '5 days',
                   '11111111-1111-1111-1111-111111111111')$$, :'team'),
  '8.3 a team is capped at two internal calls per week',
  'at most 2 internal calls');

-- ===========================================================================
-- 9. Admin surface
-- ===========================================================================
select public.assert(
  (select count(*) from public.admin_review_queue where item_kind = 'role_application') >= 0,
  '9.1 the review queue aggregates everything awaiting a human');

select public.assert(
  (select count(*) from public.admin_audit_log where entity_table = 'payments') > 0,
  '9.2 payment decisions are written to the audit log');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  (select count(*) from public.admin_audit_log) = 0,
  '9.3 a non-admin cannot read the audit log');
reset role;

-- ===========================================================================
-- 10. Catalogue integrity
-- ===========================================================================
select public.assert(
  (select count(*) from public.learning_paths where status = 'published') = 6,
  '10.1 all six prototype paths were carried over');

select public.assert(
  (select count(*) from public.courses) = 18,
  '10.2 all eighteen courses were carried over');

select public.assert(
  (select count(*) from public.lessons) = 36,
  '10.3 all thirty-six lessons were carried over');

select public.assert(
  (select count(*) from public.assignments where kind = 'path_project' and is_group_work) = 6,
  '10.4 every path has a group capstone project');

select public.assert(
  (select bool_and(platform_share_usd + mentor_share_usd = session_price_usd)
     from public.mentor_levels),
  '10.5 every mentor level splits its price consistently');

select public.assert(
  (select session_price_usd from public.mentor_levels where level = 'L6') = 100.00,
  '10.6 the published L1-L6 price ladder is loaded');

-- ===========================================================================
-- 11. Mentor review workflow and re-evaluation
-- ===========================================================================
insert into auth.users (id, email, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'rana@example.com', '{"full_name":"رنا عبد الله"}');

insert into public.profile_roles (profile_id, role, status)
values ('55555555-5555-5555-5555-555555555555', 'mentor', 'approved');

-- A second mentor must be able to read what the first one wrote, otherwise a
-- re-review is done blind.
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

-- Three by now: the changes_requested and approved rounds from section 3, plus
-- the approval section 5 made while clearing the course's required work.
select public.assert(
  (select count(*) from public.evaluations where submission_id = :'first_submission') = 3,
  '11.1 a second mentor reads the full evaluation history of a submission');

select public.assert(
  (select count(*) from public.submission_evidence se
    join public.submission_versions sv on sv.id = se.version_id
    where sv.submission_id = :'first_submission') = 2,
  '11.2 a reviewing mentor reads the evidence of every version');

-- A student contests the score.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.reevaluation_requests (submission_id, evaluation_id, requested_by, reason_ar)
select :'first_submission',
       (select id from public.evaluations where submission_id = :'first_submission' order by created_at desc limit 1),
       '11111111-1111-1111-1111-111111111111',
       'أضفت معالجة الحالات الحدّية التي طُلبت، أرجو إعادة التقييم.'
returning id as reeval \gset

select public.assert(
  (select status from public.reevaluation_requests where id = :'reeval') = 'open',
  '11.3 a student may open a re-evaluation request on their own work');

-- but not on someone else's.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$insert into public.reevaluation_requests (submission_id, evaluation_id, requested_by, reason_ar)
           values (%L, (select id from public.evaluations where submission_id = %L limit 1),
                   '11111111-1111-1111-1111-111111111111', 'طلب مزروع')$$,
         :'first_submission', :'first_submission'),
  '11.4 a student cannot open a re-evaluation request on behalf of someone else');

-- The second mentor resolves it and records a fresh evaluation.
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.evaluate_submission(:'first_submission', 'approved', 5::smallint, 'المعالجة مكتملة الآن، ممتاز.');

update public.reevaluation_requests
   set status = 'resolved', resolved_at = now()
 where id = :'reeval';
reset role;

select public.assert(
  (select status from public.reevaluation_requests where id = :'reeval') = 'resolved',
  '11.5 a mentor may resolve a re-evaluation request');

select public.assert(
  (select count(*) from public.evaluations where submission_id = :'first_submission') = 4,
  '11.6 the re-review appends an evaluation and erases none of the earlier ones');

select public.assert(
  (select stars from public.evaluations
    where submission_id = :'first_submission' order by created_at limit 1) = 2,
  '11.7 the original 2-star evaluation still reads 2 after two re-reviews');

-- XP is idempotent across re-reviews: the assignment pays once, at its best
-- approved rating, not once per approval.
select public.assert(
  (select count(*) from public.xp_events
    where profile_id = '11111111-1111-1111-1111-111111111111'
      and source = 'assignment_evaluated'
      and ref_id = :'first_submission') = 1,
  '11.8 re-approving the same work does not pay XP twice');

-- ===========================================================================
-- 12. Booking flow: slots, price integrity, payment, expiry
-- ===========================================================================

-- The mentor publishes which session types they offer.
insert into public.mentor_session_types (mentor_id, session_type_id)
select '33333333-3333-3333-3333-333333333333', id
from public.session_types where slug in ('career_guidance', 'project_review');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- A type the mentor does not offer is refused.
select public.assert_rejects(
  format($$select public.create_booking_request(
      '33333333-3333-3333-3333-333333333333',
      (select id from public.session_types where slug = 'portfolio_review'),
      date_trunc('day', now() + interval '10 days') + interval '11 hours',
      'jawwal_pay')$$),
  '12.1 a mentor cannot be booked for a session type they do not offer',
  'does not offer');

-- A payment method the admin turned off is refused.
select public.assert_rejects(
  format($$select public.create_booking_request(
      '33333333-3333-3333-3333-333333333333',
      (select id from public.session_types where slug = 'career_guidance'),
      date_trunc('day', now() + interval '10 days') + interval '11 hours',
      'fawateer')$$),
  '12.2 a disabled payment method cannot be used',
  'not available');

-- A real request.
select (public.create_booking_request(
  '33333333-3333-3333-3333-333333333333',
  (select id from public.session_types where slug = 'career_guidance'),
  date_trunc('day', now() + interval '10 days') + interval '11 hours',
  'jawwal_pay',
  'أريد مراجعة مشروعي وتحديد خطوتي التالية.',
  '[{"kind":"project","label":"مشروع GenAI"}]'::jsonb
)).id as booking2 \gset
reset role;

select public.assert(
  (select price_usd from public.bookings where id = :'booking2') = 15.00
  and (select platform_share_usd from public.bookings where id = :'booking2') = 5.00
  and (select mentor_share_usd from public.bookings where id = :'booking2') = 10.00,
  '12.3 the price comes from the mentor level, never from the caller');

select public.assert(
  (select status from public.bookings where id = :'booking2') = 'payment_pending'
  and (select reserved_until from public.bookings where id = :'booking2') > now(),
  '12.4 a new request holds the slot while the student pays');

select public.assert(
  (select count(*) from public.booking_review_items where booking_id = :'booking2') = 1,
  '12.5 what the student asked to be reviewed is attached to the booking');

select public.assert(
  (select state from public.mentor_available_slots(
     '33333333-3333-3333-3333-333333333333',
     (date_trunc('day', now() + interval '10 days'))::date,
     (date_trunc('day', now() + interval '10 days'))::date)
   where slot_start = date_trunc('day', now() + interval '10 days') + interval '11 hours') = 'pending',
  '12.6 the held slot reads as pending on the mentor calendar');

select public.assert(
  (select state from public.mentor_available_slots(
     '33333333-3333-3333-3333-333333333333',
     (date_trunc('day', now() + interval '10 days'))::date,
     (date_trunc('day', now() + interval '10 days'))::date)
   where slot_start = date_trunc('day', now() + interval '10 days') + interval '12 hours') = 'available',
  '12.7 a free hour in the same window still reads as available');

select public.assert(
  (select count(*) from public.mentor_available_slots(
     '33333333-3333-3333-3333-333333333333', current_date, current_date)
   where state = 'available') = 0,
  '12.8 nothing inside the 72-hour notice window is bookable');

-- A second student cannot take a held slot.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.create_booking_request(
      '33333333-3333-3333-3333-333333333333',
      (select id from public.session_types where slug = 'career_guidance'),
      date_trunc('day', now() + interval '10 days') + interval '11 hours',
      'jawwal_pay')$$),
  '12.9 a held slot cannot be double-booked by another student');

-- Receipt and reference requirements are re-checked in the database.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.submit_payment_proof(%L, null, null)$$, :'booking2'),
  '12.10 a method that requires a receipt refuses a submission without one',
  'requires a receipt');

select public.submit_payment_proof(
  :'booking2',
  '11111111-1111-1111-1111-111111111111/receipt-2.png',
  'JP-77120'
);
reset role;

select public.assert(
  (select status from public.bookings where id = :'booking2') = 'payment_submitted'
  and (select status from public.payments where booking_id = :'booking2') = 'under_review',
  '12.11 submitting the receipt hands the payment to TechMood for review');

-- A rejected receipt returns the booking to the student with the slot still held.
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.verify_payment(
  (select id from public.payments where booking_id = :'booking2'),
  false,
  'الإيصال غير واضح.'
);
reset role;

select public.assert(
  (select status from public.bookings where id = :'booking2') = 'payment_pending'
  and (select reserved_until from public.bookings where id = :'booking2') > now(),
  '12.12 a rejected payment returns the booking with a fresh hold on the slot');

select public.assert(
  (select rejection_reason from public.payments where booking_id = :'booking2') = 'الإيصال غير واضح.',
  '12.13 the student can be told exactly why the receipt was rejected');

-- An abandoned reservation releases its slot.
update public.bookings set reserved_until = now() - interval '1 minute' where id = :'booking2';

select public.assert(
  public.expire_stale_bookings() >= 1,
  '12.14 abandoned reservations are expired by the scheduled job');

select public.assert(
  (select status from public.bookings where id = :'booking2') = 'expired',
  '12.15 the abandoned booking ends in expired, not cancelled');

select public.assert(
  (select state from public.mentor_available_slots(
     '33333333-3333-3333-3333-333333333333',
     (date_trunc('day', now() + interval '10 days'))::date,
     (date_trunc('day', now() + interval '10 days'))::date)
   where slot_start = date_trunc('day', now() + interval '10 days') + interval '11 hours') = 'available',
  '12.16 an expired reservation gives the slot back');

select public.assert(
  (select count(*) from public.booking_events where booking_id = :'booking2') >= 5,
  '12.17 every step of the booking is recorded on its timeline');

select public.assert(
  (select count(*) from public.booking_events
    where booking_id = :'booking2' and event_key = 'payment_rejected') = 1,
  '12.18 the timeline distinguishes payment events from booking events');

-- Payment proof stays private to the payer and admins.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.payments where booking_id = :'booking2') = 0,
  '12.19 the mentor still cannot read the receipt or its reference');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  (select count(*) from public.payment_methods where key = 'fawateer') = 0,
  '12.20 a student never sees a payment method the admin disabled');

select public.assert(
  (select count(*) from public.payment_methods) = 7,
  '12.21 a student sees exactly the seven enabled methods');
reset role;

select public.assert(
  (select count(*) from public.payment_methods) = 8,
  '12.22 an admin still sees the disabled method in order to enable it');

-- ===========================================================================
-- 13. Team workspace and messaging
-- ===========================================================================

select id as team_conv from public.conversations where team_id = :'team' and kind = 'team' \gset

select public.assert(
  :'team_conv' is not null,
  '13.1 creating a team opens its chat automatically');

select public.assert(
  (select count(*) from public.conversation_participants
    where conversation_id = :'team_conv') = 2,
  '13.2 team membership and chat membership stay in step');

-- A private team is invisible to everyone outside it.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select public.assert(
  (select count(*) from public.teams where id = :'team') = 0,
  '13.3 a private team is not readable by a non-member');

select public.assert(
  (select count(*) from public.team_tasks where team_id = :'team') = 0,
  '13.4 a non-member cannot read the team board');

select public.assert(
  (select count(*) from public.messages where conversation_id = :'team_conv') = 0,
  '13.5 a non-member cannot read the team chat');
reset role;

-- Opting into a public professional profile exposes the team, not its work.
update public.teams set visibility = 'listed' where id = :'team';

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.teams where id = :'team') = 1,
  '13.6 a listed team profile is readable by anyone');

select public.assert(
  (select count(*) from public.team_tasks where team_id = :'team') = 0,
  '13.7 listing a team still does not expose its tasks');
reset role;

update public.teams set visibility = 'private' where id = :'team';

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.team_tasks (team_id, title_ar, assignee_id, created_by, due_on, column_key)
values (:'team', 'بناء واجهة تسجيل الدخول', '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', current_date + 3, 'doing')
returning id as task \gset

select public.assert_rejects(
  format($$update public.team_tasks set column_key = 'blocked' where id = %L$$, :'task'),
  '13.8 a blocked task must record what is blocking it',
  'what is blocking it');

update public.team_tasks
   set column_key = 'blocked', blocked_reason_ar = 'بانتظار تصميم الواجهة'
 where id = :'task';

select public.assert(
  (select column_key from public.team_tasks where id = :'task') = 'blocked',
  '13.9 a blocked task is accepted once the reason is recorded');

update public.team_tasks set column_key = 'done' where id = :'task';
reset role;

select public.assert(
  (select completed_at from public.team_tasks where id = :'task') is not null,
  '13.10 completing a task stamps when it was completed');

select public.assert(
  (select total_xp from public.team_xp where team_id = :'team') = 7,
  '13.11 an on-time task pays the team 2 XP plus a 5 XP on-time bonus');

select public.assert(
  (select xp from public.xp_events
    where profile_id = '22222222-2222-2222-2222-222222222222'
      and source = 'team_contribution' and ref_id = :'task') = 3,
  '13.12 the assignee earns a small, fixed personal XP for the task');

select public.assert(
  (select count(*) from public.messages
    where conversation_id = :'team_conv' and is_system
      and body_ar like '%اكتملت مهمة%') = 1,
  '13.13 finishing work reports itself into the team chat as a system message');

select public.assert(
  (select count(*) from public.team_activity
    where team_id = :'team' and verb = 'task_completed' and task_id = :'task') = 1,
  '13.14 the activity log records who did what, on which task');

-- Sprints belong to the leader.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- A WITH CHECK violation raises, unlike a USING filter which silently hides rows.
select public.assert_rejects(
  format($$insert into public.sprints (team_id, number, goal_ar, starts_on, ends_on)
           values (%L, 1, 'محاولة عضو', current_date, current_date + 7)$$, :'team'),
  '13.15 an ordinary member cannot open a sprint',
  'row-level security');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.sprints (team_id, number, goal_ar, starts_on, ends_on, status)
values (:'team', 1, 'إكمال نظام المصادقة', current_date, current_date + 7, 'active')
returning id as sprint \gset
reset role;

select public.assert(
  (select count(*) from public.messages
    where conversation_id = :'team_conv' and is_system and body_ar like '%بدأ السبرنت%') = 1,
  '13.16 starting a sprint announces itself in the team chat');

-- ---------------------------------------------------------------------------
-- Messaging rules
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '11111111-1111-1111-1111-111111111111', 'الملف على drive.google.com شوفوه')$$, :'team_conv'),
  '13.17 a bare domain is refused, not only a full URL',
  'links and images are not allowed');

select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '11111111-1111-1111-1111-111111111111', 'تعالوا على t.me/techmood')$$, :'team_conv'),
  '13.18 a messenger invite link is refused too');

insert into public.messages (conversation_id, sender_id, body_ar)
values (:'team_conv', '11111111-1111-1111-1111-111111111111', 'خلصت الواجهة، جاهزة للمراجعة')
returning id as msg \gset

-- Reply and reaction stay inside the conversation.
insert into public.messages (conversation_id, sender_id, body_ar, reply_to_id)
values (:'team_conv', '11111111-1111-1111-1111-111111111111', 'تمام، سأراجعها اليوم', :'msg');

insert into public.message_reactions (message_id, profile_id, reaction)
values (:'msg', '11111111-1111-1111-1111-111111111111', 'like');

insert into public.message_reactions (message_id, profile_id, reaction)
values (:'msg', '11111111-1111-1111-1111-111111111111', 'celebrate')
on conflict (message_id, profile_id) do update set reaction = excluded.reaction;
reset role;

select public.assert(
  (select count(*) from public.message_reactions where message_id = :'msg') = 1
  and (select reaction from public.message_reactions where message_id = :'msg') = 'celebrate',
  '13.19 a reaction is one signal per person, replaced rather than stacked');

-- A non-participant can neither read nor react.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$insert into public.message_reactions (message_id, profile_id, reaction)
           values (%L, '33333333-3333-3333-3333-333333333333', 'like')$$, :'msg'),
  '13.20 a non-participant cannot react to a message they cannot see');
reset role;

-- Unread counts come from each person's own read marker.
select public.assert(
  (select unread_count from public.conversation_unread
    where conversation_id = :'team_conv'
      and profile_id = '22222222-2222-2222-2222-222222222222') > 0,
  '13.21 a member who has not read the thread has unread messages');

update public.conversation_participants set last_read_at = now()
 where conversation_id = :'team_conv' and profile_id = '22222222-2222-2222-2222-222222222222';

select public.assert(
  (select unread_count from public.conversation_unread
    where conversation_id = :'team_conv'
      and profile_id = '22222222-2222-2222-2222-222222222222') = 0,
  '13.22 reading the thread clears the unread count');

-- When the relationship behind a conversation ends, the history stays but the
-- writing stops.
update public.conversations set is_read_only = true where id = :'team_conv';

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '11111111-1111-1111-1111-111111111111', 'رسالة متأخرة')$$, :'team_conv'),
  '13.23 a read-only conversation refuses new messages',
  'read-only');
reset role;

update public.conversations set is_read_only = false where id = :'team_conv';

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.team_invites (team_id, invitee_id, responsibility_ar, invited_by)
values (:'team', '55555555-5555-5555-5555-555555555555', 'Frontend', '11111111-1111-1111-1111-111111111111')
returning token as invite_token \gset

-- An invitation addressed to one person is not a public door.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$select public.accept_team_invite(%L)$$, :'invite_token'),
  '13.24 an invitation cannot be redeemed by someone else',
  'belongs to someone else');

set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.accept_team_invite(:'invite_token');
reset role;

select public.assert(
  (select count(*) from public.team_members
    where team_id = :'team' and profile_id = '55555555-5555-5555-5555-555555555555') = 1,
  '13.25 accepting an invitation joins the team with the existing account');

select public.assert(
  (select count(*) from public.conversation_participants
    where conversation_id = :'team_conv'
      and profile_id = '55555555-5555-5555-5555-555555555555') = 1,
  '13.26 joining a team also joins its chat');

delete from public.team_members
 where team_id = :'team' and profile_id = '55555555-5555-5555-5555-555555555555';

select public.assert(
  (select count(*) from public.conversation_participants
    where conversation_id = :'team_conv'
      and profile_id = '55555555-5555-5555-5555-555555555555') = 0,
  '13.27 leaving a team leaves its chat');

-- ===========================================================================
-- 14. Always-open learning paths, path chat and the admin thread
-- ===========================================================================

select public.assert(
  (select count(*) from public.conversations where kind = 'learning_path') = 6,
  '14.1 every published path opens exactly one conversation');

select public.assert(
  (select count(*) from public.conversations c
    join public.learning_paths lp on lp.id = c.path_id
    where lp.slug = 'genai') = 1,
  '14.2 a path has one permanent conversation — no cohorts, no splitting');

-- Captured before switching role: RLS would hide it from a non-participant,
-- which is precisely what the next assertion checks.
select c.id as genai_conv from public.conversations c
  join public.learning_paths lp on lp.id = c.path_id
  where lp.slug = 'genai' \gset

-- Not enrolled: the path chat is closed to you.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.assert(
  (select count(*) from public.conversations where id = :'genai_conv') = 0,
  '14.3 a student who has not enrolled cannot see the path conversation');

-- Enrolling joins it.
insert into public.enrollments (profile_id, path_id)
select '22222222-2222-2222-2222-222222222222', id
from public.learning_paths where slug = 'genai';
reset role;

select public.assert(
  (select count(*) from public.conversation_participants
    where conversation_id = :'genai_conv'
      and profile_id = '22222222-2222-2222-2222-222222222222') = 1,
  '14.4 enrolling in a path joins its conversation');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.assert(
  (select count(*) from public.conversations where id = :'genai_conv') = 1,
  '14.5 an enrolled student can now open the path chat');

insert into public.messages (conversation_id, sender_id, body_ar)
values (:'genai_conv', '22222222-2222-2222-2222-222222222222', 'هل من توضيح إضافي عن الدرس الثاني؟');

select public.assert(
  (select count(*) from public.messages where conversation_id = :'genai_conv') = 1,
  '14.6 an enrolled student can post in the path chat');
reset role;

-- ---------------------------------------------------------------------------
-- The administration thread
-- ---------------------------------------------------------------------------
select public.assert(
  (select count(*) from public.conversations where kind = 'admin') = 5,
  '14.7 every account is given a thread with TechMood administration');

select c.id as sara_admin_conv
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
where c.kind = 'admin' and cp.profile_id = '11111111-1111-1111-1111-111111111111' \gset

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.messages (conversation_id, sender_id, body_ar)
values (:'sara_admin_conv', '11111111-1111-1111-1111-111111111111', 'واجهت مشكلة في رفع إيصال الدفع');

-- Another student must not reach someone else's support thread.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert(
  (select count(*) from public.messages where conversation_id = :'sara_admin_conv') = 0,
  '14.8 a support thread is private to its owner');

select public.assert_rejects(
  format($$insert into public.messages (conversation_id, sender_id, body_ar)
           values (%L, '22222222-2222-2222-2222-222222222222', 'رسالة متطفلة')$$, :'sara_admin_conv'),
  '14.9 another student cannot post into someone else support thread');

-- An admin answers without being stored as a participant in every thread.
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.messages (conversation_id, sender_id, body_ar)
values (:'sara_admin_conv', '44444444-4444-4444-4444-444444444444', 'أهلاً سارة، جرّبي الرفع الآن من فضلك.');
reset role;

select public.assert(
  (select count(*) from public.messages where conversation_id = :'sara_admin_conv') = 2,
  '14.10 an admin can answer a support thread without joining it first');

-- ===========================================================================
-- 15. Exhibition — turning team work into professional evidence
-- ===========================================================================

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.projects (title_ar, description_ar, owner_id, team_id, tags)
values ('منصة تجارة إلكترونية', 'متجر متكامل بلوحة تحكم وتقارير مبيعات.',
        '11111111-1111-1111-1111-111111111111', :'team', array['React','Node.js'])
returning id as project \gset

-- Contributions are read off the board, so the tasks have to point at the project.
update public.team_tasks set project_id = :'project' where id = :'task';

insert into public.team_tasks (team_id, project_id, title_ar, assignee_id, created_by, column_key)
values (:'team', :'project', 'بناء واجهة المتجر', '11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111', 'done');

-- An unfinished project has nothing to exhibit.
select public.assert_rejects(
  format($$select public.submit_to_exhibition(%L, 'ملخص المشروع')$$, :'project'),
  '15.1 an unfinished project cannot be submitted to the exhibition',
  'only a completed project');

update public.projects set status = 'completed' where id = :'project';
reset role;

select public.assert(
  (select completed_at from public.projects where id = :'project') is not null,
  '15.2 marking a project complete stamps when it finished');

-- Someone outside the project cannot submit it.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$select public.submit_to_exhibition(%L, 'ملخص من شخص آخر')$$, :'project'),
  '15.3 only the project owner or the team leader may submit it',
  'only the project owner');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select (public.submit_to_exhibition(
  :'project',
  'متجر إلكتروني كامل بُني ضمن فريق TechMood، مع لوحة تحكم وتقارير مبيعات.',
  array['React','Node.js','PostgreSQL'],
  'https://demo.example.com',
  'التوثيق الكامل داخل مستودع المشروع.'
)).id as entry \gset
reset role;

select public.assert(
  (select status from public.exhibition_entries where id = :'entry') = 'submitted',
  '15.4 a completed project can be submitted and waits for review');

-- Nothing is public before an admin approves it.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.exhibition_gallery) = 0,
  '15.5 a submitted entry is not in the public gallery yet');

select public.assert_rejects(
  format($$select public.review_exhibition_entry(%L, true)$$, :'entry'),
  '15.6 only an admin may approve an exhibition entry',
  'only an admin');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.review_exhibition_entry(:'entry', true, 'عمل موثّق ومكتمل.');
reset role;

select public.assert(
  (select status from public.exhibition_entries where id = :'entry') = 'approved'
  and (select published_at from public.exhibition_entries where id = :'entry') is not null,
  '15.7 approval publishes the entry');

select public.assert(
  (select count(*) from public.exhibition_gallery) = 1,
  '15.8 an approved entry appears in the public gallery');

-- Contributions are derived, and frozen into the snapshot at approval.
select public.assert(
  (select jsonb_array_length(snapshot -> 'members') from public.exhibition_entries where id = :'entry') = 2,
  '15.9 the snapshot records both members who completed work on the project');

select public.assert(
  (select (member ->> 'tasks_done')::integer
   from public.exhibition_entries e
   cross join lateral jsonb_array_elements(e.snapshot -> 'members') as member
   where e.id = :'entry'
     and (member ->> 'profile_id')::uuid = '11111111-1111-1111-1111-111111111111') = 1,
  '15.10 each member contribution is counted from completed tasks, not self-reported');

select public.assert(
  (select snapshot #>> '{team,title}' from public.exhibition_entries where id = :'entry')
    = (select title_ar from public.teams where id = :'team'),
  '15.11 the snapshot carries the team that built it');

-- Publishing must not open a window into a private workspace.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  (select count(*) from public.exhibition_gallery) = 1
  and (select count(*) from public.teams where id = :'team') = 0
  and (select count(*) from public.team_tasks where team_id = :'team') = 0,
  '15.12 the gallery is public while the team behind it stays private');
reset role;

-- It reaches the members' professional record.
select public.assert(
  (select count(*) from public.profile_exhibition_entries('22222222-2222-2222-2222-222222222222')) = 1,
  '15.13 a published project shows on the passport of everyone who built it');

select public.assert(
  (select count(*) from public.profile_exhibition_entries('33333333-3333-3333-3333-333333333333')) = 0,
  '15.14 someone who did not work on it does not get credit for it');

select public.assert(
  (select count(*) from public.team_xp_events
    where team_id = :'team' and source = 'project_completed') = 1,
  '15.15 the team earns its project XP when the work is published, not before');

select public.assert(
  (select count(*) from public.admin_review_queue where item_kind = 'exhibition_entry') = 0,
  '15.16 a reviewed entry leaves the admin queue');

-- ===========================================================================
-- 16. Wallet: payouts and refunds
-- ===========================================================================

-- The mentor keeps their whole share. The platform's cut lives on the booking,
-- not as a second debit against the person who earned the money.
select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 10.00,
  '16.1 a completed session leaves the mentor their full share, not share minus commission');

select public.assert(
  (select count(*) from public.wallet_entries where kind = 'commission') = 0,
  '16.2 the double-counted commission rows are gone from member ledgers');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

insert into public.payout_accounts (profile_id, method_key, holder_name, wallet_number, is_default)
values ('33333333-3333-3333-3333-333333333333', 'jawwal_pay', 'لمى الخطيب', '0599123456', true)
returning id as payout_account \gset

-- Below the platform minimum, and above the available balance: both refused.
select public.assert_rejects(
  format($$select public.request_payout(%L, 10)$$, :'payout_account'),
  '16.3 a payout below the platform minimum is refused',
  'minimum payout');

select public.assert_rejects(
  format($$select public.request_payout(%L, 500)$$, :'payout_account'),
  '16.4 a payout larger than the available balance is refused',
  'only');
reset role;

-- An admin lowers the minimum so the rest of the flow can be exercised.
update public.platform_settings set value = '5' where key = 'payout_minimum_usd';

-- You cannot pay yourself into someone else's account.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.request_payout(%L, 10)$$, :'payout_account'),
  '16.5 a payout cannot be sent to someone else account',
  'does not belong to you');

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select (public.request_payout(:'payout_account', 10)).id as payout \gset
reset role;

select public.assert(
  (select status from public.payout_requests where id = :'payout') = 'requested',
  '16.6 a payout request is recorded and waits for review');

select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 0.00,
  '16.7 requesting a payout holds the money immediately');

-- The same balance cannot be requested twice while the first request is open.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$select public.request_payout(%L, 10)$$, :'payout_account'),
  '16.8 the held balance cannot be requested a second time');

select public.assert_rejects(
  format($$select public.review_payout(%L, true, 'JP-1')$$, :'payout'),
  '16.9 a member cannot approve their own payout',
  'only an admin');
reset role;

-- Rejecting returns the money.
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.review_payout(:'payout', false, null, 'بيانات الحساب غير مكتملة');
reset role;

select public.assert(
  (select status from public.payout_requests where id = :'payout') = 'rejected',
  '16.10 an admin can reject a payout request with a reason');

select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 10.00,
  '16.11 rejecting a payout returns the held money to the member');

select public.assert_rejects(
  format($$select public.review_payout(%L, true, 'JP-2')$$, :'payout'),
  '16.12 a settled payout request cannot be reviewed again',
  'already settled');

-- Approving a fresh request, and the balance stays reduced afterwards.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select (public.request_payout(:'payout_account', 10)).id as payout2 \gset

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.review_payout(:'payout2', true, 'JP-99887', 'حُوّل عبر Jawwal Pay');
reset role;

select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 0.00,
  '16.13 once paid, the balance stays reduced rather than bouncing back');

select public.assert(
  (select total_paid_out_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = 10.00,
  '16.14 the wallet reports what has actually been paid out');

-- Payout account details are personal financial data.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  (select count(*) from public.payout_accounts where id = :'payout_account') = 0,
  '16.15 another member cannot read someone payout account details');
reset role;

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.refund_booking(%L, 'أريد استرداد المبلغ')$$, :'booking'),
  '16.16 a student cannot refund their own booking',
  'only an admin');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.refund_booking(:'booking', 'اعتذر المنتور بعد التأكيد');
reset role;

select public.assert(
  (select status from public.bookings where id = :'booking') = 'refunded'
  and (select status from public.payments where booking_id = :'booking') = 'refunded',
  '16.17 refunding settles both the booking and its payment');

select public.assert(
  (select amount_usd from public.wallet_entries
    where ref_id = :'booking' and kind = 'refund') = 15.00,
  '16.18 the refund is credited to the student wallet, where it stays traceable');

select public.assert(
  (select status from public.wallet_entries
    where ref_id = :'booking' and kind = 'earning') = 'cancelled',
  '16.19 a refunded session is no longer earned by the mentor');

-- The mentor was already paid for a session that was later refunded, so their
-- balance goes negative. That is the honest record, not a bug to round away.
select public.assert(
  (select available_usd from public.wallet_balance
    where profile_id = '33333333-3333-3333-3333-333333333333') = -10.00,
  '16.20 a payout made before a refund leaves an honest negative balance');

select public.assert(
  (select count(*) from public.admin_review_queue where item_kind = 'payout_request') = 0,
  '16.21 settled payout requests leave the admin queue');

-- ===========================================================================
-- 17. Incubator: canvas, business plan, strategy
-- ===========================================================================

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.startups (slug, name_ar, description_ar, founder_id, one_liner_ar, is_public)
values ('sehha-raqamiya', 'صحة رقمية', 'منصة متابعة صحية للعيادات الصغيرة.',
        '11111111-1111-1111-1111-111111111111', 'متابعة المرضى بلا أوراق.', true)
returning id as startup \gset
reset role;

select public.assert(
  (select role from public.startup_members
    where startup_id = :'startup' and profile_id = '11111111-1111-1111-1111-111111111111') = 'founder',
  '17.1 creating a startup makes its founder a member automatically');

select public.assert(
  (select count(*) from public.startup_stage_history where startup_id = :'startup') = 1,
  '17.2 the starting stage is recorded in the history');

-- ---------------------------------------------------------------------------
-- The canvas is a private working document
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.canvas_cards (startup_id, block, body_ar, colour, sort_order, created_by)
values
  (:'startup', 'value_propositions', 'توفير وقت التوثيق الورقي', 'royal', 0, '11111111-1111-1111-1111-111111111111'),
  (:'startup', 'channels', 'زيارات مباشرة للعيادات', 'default', 0, '11111111-1111-1111-1111-111111111111'),
  (:'startup', 'revenue_streams', 'اشتراك شهري لكل عيادة', 'green', 0, '11111111-1111-1111-1111-111111111111'),
  (:'startup', 'cost_structure', 'استضافة وفريق دعم', 'amber', 0, '11111111-1111-1111-1111-111111111111'),
  (:'startup', 'key_activities', 'تطوير المنتج ودعم العيادات', 'violet', 0, '11111111-1111-1111-1111-111111111111');

insert into public.canvas_cards (startup_id, block, body_ar, colour, sort_order, created_by)
values (:'startup', 'customer_segments', 'عيادات صغيرة في غزة', 'sky', 0, '11111111-1111-1111-1111-111111111111')
returning id as card1 \gset
reset role;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.assert(
  (select count(*) from public.startups where id = :'startup') = 1,
  '17.3 a listed startup is visible to anyone');

select public.assert(
  (select count(*) from public.canvas_cards where startup_id = :'startup') = 0,
  '17.4 the business model canvas stays private to the startup team');

select public.assert_rejects(
  format($$insert into public.canvas_cards (startup_id, block, body_ar)
           values (%L, 'channels', 'بطاقة متطفلة')$$, :'startup'),
  '17.5 an outsider cannot add a card to someone canvas');
reset role;

-- Moving a card between blocks
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.move_canvas_card(:'card1', 'key_partners', 0);
reset role;

select public.assert(
  (select block from public.canvas_cards where id = :'card1') = 'key_partners',
  '17.6 a card can be moved to another block');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$select public.move_canvas_card(%L, 'channels', 0)$$, :'card1'),
  '17.7 an outsider cannot move a card on someone canvas',
  'edit access');
reset role;

-- ---------------------------------------------------------------------------
-- The ten-section business plan
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  format($$insert into public.business_plan_sections (startup_id, section, body_ar, is_complete)
           values (%L, 'executive_summary', '', true)$$, :'startup'),
  '17.8 an empty plan section cannot be marked complete',
  'cannot be marked complete');

insert into public.business_plan_sections (startup_id, section, body_ar, is_complete) values
  (:'startup', 'executive_summary',   'منصة تتابع المرضى إلكترونياً وتوفّر وقت التوثيق.', true),
  (:'startup', 'company_description', 'شركة ناشئة في غزة تخدم العيادات الصغيرة.',        true),
  (:'startup', 'market_analysis',     'أكثر من 400 عيادة صغيرة في القطاع.',               true),
  (:'startup', 'product_and_service', 'تطبيق ويب بسيط لإدارة الملفات والمواعيد.',        false);
reset role;

select public.assert(
  (select completed_sections from public.business_plan_progress where startup_id = :'startup') = 3
  and (select percent from public.business_plan_progress where startup_id = :'startup') = 30,
  '17.9 plan progress is counted from completed sections, out of ten');

-- ---------------------------------------------------------------------------
-- Strategy and SMART goals
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.startup_strategy (startup_id, vision_ar, mission_ar, values_ar)
values (:'startup', 'رعاية صحية بلا أوراق في فلسطين.', 'نمنح العيادات الصغيرة أدوات المستشفيات.',
        array['الخصوصية','البساطة','الاعتماد على الدليل']);

insert into public.swot_items (startup_id, quadrant, body_ar) values
  (:'startup', 'strength',    'فريق تقني يعرف السوق المحلي'),
  (:'startup', 'weakness',    'لا يوجد تمويل بعد'),
  (:'startup', 'opportunity', 'التحول الرقمي في القطاع الصحي'),
  (:'startup', 'threat',      'ضعف الاتصال بالإنترنت');

-- A goal that does not move is not measurable.
select public.assert_rejects(
  format($$insert into public.smart_goals
      (startup_id, title_ar, specific_ar, metric_label_ar, baseline_value, target_value, starts_on, due_on)
    values (%L, 'هدف بلا حركة', 'وصف', 'عيادات', 10, 10, current_date, current_date + 90)$$, :'startup'),
  '17.10 a SMART goal whose target equals its baseline is refused');

select public.assert_rejects(
  format($$insert into public.smart_goals
      (startup_id, title_ar, specific_ar, metric_label_ar, baseline_value, target_value, starts_on, due_on)
    values (%L, 'هدف بتاريخ مقلوب', 'وصف', 'عيادات', 0, 25, current_date, current_date - 10)$$, :'startup'),
  '17.11 a SMART goal that ends before it starts is refused');

insert into public.smart_goals
  (startup_id, title_ar, specific_ar, achievable_ar, relevant_ar,
   metric_label_ar, baseline_value, target_value, current_value, starts_on, due_on, status)
values
  (:'startup', 'الوصول إلى 25 عيادة مشتركة',
   'التعاقد مع 25 عيادة صغيرة في غزة وخان يونس.',
   'لدينا فريق مبيعات من شخصين ونموذج جاهز.',
   'الاشتراكات هي مصدر الدخل الوحيد في هذه المرحلة.',
   'عيادة مشتركة', 0, 25, 10, current_date - 30, current_date + 60, 'on_track')
returning id as goal \gset
reset role;

select public.assert(
  (select percent from public.smart_goal_progress where goal_id = :'goal') = 40,
  '17.12 goal progress is computed from the numbers, not typed in');

select public.assert(
  (select time_elapsed_percent from public.smart_goal_progress where goal_id = :'goal') = 33,
  '17.13 time elapsed is computed alongside it, so drift is visible');

-- ---------------------------------------------------------------------------
-- Applying to the incubator
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.apply_to_incubator(%L, 'سأقدّم عن شركة غيري')$$, :'startup'),
  '17.14 only the founder may apply to the incubator',
  'only the founder');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select (public.apply_to_incubator(
  :'startup',
  'نطلب دعم الحاضنة للوصول إلى أول 25 عيادة وبناء نموذج اشتراك مستدام.'
)).id as application \gset

select public.assert_rejects(
  format($$select public.apply_to_incubator(%L, 'طلب ثانٍ')$$, :'startup'),
  '17.15 a second application cannot be opened while one is under review',
  'already under review');
reset role;

select public.assert(
  (select stage_at_application from public.incubator_applications where id = :'application') = 'idea'
  and (select plan_percent_at_application from public.incubator_applications where id = :'application') = 30,
  '17.16 the application captures where the startup stood when it applied');

select public.assert(
  (select is_in_incubator from public.startups where id = :'startup') = false,
  '17.17 applying does not admit a startup into the incubator by itself');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.review_incubator_application(%L, true)$$, :'application'),
  '17.18 a founder cannot approve their own application',
  'only an admin');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.review_incubator_application(:'application', true, 'فكرة واضحة وسوق محدد.');
reset role;

select public.assert(
  (select is_in_incubator from public.startups where id = :'startup') = true,
  '17.19 approval admits the startup into the incubator');

-- A canvas that has barely been started is not ready for an application.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.startups (slug, name_ar, founder_id)
values ('fikra-jadida', 'فكرة جديدة', '22222222-2222-2222-2222-222222222222')
returning id as startup2 \gset

select public.assert_rejects(
  format($$select public.apply_to_incubator(%L, 'عندي فكرة')$$, :'startup2'),
  '17.20 applying requires a business model canvas that was actually filled in',
  'business model canvas');
reset role;

select public.assert(
  (select count(*) from public.startup_stage_history where startup_id = :'startup2') = 1,
  '17.21 every startup starts with a recorded stage');

-- ===========================================================================
-- 18. Marketplace
-- ===========================================================================

-- A student-only account consumes the marketplace; posting needs a reviewed role.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.assert_rejects(
  $$insert into public.opportunities (kind, title_ar, posted_by)
    values ('job', 'مطوّر واجهات', '22222222-2222-2222-2222-222222222222')$$,
  '18.1 a student-only account cannot post a paid job',
  'row-level security');
reset role;

-- Give that account an approved company role, the way review would.
insert into public.profile_roles (profile_id, role, status)
values ('22222222-2222-2222-2222-222222222222', 'company', 'approved');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

insert into public.opportunities
  (kind, title_ar, organization_ar, description_ar, posted_by, compensation_kind,
   amount_min, amount_max, required_skills, min_stars, seats, tags)
values
  ('job', 'مطوّرة واجهات — دوام جزئي', 'شركة تقنية ناشئة',
   'العمل على واجهة منتج قائم بـ React.', '22222222-2222-2222-2222-222222222222',
   'monthly', 400, 700, array['React','CSS'], 3.0, 1, array['Frontend'])
returning id as job \gset

select public.assert(
  (select count(*) from public.opportunities where id = :'job') = 1,
  '18.2 an approved company role can post a job');

-- You cannot apply to your own posting.
select public.assert_rejects(
  format($$select public.apply_to_opportunity(%L, 'أنا الناشر')$$, :'job'),
  '18.3 a poster cannot apply to their own opportunity',
  'your own posting');
reset role;

-- Matching is honest and advisory: it reports the gap, it does not slam a door.
select public.assert(
  (select meets_stars from public.opportunity_match(:'job', '11111111-1111-1111-1111-111111111111')) = true,
  '18.4 the match reports whether the applicant meets the star bar');

select public.assert(
  (select array_length(missing_skills, 1)
   from public.opportunity_match(:'job', '11111111-1111-1111-1111-111111111111')) = 2,
  '18.5 the match names exactly which required skills are missing');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select (public.apply_to_opportunity(:'job', 'عملت على مشروع مشابه ضمن فريق.')).id as job_app \gset

select public.assert(
  (select stage from public.opportunity_applications where id = :'job_app') = 'submitted',
  '18.6 someone who does not meet every requirement may still apply');

select public.assert_rejects(
  format($$select public.decide_opportunity_application(%L, 'accepted')$$, :'job_app'),
  '18.7 an applicant cannot accept their own application',
  'only the poster');
reset role;

-- The poster sees the evidence, because the person applied to them.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.assert(
  (select certificates from public.applicant_evidence(:'job_app')) >= 1,
  '18.8 the poster sees the applicant verified record, not just a cover note');

select public.decide_opportunity_application(:'job_app', 'shortlisted', 'سجل قوي — لنتحدث.');
reset role;

select public.assert(
  (select stage from public.opportunity_applications where id = :'job_app') = 'shortlisted',
  '18.9 the poster can move an application through its stages');

select public.assert(
  (select count(*) from public.notifications
    where profile_id = '11111111-1111-1111-1111-111111111111'
      and title_ar like '%القائمة المختصرة%') = 1,
  '18.10 the applicant is told when their application moves');

-- A third party can see neither the application nor the evidence.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select public.assert(
  (select count(*) from public.opportunity_applications where id = :'job_app') = 0,
  '18.11 an unrelated member cannot read someone application');

select public.assert_rejects(
  format($$select * from public.applicant_evidence(%L)$$, :'job_app'),
  '18.12 evidence is visible to the poster and the applicant, nobody else',
  'applications made to you');
reset role;

-- Accepting fills the seat and closes a single-seat posting.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.decide_opportunity_application(:'job_app', 'accepted', 'مرحباً بك.');
reset role;

select public.assert(
  (select filled_count from public.opportunities where id = :'job') = 1
  and (select status from public.opportunities where id = :'job') = 'archived',
  '18.13 accepting fills the seat and closes a one-seat posting');

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.assert_rejects(
  format($$select public.apply_to_opportunity(%L, 'متأخر')$$, :'job'),
  '18.14 a closed opportunity takes no more applications',
  'not open');
reset role;

-- ---------------------------------------------------------------------------
-- A team seat is decided in the team, not in a second place
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.opportunities (kind, title_ar, posted_by, team_id, description_ar)
values ('team_seat', 'مطوّر Backend للفريق', '11111111-1111-1111-1111-111111111111', :'team',
        'ننفّذ مشروع متجر إلكتروني ونحتاج Backend.')
returning id as seat \gset
reset role;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select (public.apply_to_opportunity(:'seat', 'أستطيع تولّي الـAPI.')).id as seat_app \gset
reset role;

select public.assert(
  (select team_application_id from public.opportunity_applications where id = :'seat_app') is not null,
  '18.15 applying for a team seat opens a request in the team own queue');

-- The leader decides once, in the team, and the marketplace follows.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.decide_team_application(
  (select team_application_id from public.opportunity_applications where id = :'seat_app'),
  true
);
reset role;

select public.assert(
  (select stage from public.opportunity_applications where id = :'seat_app') = 'accepted',
  '18.16 deciding in the team updates the marketplace record — one answer, not two');

select public.assert(
  (select count(*) from public.team_members
    where team_id = :'team' and profile_id = '33333333-3333-3333-3333-333333333333') = 1,
  '18.17 and the applicant is actually on the team');

-- Withdrawing belongs to the applicant alone.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.decide_opportunity_application(%L, 'withdrawn')$$, :'seat_app'),
  '18.18 only the applicant may withdraw their own application',
  'only the applicant');
reset role;

-- ===========================================================================
-- 19. Team documents, calendar and leadership
-- ===========================================================================

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.team_documents (team_id, kind, title_ar, body_ar, author_id)
values (:'team', 'meeting_notes', 'محضر اجتماع السبرنت الأول',
        'اتفقنا على إنهاء المصادقة قبل نهاية الأسبوع.', '11111111-1111-1111-1111-111111111111')
returning id as doc \gset

select public.assert_rejects(
  format($$insert into public.team_documents (team_id, kind, title_ar, author_id)
           values (%L, 'decision', 'قرار بلا محتوى', '11111111-1111-1111-1111-111111111111')$$, :'team'),
  '19.1 a document must carry either text or a link');

select public.assert_rejects(
  format($$insert into public.team_documents (team_id, kind, title_ar, url, author_id)
           values (%L, 'design', 'تصميم', 'not-a-url', '11111111-1111-1111-1111-111111111111')$$, :'team'),
  '19.2 a document link must be a real http link');
reset role;

-- Documents are workspace-internal, like the board and the chat.
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.assert(
  (select count(*) from public.team_documents where id = :'doc') = 1,
  '19.3 an admin can read team documents');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert(
  (select count(*) from public.team_documents where id = :'doc') = 1,
  '19.4 a team member can read team documents');
reset role;

-- The member who was removed from the team earlier is outside it now.
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.assert(
  (select count(*) from public.team_documents where id = :'doc') = 0,
  '19.5 someone outside the team cannot read its documents');
reset role;

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------
-- team_calendar() filters on the CALLER's membership, and the jwt claim set
-- above outlives `reset role` — so the identity has to be put back first.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select count(*) from public.team_calendar(:'team', current_date - 30, current_date + 60)) >= 2,
  '19.6 the calendar gathers dates that already exist elsewhere');

select public.assert(
  (select count(*) from public.team_calendar(:'team', current_date - 30, current_date + 60)
    where entry_kind = 'sprint_start') = 1,
  '19.7 a sprint appears on the calendar by its start date');

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.assert(
  (select count(*) from public.team_calendar(:'team', current_date - 30, current_date + 60)) = 0,
  '19.8 a non-member sees nothing on the team calendar');
reset role;

-- ---------------------------------------------------------------------------
-- Leadership
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.transfer_team_leadership(%L, '22222222-2222-2222-2222-222222222222')$$, :'team'),
  '19.9 an ordinary member cannot take the team over',
  'only the current leader');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.transfer_team_leadership(%L, '55555555-5555-5555-5555-555555555555')$$, :'team'),
  '19.10 leadership cannot be handed to someone outside the team',
  'already be a member');

select public.transfer_team_leadership(:'team', '22222222-2222-2222-2222-222222222222');
reset role;

select public.assert(
  (select leader_id from public.teams where id = :'team') = '22222222-2222-2222-2222-222222222222',
  '19.11 handing over changes who leads the team');

select public.assert(
  (select count(*) from public.team_members where team_id = :'team' and role = 'leader') = 1,
  '19.12 a team is never left with two leaders or none');

select public.assert(
  (select role from public.team_members
    where team_id = :'team' and profile_id = '11111111-1111-1111-1111-111111111111') = 'member',
  '19.13 the previous leader stays on the team as a member');

select public.assert(
  (select count(*) from public.team_activity
    where team_id = :'team' and verb = 'leadership_transferred') = 1,
  '19.14 the handover is recorded in the team activity log');

-- Permissions are per-team, so a leader can delegate without inventing roles.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.team_permissions (team_id, members_invite, members_create_tasks)
values (:'team', true, false)
on conflict (team_id) do update
  set members_invite = excluded.members_invite,
      members_create_tasks = excluded.members_create_tasks;
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  public.team_permission(:'team', 'members_invite') = true,
  '19.15 a leader can grant members the right to invite');

select public.assert(
  public.team_permission(:'team', 'members_create_tasks') = false,
  '19.16 and can take back the right to create tasks');
reset role;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert(
  public.team_permission(:'team', 'members_create_tasks') = true,
  '19.17 the leader always keeps every permission regardless of the settings');
reset role;

-- ===========================================================================
-- 20. Onboarding: handle, taxonomies and the role lifecycle
-- ===========================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'nour@example.com', '{"full_name":"نور حرب"}'),
  ('88888888-8888-8888-8888-888888888888', 'rami@example.com', '{"full_name":"رامي قاسم"}');

-- --- the handle ------------------------------------------------------------
select public.assert_rejects($$
  update public.profiles set username = 'Nour Harb'
   where id = '77777777-7777-7777-7777-777777777777'$$,
  '20.1 a username may not contain spaces or capitals', 'profiles_username_format');

select public.assert_rejects($$
  update public.profiles set username = 'admin'
   where id = '77777777-7777-7777-7777-777777777777'$$,
  '20.2 route names are reserved and cannot be taken as usernames', 'not_reserved');

update public.profiles set username = 'nour', display_name = 'نور'
 where id = '77777777-7777-7777-7777-777777777777';

select public.assert_rejects($$
  update public.profiles set username = 'nour'
   where id = '88888888-8888-8888-8888-888888888888'$$,
  '20.3 a username is taken only once', 'username_unique');

select public.assert(
  (select techmood_id from public.profiles where username = 'nour') ~ '^TMU-',
  '20.4 the TechMood ID survives the username — it is still the real identifier');

set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.assert(
  public.is_username_available('nour') = false
  and public.is_username_available('rami') = true
  and public.is_username_available('Rami') = false
  and public.is_username_available('ad') = false,
  '20.5 availability is answered by the database, not by the form');
reset role;
reset request.jwt.claim.sub;

-- Editing your own profile must not report your own handle as taken.
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  public.is_username_available('nour') = true,
  '20.5b your own username is still available to you');
reset role;
reset request.jwt.claim.sub;

-- --- the primary role ------------------------------------------------------
select public.assert_rejects($$
  update public.profiles set primary_role = 'mentor'
   where id = '77777777-7777-7777-7777-777777777777'$$,
  '20.6 a primary role you do not hold is refused', 'الدور الأساسي');

update public.profiles set primary_role = 'student'
 where id = '77777777-7777-7777-7777-777777777777';

select public.assert(
  (select primary_role from public.profiles
    where id = '77777777-7777-7777-7777-777777777777') = 'student',
  '20.7 a role you do hold may be made primary');

-- --- fields: at most three -------------------------------------------------
insert into public.profile_fields (profile_id, field_id)
select '77777777-7777-7777-7777-777777777777', id from public.fields
 where slug in ('frontend-development', 'ux-design', 'data-analysis');

select public.assert(
  (select count(*) from public.profile_fields
    where profile_id = '77777777-7777-7777-7777-777777777777') = 3,
  '20.8 three fields are allowed');

select public.assert_rejects($$
  insert into public.profile_fields (profile_id, field_id)
  select '77777777-7777-7777-7777-777777777777', id from public.fields where slug = 'devops'$$,
  '20.9 a fourth field is refused', 'ثلاثة');

-- --- interests: no limit ---------------------------------------------------
insert into public.profile_interests (profile_id, interest_id)
select '77777777-7777-7777-7777-777777777777', id from public.interests
 where slug in ('open-source', 'hackathons', 'mentoring', 'arabic-tech',
                'accessibility-advocacy', 'podcasting', 'chess');

select public.assert(
  (select count(*) from public.profile_interests
    where profile_id = '77777777-7777-7777-7777-777777777777') = 7,
  '20.10 interests are unlimited');

select public.assert(
  (select count(*) from public.fields where status = 'approved') = 100
  and (select count(*) from public.interests where status = 'approved') = 53,
  '20.11 the platform ships with a catalogue, so onboarding is a search not a blank box');

-- Fields, interests and skills stay three separate axes. Matching reads the
-- first, recommendations the second, the portfolio the third — so choosing a
-- field must never quietly also become an interest or a claimed skill.
select public.assert(
  (select count(*) from public.profile_fields
    where profile_id = '77777777-7777-7777-7777-777777777777') = 3
  and (select count(*) from public.profile_interests
        where profile_id = '77777777-7777-7777-7777-777777777777') = 7
  and (select count(*) from public.profile_skills
        where profile_id = '77777777-7777-7777-7777-777777777777') = 0,
  '20.12 fields, interests and skills are three independent axes, never one tag bag');

-- --- suggesting a term -----------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.suggest_taxonomy_term('field', 'هندسة الكم', 'Quantum Engineering') \gset sug_
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.fields where slug = 'quantum-engineering') = 'pending_review',
  '20.13 a suggested field is filed for review, never published');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert_rejects($$
  insert into public.profile_fields (profile_id, field_id)
  select '77777777-7777-7777-7777-777777777777', id from public.fields
   where slug = 'quantum-engineering'$$,
  '20.14 an unapproved term cannot be attached to a profile', 'غير معتمد');

select public.assert(
  exists (select 1 from public.fields where slug = 'quantum-engineering'),
  '20.15 the person who suggested a term still sees it, so "under review" is honest');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.assert(
  not exists (select 1 from public.fields where slug = 'quantum-engineering'),
  '20.16 nobody else sees a term that has not been approved');

select public.assert_rejects($$select public.review_taxonomy_term('field', $$ || quote_literal(:'sug_suggest_taxonomy_term') || $$::uuid, true)$$,
  '20.17 only an admin may publish a suggested term', 'للإدارة فقط');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.review_taxonomy_term('field', :'sug_suggest_taxonomy_term', true);
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.fields where slug = 'quantum-engineering') = 'approved',
  '20.18 an admin publishes the term, and only then');

-- --- applying for a role ---------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';

select public.assert_rejects($$select public.apply_for_role('student')$$,
  '20.19 nobody applies to be a student — every account already is one', 'تلقائياً');

select public.assert_rejects($$select public.apply_for_role('admin')$$,
  '20.20 nobody applies to be an admin', 'لا يُطلب');

select public.apply_for_role('freelancer', 'أعمل على مشاريع واجهات منذ سنتين') \gset req_
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.profile_roles
    where id = :'req_apply_for_role') = 'pending_review',
  '20.21 a requested role starts pending, never active');

select public.assert(
  (select event from public.role_request_events
    where role_request_id = :'req_apply_for_role') = 'submitted',
  '20.22 the request opens an append-only trail');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  public.can_enter_role('freelancer') = false,
  '20.23 a pending role is visible but not enterable');

select public.assert_rejects($$
  insert into public.role_request_events (role_request_id, actor_id, event)
  values ($$ || quote_literal(:'req_apply_for_role') || $$::uuid,
          '77777777-7777-7777-7777-777777777777', 'approved')$$,
  '20.24 the trail is append-only to the database, not writable by the client', 'permission denied');

select public.assert_rejects($$select public.decide_role_request($$ ||
  quote_literal(:'req_apply_for_role') || $$::uuid, 'approved')$$,
  '20.25 an applicant cannot approve their own request', 'للإدارة فقط');
reset role;
reset request.jwt.claim.sub;

-- --- the third decision: request more information --------------------------
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.assert_rejects($$select public.decide_role_request($$ ||
  quote_literal(:'req_apply_for_role') || $$::uuid, 'more_info_requested')$$,
  '20.26 asking for more information without saying what is missing is refused', 'وضّح');

select public.decide_role_request(:'req_apply_for_role', 'more_info_requested',
  'أرفق رابط أعمال سابقة من فضلك');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.profile_roles where id = :'req_apply_for_role') = 'needs_more_info',
  '20.27 "request more information" is a state of its own, not a rejection');

select public.assert(
  (select count(*) from public.notifications
    where profile_id = '77777777-7777-7777-7777-777777777777' and kind = 'role_review') = 1,
  '20.28 the applicant is told, and told where to answer');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.answer_role_request(:'req_apply_for_role', 'هذا رابط أعمالي: https://example.com/work');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.profile_roles where id = :'req_apply_for_role') = 'pending_review',
  '20.29 answering puts the same request back in the queue — no second request is opened');

select public.assert(
  (select count(*) from public.profile_roles
    where profile_id = '77777777-7777-7777-7777-777777777777' and role = 'freelancer') = 1,
  '20.30 one person, one request per role');

select public.assert(
  (select count(*) from public.role_request_events
    where role_request_id = :'req_apply_for_role') = 3,
  '20.31 every step is on the record: submitted, more info asked, more info given');

-- --- approval --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.decide_role_request(:'req_apply_for_role', 'approved', 'أعمال مقنعة');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  public.can_enter_role('freelancer') = true,
  '20.32 approval is what opens the workspace, nothing else');

select public.assert_rejects($$select public.apply_for_role('freelancer')$$,
  '20.33 you cannot apply for a role you already hold', 'بالفعل');
reset role;
reset request.jwt.claim.sub;

-- --- rejection keeps the account -------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.apply_for_role('company', 'شركة تطوير في غزة') \gset rej_
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.assert_rejects($$select public.decide_role_request($$ ||
  quote_literal(:'rej_apply_for_role') || $$::uuid, 'rejected')$$,
  '20.34 a rejection without a reason is refused — the person deserves an explanation', 'سبب الرفض');

select public.decide_role_request(:'rej_apply_for_role', 'rejected', 'نحتاج سجلاً تجارياً مرفقاً');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.profile_roles
    where profile_id = '88888888-8888-8888-8888-888888888888' and role = 'student') = 'approved',
  '20.35 a rejected role never costs you the account');

set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.apply_for_role('company', 'مرفق السجل التجاري الآن');
select public.assert(
  (select status from public.profile_roles where id = :'rej_apply_for_role') = 'pending_review',
  '20.36 a rejected application may be answered and sent again');
reset role;
reset request.jwt.claim.sub;

-- --- suspension ------------------------------------------------------------
update public.profiles set primary_role = 'freelancer'
 where id = '77777777-7777-7777-7777-777777777777';

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.decide_role_request(:'req_apply_for_role', 'suspended', 'بلاغ قيد الفحص');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select primary_role from public.profiles
    where id = '77777777-7777-7777-7777-777777777777') is null,
  '20.37 losing a role also loses it as the primary one — the shell cannot open on a closed door');

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  public.can_enter_role('freelancer') = false,
  '20.38 a suspended role is shut immediately');

select public.assert_rejects($$select public.apply_for_role('freelancer')$$,
  '20.39 a suspended role is not re-opened by applying again', 'موقوف');
reset role;
reset request.jwt.claim.sub;

-- --- the mentor application ------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';

select public.assert_rejects($$select public.submit_mentor_application(
  'مطوّر واجهات', 'سيرة', array['frontend-development'], 5, 4, 'قصير', 'قصير')$$,
  '20.40 a mentor application is a form with substance, not three words', 'دافعك');

select public.submit_mentor_application(
  'مطوّر واجهات أمامية',
  'خمس سنوات في بناء واجهات إنتاجية.',
  array['frontend-development', 'ux-design'],
  5, 6,
  'أريد أن أختصر على غيري الطريق الذي مشيته وحدي في بداياتي بغزة.',
  'قدت فريق واجهات من أربعة أشخاص، وراجعت أعمال متدرّبين لعامين كاملين.',
  'https://linkedin.com/in/rami',
  'https://rami.dev',
  array['ar', 'en']) \gset mentor_
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select approved_at from public.mentor_profiles
    where profile_id = '88888888-8888-8888-8888-888888888888') is null,
  '20.41 an application is a mentor profile that is not approved yet — not a second table');

set role anon;
select public.assert(
  not exists (select 1 from public.mentor_profiles
               where profile_id = '88888888-8888-8888-8888-888888888888'),
  '20.42 an applicant is not a mentor: they never appear in the public mentor list');

select public.assert(
  exists (select 1 from public.profiles where username = 'nour'),
  '20.42b a signed-out visitor can still read a public profile');
reset role;

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.decide_role_request(:'mentor_submit_mentor_application', 'approved', 'خبرة واضحة');
reset role;
reset request.jwt.claim.sub;

set role anon;
select public.assert(
  exists (select 1 from public.mentor_profiles
           where profile_id = '88888888-8888-8888-8888-888888888888'),
  '20.43 approval is what puts a mentor in front of students');
reset role;

select public.assert(
  (select level from public.mentor_profiles
    where profile_id = '88888888-8888-8888-8888-888888888888') = 'L1',
  '20.44 a new mentor starts at L1 — the platform sets the price ladder');

set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
update public.mentor_profiles
   set level = 'L3', sessions_count = 99, approved_at = now()
 where profile_id = '88888888-8888-8888-8888-888888888888';
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select level from public.mentor_profiles
    where profile_id = '88888888-8888-8888-8888-888888888888') = 'L1'
  and (select sessions_count from public.mentor_profiles
        where profile_id = '88888888-8888-8888-8888-888888888888') = 0,
  '20.45 a mentor cannot raise their own level, standing or price');

-- --- withdrawing -----------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.apply_for_role('team_leader', 'أقود فريق تطوير') \gset wd_

select public.withdraw_role_request(:'wd_apply_for_role');

select public.assert(
  not exists (select 1 from public.profile_roles where id = :'wd_apply_for_role'),
  '20.46 a request you no longer want can be withdrawn');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.assert_rejects($$select public.withdraw_role_request($$ ||
  quote_literal(:'mentor_submit_mentor_application') || $$::uuid)$$,
  '20.47 an approved role is not something you can quietly drop', 'لا يمكن سحب دور معتمد');
reset role;
reset request.jwt.claim.sub;

-- --- signing up with Google --------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-9999-9999-999999999999', 'dana@gmail.com',
   '{"name":"Dana Salem","picture":"https://lh3.googleusercontent.com/a/dana"}');

select public.assert(
  (select full_name from public.profiles
    where id = '99999999-9999-9999-9999-999999999999') = 'Dana Salem',
  '20.48 a Google sign-up arrives with a name, so it is not asked for again');

select public.assert(
  (select avatar_url from public.profiles
    where id = '99999999-9999-9999-9999-999999999999') like 'https://lh3.%',
  '20.49 and with a picture');

select public.assert(
  (select onboarding_completed_at from public.profiles
    where id = '99999999-9999-9999-9999-999999999999') is null
  and (select status from public.profile_roles
        where profile_id = '99999999-9999-9999-9999-999999999999' and role = 'student') = 'approved',
  '20.50 Google signs you in — it does not finish your onboarding or grant a role');

-- ===========================================================================
-- 21. The student command centre
-- ===========================================================================

-- Sara finished the lessons of python-for-ai back in section 2; joining the
-- path is what makes that progress part of a journey.
insert into public.enrollments (profile_id, path_id)
select '11111111-1111-1111-1111-111111111111', id
from public.learning_paths where slug = 'genai'
on conflict do nothing;

-- --- daily activity and the streak ------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select count(*) from public.activity_days(current_date - 6, current_date)) = 7,
  '21.1 the week strip is seven days, present or absent');

select public.assert(
  (select 'lesson' = any (sources) from public.activity_days(current_date, current_date)),
  '21.2 a day you finished a lesson counts as an active day');

select public.assert(
  public.current_streak() >= 1,
  '21.3 today''s work starts a streak');

-- A pomodoro is recorded, but it is not an achievement.
insert into public.focus_sessions (profile_id, planned_minutes, subject_ar, was_completed, ended_at)
values ('11111111-1111-1111-1111-111111111111', 25, 'مراجعة الدرس', true, now());

select public.assert(
  (select count(*) from public.focus_sessions
    where profile_id = '11111111-1111-1111-1111-111111111111') = 1,
  '21.4 a focus session is stored, not thrown away when the tab closes');

select public.assert(
  not exists (select 1 from public.xp_events
               where profile_id = '11111111-1111-1111-1111-111111111111'
                 and ref_table = 'focus_sessions'),
  '21.5 sitting with a timer earns no XP');

select public.assert(
  not exists (
    select 1 from public.activity_days(current_date, current_date)
     where 'focus' = any (sources)
  ),
  '21.6 and it does not count towards the streak — the streak measures what you produced');
reset role;
reset request.jwt.claim.sub;

-- --- a pomodoro is yours alone ----------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert(
  (select count(*) from public.focus_sessions) = 0,
  '21.7 nobody else can read your focus sessions');
reset role;
reset request.jwt.claim.sub;

-- --- where was I? -----------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select path_slug from public.continue_learning()) = 'genai',
  '21.8 resume knows which path you are on');

select public.assert(
  (select course_slug from public.continue_learning()) = 'python-for-ai',
  '21.9 and which course');

select public.assert(
  (select course_percent from public.continue_learning()) = 100,
  '21.10 course progress is derived from lessons, not stored on a row that can drift');

select public.assert(
  (select path_percent from public.continue_learning()) between 0 and 100,
  '21.11 path progress is the share of its courses that are complete');

-- --- the agenda --------------------------------------------------------------
select public.assert(
  (select count(*) from public.student_agenda()) > 0,
  '21.12 the board gathers work from across the platform');

select public.assert(
  exists (select 1 from public.student_agenda() where entry_kind = 'lesson'),
  '21.13 lessons appear on it');

select public.assert(
  exists (select 1 from public.student_agenda() where entry_kind = 'work'),
  '21.14 so does your own submitted work');
reset role;
reset request.jwt.claim.sub;

-- A team task assigned to you lands in the column its board already puts it in.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.team_tasks
   set assignee_id = '22222222-2222-2222-2222-222222222222', column_key = 'doing'
 where id = :'task';

select public.assert(
  (select bucket from public.student_agenda() where entry_id = :'task') = 'in_progress',
  '21.15 a team task you are working on shows as in progress, not as a second to-do');
reset role;
reset request.jwt.claim.sub;

-- The board takes no profile argument, so there is no id to change.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert(
  not exists (select 1 from public.student_agenda() where entry_id = :'task'),
  '21.16 the agenda is the caller''s own — it cannot be pointed at someone else');
reset role;
reset request.jwt.claim.sub;

-- --- the progress picture ----------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  (select lessons_completed from public.student_progress()) = 2
  and (select paths_joined from public.student_progress()) >= 1
  and (select certificates from public.student_progress()) >= 1,
  '21.17 progress counts recorded facts, nothing invented');
reset role;
reset request.jwt.claim.sub;

-- --- one primary field --------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
update public.profile_fields set is_primary = true
 where profile_id = '77777777-7777-7777-7777-777777777777'
   and field_id = (select id from public.fields where slug = 'frontend-development');

select public.assert(
  (select count(*) from public.profile_fields
    where profile_id = '77777777-7777-7777-7777-777777777777' and is_primary) = 1,
  '21.18 one of your fields is the one you lead with');

select public.assert_rejects($$
  update public.profile_fields set is_primary = true
   where profile_id = '77777777-7777-7777-7777-777777777777'
     and field_id = (select id from public.fields where slug = 'ux-design')$$,
  '21.19 but only one', 'profile_fields_one_primary');
reset role;
reset request.jwt.claim.sub;

-- --- suggestions ---------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

insert into public.opportunities
  (kind, title_ar, organization_ar, description_ar, posted_by, compensation_kind,
   amount_min, amount_max, required_skills, seats, tags)
values
  ('freelance', 'تحسين أداء واجهة', 'شركة تقنية ناشئة',
   'قياس وتحسين زمن التحميل.', '22222222-2222-2222-2222-222222222222',
   'fixed', 150, 300, array['React'], 2, array['frontend-development'])
returning id as job2 \gset

select public.assert(
  not exists (select 1 from public.suggested_opportunities(20) where id = :'job2'),
  '21.20 you are not offered the opportunity you posted yourself');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  exists (select 1 from public.suggested_opportunities(20) where id = :'job2'),
  '21.21 an open opportunity you have not applied to is offered to you');

select public.assert(
  not exists (select 1 from public.suggested_opportunities(20) where id = :'job'),
  '21.21b but not one you already applied to');

select public.assert(
  not exists (
    select 1 from public.suggested_mentors(20)
     where profile_id = '88888888-8888-8888-8888-888888888888'
  ) or (select approved_at is not null from public.mentor_profiles
         where profile_id = '88888888-8888-8888-8888-888888888888'),
  '21.22 only approved, accepting mentors are suggested');
reset role;
reset request.jwt.claim.sub;

-- --- leaderboards ---------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select points from public.leaderboard_students_ranked(null, 50)
    where profile_id = '11111111-1111-1111-1111-111111111111')
  = (select coalesce(sum(xp), 0) from public.xp_events
      where profile_id = '11111111-1111-1111-1111-111111111111'),
  '21.23 points on the board are XP — the same number the passport shows');

select public.assert(
  (select rank from public.leaderboard_students_ranked(null, 50)
    where profile_id = '11111111-1111-1111-1111-111111111111')
  = public.my_leaderboard_rank(),
  '21.24 "your rank" agrees with the table it sits under');

select public.assert(
  (select coalesce(sum(points), 0) from public.leaderboard_students_ranked(now() + interval '1 day', 50)) = 0,
  '21.25 a time window really filters — no XP was earned tomorrow');

select public.assert(
  (select count(*) from public.leaderboard_students_ranked(null, 2)) = 2,
  '21.26 the board is paged, not dumped');

select public.assert(
  (select opportunities from public.leaderboard_companies_ranked(null, 50)
    where profile_id = '22222222-2222-2222-2222-222222222222') = 2,
  '21.27 a company is ranked on what it actually published, filled posts included');
reset role;
reset request.jwt.claim.sub;

-- ===========================================================================
-- 22. A booking is written by functions, never by its parties
-- ===========================================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert_rejects(
  format($$update public.bookings set status = 'confirmed' where id = %L$$, :'booking2'),
  '22.1 a student cannot confirm their own booking and skip the mentor',
  'permission denied');

select public.assert_rejects(
  format($$update public.bookings set status = 'completed' where id = %L$$, :'booking2'),
  '22.2 nor mark it completed, which would credit a wallet for a session that never happened',
  'permission denied');

select public.assert_rejects(
  format($$update public.bookings set price_usd = 1, mentor_share_usd = 1 where id = %L$$, :'booking2'),
  '22.3 nor rewrite the price the platform set',
  'permission denied');

select public.assert_rejects(
  format($$delete from public.bookings where id = %L$$, :'booking2'),
  '22.4 nor delete the record',
  'permission denied');

select public.assert(
  (select status from public.bookings where id = :'booking2') <> 'completed',
  '22.5 the booking is exactly where the functions left it');
reset role;
reset request.jwt.claim.sub;

-- A fresh booking walked through the real state machine, because a confirmed
-- session is the only one that can carry a link.
insert into public.bookings
  (kind, student_id, mentor_id, scheduled_start, scheduled_end,
   price_usd, platform_share_usd, mentor_share_usd, topic_ar, status)
values ('student_mentor', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        date_trunc('day', now() + interval '21 days') + interval '13 hours',
        date_trunc('day', now() + interval '21 days') + interval '14 hours',
        15, 5, 10, 'مراجعة قبل التسليم', 'draft')
returning id as booking3 \gset

update public.bookings set status = 'payment_pending' where id = :'booking3';

insert into public.payments (booking_id, method_key, amount_usd, status, reference, submitted_at)
values (:'booking3', 'jawwal_pay', 15, 'under_review', 'JP-77120', now())
returning id as payment3 \gset

update public.bookings set status = 'payment_submitted' where id = :'booking3';

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.verify_payment(:'payment3', true);
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.mentor_decide_booking(:'booking3', true);
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.set_meeting_url(%L, 'https://meet.example.com/x')$$, :'booking3'),
  '22.6 a student cannot set the meeting link',
  'يضعه المنتور');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.assert_rejects(
  format($$select public.set_meeting_url(%L, 'javascript:alert(1)')$$, :'booking3'),
  '22.7 and the link must be a real http(s) address',
  'http');

select public.set_meeting_url(:'booking3', 'https://meet.example.com/techmood-1');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select meeting_url from public.bookings where id = :'booking3') = 'https://meet.example.com/techmood-1',
  '22.8 the mentor sets it, and it is stored on the booking');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert(
  (select meeting_url from public.bookings where id = :'booking3') is not null,
  '22.9 the student in the session can read it');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  not exists (select 1 from public.bookings where id = :'booking3'),
  '22.10 and nobody else can see the booking at all, link included');
reset role;
reset request.jwt.claim.sub;

-- Cancelling goes through the function too.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.assert_rejects(
  format($$select public.cancel_booking(%L)$$, :'booking3'),
  '22.11 a stranger cannot cancel your session', 'ليس لك');
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.cancel_booking(:'booking3', 'تعارض في الموعد');
reset role;
reset request.jwt.claim.sub;

select public.assert(
  (select status from public.bookings where id = :'booking3') = 'cancelled'
  and (select cancelled_reason from public.bookings where id = :'booking3') = 'تعارض في الموعد',
  '22.12 the student can call off their own booking, with a reason');

select public.assert(
  exists (select 1 from public.notifications n
           where n.profile_id = (select mentor_id from public.bookings where id = :'booking3')
             and n.kind = 'booking' and n.title_ar = 'أُلغيت جلسة'),
  '22.13 and the mentor is told — a cancellation nobody hears about is a no-show');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.assert_rejects(
  format($$select public.cancel_booking(%L)$$, :'booking3'),
  '22.14 a cancelled booking cannot be cancelled twice', 'هذه الحالة');
reset role;
reset request.jwt.claim.sub;

-- ===========================================================================
-- 23. The academy as a discovery surface
-- ===========================================================================

-- Levels come from the catalogue's own shape, not from a guess.
select public.assert(
  (select level from public.courses where slug = 'python-for-ai') = 'beginner'
  and (select level from public.courses where slug = 'ml-foundations') = 'intermediate'
  and (select level from public.courses where slug = 'generative-ai') = 'advanced',
  '23.1 a course level is its position in its path — first, second, third');

select public.assert(
  (select count(distinct level) from public.courses) = 3,
  '23.2 all three levels are actually in use, not one default everywhere');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.assert(
  (select count(*) from public.academy_paths()) = 6,
  '23.3 every published path comes back as one row');

select public.assert(
  (select level_from || '→' || level_to from public.academy_paths() where slug = 'genai')
    = 'beginner→advanced',
  '23.4 a path reports the range it covers, not a single level it would be wrong about');

-- Sara finished python-for-ai in section 2 and joined genai in section 21.
select public.assert(
  (select courses_done from public.academy_paths() where slug = 'genai') >= 1
  and (select percent from public.academy_paths() where slug = 'genai') > 0,
  '23.5 path progress counts the courses the database calls complete');

select public.assert(
  (select status from public.academy_paths() where slug = 'genai') = 'in_progress',
  '23.6 a path with work started but not finished reads as in progress');

select public.assert(
  (select is_enrolled from public.academy_paths() where slug = 'genai') = true
  and (select is_enrolled from public.academy_paths() where slug = 'cloud') = false,
  '23.7 enrolment is per path and per person');

select public.assert(
  (select status from public.academy_paths() where slug = 'cloud') = 'not_started',
  '23.8 a path you never touched reads as not started, whatever its percentage');

select public.assert(
  (select last_activity from public.academy_paths() where slug = 'genai') is not null,
  '23.9 last activity is derived from the progress rows, not stored twice');

-- Courses
select public.assert(
  (select count(*) from public.academy_courses()) = 18,
  '23.10 every published course comes back as one row');

select public.assert(
  (select status from public.academy_courses() where slug = 'python-for-ai') = 'completed',
  '23.11 course status uses is_course_complete(), the same rule the certificate uses');

select public.assert(
  (select status from public.academy_courses() where slug = 'react') = 'not_started',
  '23.12 an untouched course reads as not started');

select public.assert(
  (select lessons_count from public.academy_courses() where slug = 'python-for-ai') = 2
  and (select modules_count from public.academy_courses() where slug = 'python-for-ai') = 1,
  '23.13 a card knows how much is in the course without a second round trip');

select public.assert(
  (select xp_award from public.academy_courses() where slug = 'react') = 25,
  '23.14 the XP shown on a card is the rule the database will actually award');

select public.assert(
  (select path_slugs from public.academy_courses() where slug = 'python-for-ai') = array['genai'],
  '23.15 a course has no school of its own — its domain is the path carrying it');

select public.assert(
  (select school_slugs from public.academy_courses() where slug = 'python-for-ai') = array['ai-data'],
  '23.16 and that path''s school is what a domain filter can match on');

select public.assert(
  (select in_enrolled_path from public.academy_courses() where slug = 'python-for-ai') = true
  and (select in_enrolled_path from public.academy_courses() where slug = 'containers') = false,
  '23.17 a course counts as yours when you joined a path that carries it');
reset role;
reset request.jwt.claim.sub;

-- The two functions take no profile argument, so one person's academy cannot
-- be rendered as another's.
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select public.assert(
  (select percent from public.academy_paths() where slug = 'genai') = 0
  and (select status from public.academy_courses() where slug = 'python-for-ai') = 'not_started',
  '23.18 another learner sees their own standing, not the first one''s');
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '================================================'
\echo ' all business rule tests passed'
\echo '================================================'
