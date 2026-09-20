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

\echo ''
\echo '================================================'
\echo ' all business rule tests passed'
\echo '================================================'
