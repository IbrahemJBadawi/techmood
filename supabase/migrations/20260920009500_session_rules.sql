-- =============================================================================
-- 0095 — What a mentor sees and when, a week to evaluate, and an evaluation
--        that is owed when a review was asked for
--
-- The founder's session rules:
--
--   1. The mentor sees a request — and who is asking — only once it has been
--      paid for and reached them. A cart the learner has not paid is nobody's
--      business but the learner's. (0011/0062 let the mentor read their
--      bookings at every stage.)
--   2. Both sides evaluate within a week of the session's end; after that the
--      window is closed. (0045 unsealed feedback after a week but still
--      accepted it for ever.)
--   3. When the learner asked the mentor to review something (booking review
--      items), the mentor's written evaluation is owed: the mentor's share of
--      that session is held — visible in their wallet as pending — until they
--      write it. If the week passes without it, the share is released (the
--      session did happen), the booking is marked, and the admins are told.
--   4. A learner earns a little XP the moment a booking is confirmed (3 XP);
--      attending still earns its 5. A confirmed booking that is then cancelled
--      or refunded takes its 3 back.
--
-- Mentors can already read learners' submitted work (0011: the review queue),
-- so "after accepting, the mentor sees the learner's work" needs nothing new;
-- the booking's review items point at it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The mentor sees a booking once it has reached them
-- ---------------------------------------------------------------------------
-- A booking reached its mentor when it entered mentor_pending (0077 stamps
-- mentor_respond_by then) — whatever happened to it after.
create or replace function public.booking_reached_mentor(
  p_status     public.booking_status,
  p_respond_by timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_respond_by is not null
      or p_status in ('mentor_pending', 'confirmed', 'completed');
$$;

grant execute on function public.booking_reached_mentor(public.booking_status, timestamptz) to authenticated;

drop policy bookings_read on public.bookings;

create policy bookings_read on public.bookings
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (mentor_id = (select auth.uid()) and public.booking_reached_mentor(status, mentor_respond_by))
    or public.is_admin()
    or (team_id is not null and public.is_team_member(team_id))
    or (startup_id is not null and public.can_view_startup_workspace(startup_id))
  );

-- (booking_review_items and booking_events read bookings under the caller's
-- policy, so they follow this rule without being touched.)

-- Calling off: a mentor can only call off what reached them, and only hears
-- about a cancellation of something that did.
create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  rec       record;
  v_reached boolean;
begin
  select * into rec from public.bookings where id = p_booking;
  if rec is null then
    raise exception 'الحجز غير موجود';
  end if;

  v_reached := public.booking_reached_mentor(rec.status, rec.mentor_respond_by);

  if not (
    rec.student_id = v_me
    or (rec.mentor_id = v_me and v_reached)
    or (rec.team_id is not null and public.is_team_leader(rec.team_id))
    or public.is_admin()
  ) then
    raise exception 'هذا الحجز ليس لك';
  end if;

  if rec.status in ('completed', 'cancelled', 'refunded', 'expired') then
    raise exception 'لا يمكن إلغاء حجز في هذه الحالة';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_reason = coalesce(nullif(btrim(p_reason), ''),
                                     case when rec.student_id = v_me then 'ألغاه الطالب'
                                          when rec.mentor_id = v_me then 'ألغاها المنتور'
                                          else 'أُلغي' end)
   where id = p_booking;

  if rec.mentor_id is not null and rec.mentor_id <> v_me and v_reached then
    perform public.notify(rec.mentor_id, 'booking', 'أُلغيت جلسة',
                          rec.booking_code, '/mentor-requests');
  end if;
  if rec.student_id is not null and rec.student_id <> v_me then
    perform public.notify(rec.student_id, 'booking', 'أُلغيت جلستك',
                          rec.booking_code, '/bookings/' || p_booking::text);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 & 3. A week to evaluate; an evaluation owed when a review was asked for
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column evaluation_missed boolean not null default false;

comment on column public.bookings.evaluation_missed is
  'The learner asked for a review and the mentor did not write the evaluation within the week (0095).';

-- A review was asked for: the learner named something for the mentor to look at.
create or replace function public.booking_requires_evaluation(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
     where b.id = p_booking
       and b.student_id is not null
       and exists (select 1 from public.booking_review_items i where i.booking_id = b.id)
  );
$$;

grant execute on function public.booking_requires_evaluation(uuid) to authenticated;

