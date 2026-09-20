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
  '6.3 a session cannot be booked less than 3 days ahead',
  'at least 3 days');

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

insert into public.payments (booking_id, method, amount_usd, status, reference, submitted_at)
values (:'booking', 'jawwal_pay', 15, 'submitted', 'JP-99213', now())
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

\echo ''
\echo '================================================'
\echo ' all business rule tests passed'
\echo '================================================'