-- The mentor's share is held while an owed evaluation is unwritten. This is
-- 0075's ledger with one change at "completed": a share that would become
-- spendable stays pending when an evaluation is owed.
create or replace function public.on_booking_completed_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'confirmed' and not exists (
    select 1 from public.wallet_entries w
     where w.ref_table = 'bookings' and w.ref_id = new.id and w.kind = 'earning'
  ) then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (new.mentor_id, 'earning', new.mentor_share_usd, 'pending',
            'أرباح جلسة إرشاد ' || new.booking_code || ' — بعد انعقادها', 'bookings', new.id);
  end if;

  if new.status = 'completed' then
    v_owed := public.booking_requires_evaluation(new.id)
              and not exists (select 1 from public.session_feedback sf
                               where sf.booking_id = new.id and sf.from_profile = new.mentor_id);

    update public.wallet_entries
       set status = case when v_owed then 'pending' else 'available' end::public.ledger_status,
           description_ar = 'أرباح جلسة إرشاد ' || new.booking_code
                            || case when v_owed then ' — بانتظار تقييمك المطلوب' else '' end
     where ref_table = 'bookings' and ref_id = new.id and kind = 'earning' and status = 'pending';

    if not found and not exists (
      select 1 from public.wallet_entries w
       where w.ref_table = 'bookings' and w.ref_id = new.id and w.kind = 'earning'
    ) then
      insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
      values (new.mentor_id, 'earning', new.mentor_share_usd,
              case when v_owed then 'pending' else 'available' end::public.ledger_status,
              'أرباح جلسة إرشاد ' || new.booking_code
              || case when v_owed then ' — بانتظار تقييمك المطلوب' else '' end,
              'bookings', new.id);
    end if;
  end if;

  if new.status in ('cancelled', 'rejected', 'refunded', 'expired') then
    update public.wallet_entries
       set status = 'cancelled'
     where ref_table = 'bookings' and ref_id = new.id and kind = 'earning' and status = 'pending';
  end if;

  return new;
end;
$$;

create or replace function public.rate_session(
  p_booking uuid,
  p_scores  jsonb,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_to      uuid;
  v_id      uuid;
  v_key     text;
  v_avg     numeric;
  v_count   integer := 0;
  v_sum     integer := 0;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_booking from public.bookings where id = p_booking;
  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'التقييم بعد اكتمال الجلسة فقط';
  end if;

  if v_booking.scheduled_end < now() - interval '7 days' then
    raise exception 'انتهت مهلة التقييم: أسبوع من نهاية الجلسة';
  end if;

  if v_me = v_booking.mentor_id then
    v_to := v_booking.student_id;
  elsif v_me = v_booking.student_id then
    v_to := v_booking.mentor_id;
  elsif v_booking.team_id is not null and public.is_team_member(v_booking.team_id) then
    v_to := v_booking.mentor_id;
  else
    raise exception 'طرفا الجلسة فقط من يقيّمانها';
  end if;

  if v_to is null or v_to = v_me then
    raise exception 'لا يمكن تقييم نفسك';
  end if;

  -- The evaluation a learner asked for is words about their work, not only stars.
  if v_me = v_booking.mentor_id and public.booking_requires_evaluation(p_booking)
     and char_length(coalesce(btrim(p_comment), '')) < 30 then
    raise exception 'طلب الطالب مراجعة: اكتب تقييماً مكتوباً لعمله (30 حرفاً على الأقل)';
  end if;

  if exists (
    select 1 from public.session_feedback sf
     where sf.booking_id = p_booking and sf.from_profile = v_me
  ) then
    raise exception 'قيّمت هذه الجلسة بالفعل';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.session_criterion)) c) then
      v_count := v_count + 1;
      v_sum := v_sum + least(5, greatest(1, (p_scores ->> v_key)::int));
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'التقييم يحتاج درجة واحدة على الأقل';
  end if;

  v_avg := round((v_sum::numeric / v_count), 0);

  insert into public.session_feedback (booking_id, from_profile, to_profile, stars, comment_ar)
  values (p_booking, v_me, v_to, v_avg::smallint, p_comment)
  returning id into v_id;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.session_criterion)) c) then
      insert into public.session_feedback_scores (feedback_id, criterion, stars)
      values (v_id, v_key::public.session_criterion,
              least(5, greatest(1, (p_scores ->> v_key)::int)));
    end if;
  end loop;

  -- The owed evaluation is written: the mentor's share is theirs to use.
  if v_me = v_booking.mentor_id then
    update public.wallet_entries
       set status = 'available',
           description_ar = 'أرباح جلسة إرشاد ' || v_booking.booking_code
     where ref_table = 'bookings' and ref_id = p_booking
       and kind = 'earning' and status = 'pending';
  end if;

  if public.session_feedback_is_open(p_booking) then
    update public.session_feedback set revealed_at = now()
     where booking_id = p_booking and revealed_at is null;
  end if;

  return v_id;
end;
$$;

grant execute on function public.rate_session(uuid, jsonb, text) to authenticated;

-- What a mentor still owes: completed sessions with a review asked for, no
-- evaluation from them yet, and the week still open.
create or replace function public.my_owed_evaluations()
returns table (
  booking_id   uuid,
  booking_code text,
  student_name text,
  ended_at     timestamptz,
  due_at       timestamptz,
  items        integer,
  held_usd     numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.booking_code, p.full_name, b.scheduled_end, b.scheduled_end + interval '7 days',
         (select count(*)::int from public.booking_review_items i where i.booking_id = b.id),
         b.mentor_share_usd
    from public.bookings b
    join public.profiles p on p.id = b.student_id
   where b.mentor_id = (select auth.uid())
     and b.status = 'completed'
     and b.scheduled_end >= now() - interval '7 days'
     and public.booking_requires_evaluation(b.id)
     and not exists (select 1 from public.session_feedback sf
                      where sf.booking_id = b.id and sf.from_profile = b.mentor_id)
   order by b.scheduled_end;
$$;

revoke execute on function public.my_owed_evaluations() from public, anon;
grant execute on function public.my_owed_evaluations() to authenticated;

-- Run on a schedule. Idempotent: a week after the session, an owed evaluation
-- that was never written releases the held share, marks the booking, and tells
-- the admins — once.
create or replace function public.session_evaluation_housekeeping()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    update public.bookings b
       set evaluation_missed = true
     where b.status = 'completed'
       and not b.evaluation_missed
       and b.scheduled_end < now() - interval '7 days'
       and public.booking_requires_evaluation(b.id)
       and not exists (select 1 from public.session_feedback sf
                        where sf.booking_id = b.id and sf.from_profile = b.mentor_id)
    returning b.id, b.booking_code, b.mentor_id
  loop
    v_count := v_count + 1;

    update public.wallet_entries
       set status = 'available',
           description_ar = 'أرباح جلسة إرشاد ' || v_row.booking_code || ' — دون التقييم المطلوب'
     where ref_table = 'bookings' and ref_id = v_row.id
       and kind = 'earning' and status = 'pending';

    perform public.notify(v_row.mentor_id, 'booking', 'فاتك تقييم مطلوب',
      'انتهى أسبوع التقييم للجلسة ' || v_row.booking_code || ' دون تقييم طلبه الطالب. سُجّل ذلك في أدائك.',
      '/mentor-requests');
    perform public.notify_admins('تقييم مطلوب لم يُكتب',
      'المنتور لم يقيّم الجلسة ' || v_row.booking_code || ' رغم طلب الطالب مراجعة.',
      '/admin/users/' || v_row.mentor_id::text, 'booking', v_row.id);
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.session_evaluation_housekeeping() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-session-evaluations', '17 * * * *',
                          $$select public.session_evaluation_housekeeping()$$);
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 4. XP for a confirmed booking
-- ---------------------------------------------------------------------------
insert into public.xp_rules (source, base_xp, per_star_xp, description_ar)
values ('mentor_session_booked', 3, 0, 'تأكيد حجز جلسة إرشاد')
on conflict (source) do update set base_xp = excluded.base_xp, description_ar = excluded.description_ar;

create or replace function public.on_booking_confirmed_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is null then
    return new;
  end if;

  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.award_xp(new.student_id, 'mentor_session_booked', 'bookings', new.id, null);
  elsif new.status in ('cancelled', 'refunded') and old.status = 'confirmed' then
    delete from public.xp_events
     where profile_id = new.student_id and source = 'mentor_session_booked'
       and ref_table = 'bookings' and ref_id = new.id;
  end if;

  return new;
end;
$$;

create trigger bookings_confirmed_xp
  after update of status on public.bookings
  for each row execute function public.on_booking_confirmed_xp();
