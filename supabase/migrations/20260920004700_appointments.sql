-- =============================================================================
-- 0047 — The appointments hub: one place where time is decided
--
-- Bookings, sessions, availability and the calendar were each built where they
-- were needed: the mentor's availability in 0006, the booking journey in 0016,
-- the team's calendar in 0026, the call in 0044. Nothing gathered them, and two
-- rules the product states were nowhere in the database at all:
--
--   * a mentor's day has a limit — five sessions — and a gap between sessions;
--   * a confirmed booking has to become a completed one, or the rating that
--     follows a session can never be written. Until now no client-callable path
--     moved a booking to 'completed' at all: the write guard of 0031 closed the
--     table, and nothing replaced it. A session that was actually held is what
--     completes it, and 0044 already knows who turned up.
--
-- So this migration adds the two rules, closes that gap, and gives the hub its
-- three reads: one calendar, one list of what is waiting for the person, and
-- one set of numbers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A mentor's day has a shape
-- ---------------------------------------------------------------------------
alter table public.mentor_profiles
  add column daily_session_limit integer not null default 5
    check (daily_session_limit between 1 and 10),
  add column buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 60);

comment on column public.mentor_profiles.daily_session_limit is
  'How many sessions this mentor will hold in one day. The product rule is five; a mentor may ask for fewer.';
comment on column public.mentor_profiles.buffer_minutes is
  'The gap the mentor keeps between two sessions. A slot that would land inside it is not offered and cannot be booked.';

-- The states in which a booking really holds a mentor's hour.
create or replace function public.booking_holds_time(p_status public.booking_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('payment_verified', 'mentor_pending', 'confirmed', 'completed');
$$;

grant execute on function public.booking_holds_time(public.booking_status) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- The booking rules, with the day's limit and the gap between sessions
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dow        smallint;
  v_start_time time;
  v_end_time   time;
  v_notice     integer;
  v_limit      integer;
  v_buffer     integer;
  v_today      integer;
begin
  if tg_op = 'INSERT' or new.scheduled_start is distinct from old.scheduled_start then
    v_notice := coalesce(public.setting_int('booking_min_notice_hours'), 72);
    if new.scheduled_start < now() + (v_notice || ' hours')::interval then
      raise exception 'a session must be booked at least % hours in advance', v_notice;
    end if;
  end if;

  v_dow        := extract(dow from new.scheduled_start)::smallint;
  v_start_time := new.scheduled_start::time;
  v_end_time   := new.scheduled_end::time;

  -- a date the mentor closed is closed, whatever the weekly rule says
  if exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and not ex.is_open
  ) then
    raise exception 'the mentor is not available on that date';
  end if;

  if not exists (
    select 1 from public.mentor_availability ma
    where ma.mentor_id = new.mentor_id
      and ma.day_of_week = v_dow
      and ma.start_time <= v_start_time
      and ma.end_time   >= v_end_time
  ) and not exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and ex.is_open
      and ex.start_time <= v_start_time
      and ex.end_time   >= v_end_time
  ) then
    raise exception 'the requested slot is outside the mentor published availability';
  end if;

  if exists (
    select 1 from public.mentor_time_off t
    where t.mentor_id = new.mentor_id
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
  ) then
    raise exception 'the mentor is unavailable during the requested slot';
  end if;

  select mp.daily_session_limit, mp.buffer_minutes
    into v_limit, v_buffer
    from public.mentor_profiles mp where mp.profile_id = new.mentor_id;

  -- The day's limit. An hour is taken when a booking holds it or a student is
  -- paying for it right now, and given back the moment either ends — which is
  -- the same answer the calendar gives, because both ask this question.
  if new.status not in ('cancelled', 'rejected', 'refunded', 'expired') then
    select count(*)::int into v_today
      from public.bookings b
     where b.mentor_id = new.mentor_id
       and b.id <> new.id
       and b.scheduled_start::date = new.scheduled_start::date
       and (
         public.booking_holds_time(b.status)
         or (b.status in ('payment_pending', 'payment_submitted')
             and coalesce(b.reserved_until, b.scheduled_start) > now())
       );

    if v_today >= coalesce(v_limit, 5) then
      raise exception 'بلغ المنتور حدّه اليومي من الجلسات';
    end if;

    -- The gap between two sessions. The overlap itself is already impossible —
    -- an exclusion constraint sees to that — so this is only about the minutes
    -- on either side of it.
    if coalesce(v_buffer, 0) > 0 and exists (
      select 1 from public.bookings b
       where b.mentor_id = new.mentor_id
         and b.id <> new.id
         and (
           public.booking_holds_time(b.status)
           or (b.status in ('payment_pending', 'payment_submitted')
               and coalesce(b.reserved_until, b.scheduled_start) > now())
         )
         and tstzrange(b.scheduled_start - (v_buffer || ' minutes')::interval,
                       b.scheduled_end   + (v_buffer || ' minutes')::interval, '[)')
             && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
    ) then
      raise exception 'يحتاج المنتور فاصلاً بين الجلسات';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- …and the same two rules, seen from the student's calendar
-- ---------------------------------------------------------------------------
-- An hour a mentor would refuse must not be offered in the first place: the
-- rule and the calendar have to be the same answer, or the person meets it as
-- an error after choosing.
create or replace function public.mentor_available_slots(
  p_mentor uuid,
  p_from   date,
  p_to     date
)
returns table (slot_start timestamptz, slot_end timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select coalesce(mp.daily_session_limit, 5) as day_limit,
           coalesce(mp.buffer_minutes, 0)      as buffer_minutes
      from public.mentor_profiles mp where mp.profile_id = p_mentor
  ),
  days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  windows as (
    select dy.day, ma.start_time, ma.end_time
    from days dy
    join public.mentor_availability ma
      on ma.mentor_id = p_mentor
     and ma.day_of_week = extract(dow from dy.day)::smallint
    where not exists (
      select 1 from public.mentor_availability_exceptions ex
      where ex.mentor_id = p_mentor and ex.on_date = dy.day and not ex.is_open
    )
    union all
    select ex.on_date, ex.start_time, ex.end_time
    from public.mentor_availability_exceptions ex
    where ex.mentor_id = p_mentor
      and ex.is_open
      and ex.on_date between p_from and p_to
  ),
  slots as (
    select (w.day + w.start_time + (n || ' hours')::interval)::timestamptz       as slot_start,
           (w.day + w.start_time + ((n + 1) || ' hours')::interval)::timestamptz as slot_end
    from windows w
    cross join lateral generate_series(
      0,
      (extract(epoch from (w.end_time - w.start_time)) / 3600)::int - 1
    ) n
  ),
  -- how full each day already is
  load as (
    select b.scheduled_start::date as day, count(*)::int as taken
      from public.bookings b
     where b.mentor_id = p_mentor
       and (
         public.booking_holds_time(b.status)
         or (b.status in ('payment_pending', 'payment_submitted')
             and coalesce(b.reserved_until, b.scheduled_start) > now())
       )
       and b.scheduled_start::date between p_from and p_to
     group by 1
  )
  select sl.slot_start,
         sl.slot_end,
         case
           when exists (
             select 1 from public.mentor_time_off t
             where t.mentor_id = p_mentor
               and tstzrange(t.starts_at, t.ends_at, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'unavailable'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and public.booking_holds_time(b.status)
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'booked'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and b.status in ('payment_pending', 'payment_submitted')
               and coalesce(b.reserved_until, b.scheduled_start) > now()
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'pending'
           -- the mentor's own gap between sessions
           when (select buffer_minutes from settings) > 0 and exists (
             select 1 from public.bookings b, settings s
             where b.mentor_id = p_mentor
               and (
                 public.booking_holds_time(b.status)
                 or (b.status in ('payment_pending', 'payment_submitted')
                     and coalesce(b.reserved_until, b.scheduled_start) > now())
               )
               and tstzrange(b.scheduled_start - (s.buffer_minutes || ' minutes')::interval,
                             b.scheduled_end   + (s.buffer_minutes || ' minutes')::interval, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'unavailable'
           -- the day is full
           when coalesce((select taken from load where load.day = sl.slot_start::date), 0)
                >= (select day_limit from settings) then 'unavailable'
           when sl.slot_start
                < now() + (public.setting_int('booking_min_notice_hours') || ' hours')::interval
             then 'unavailable'
           else 'available'
         end as state
  from slots sl
  order by sl.slot_start;
$$;

-- How full a mentor's day is, for the mentor's own screen.
create or replace function public.mentor_day_load(p_date date default current_date)
returns table (booked integer, day_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
           select count(*)::int from public.bookings b
            where b.mentor_id = (select auth.uid())
              and b.scheduled_start::date = p_date
              and public.booking_holds_time(b.status)
         ), 0),
         coalesce((
           select mp.daily_session_limit from public.mentor_profiles mp
            where mp.profile_id = (select auth.uid())
         ), 5);
$$;

grant execute on function public.mentor_day_load(date) to authenticated;

-- ---------------------------------------------------------------------------
-- A session that was held is what completes its booking
-- ---------------------------------------------------------------------------
-- Nothing a client can call moves a booking to 'completed' — by design, since
-- completing one credits the mentor's wallet and awards XP. What may do it is
-- the fact that the session happened, and 0044 records exactly that. Two people
-- in the room is the test: a mentor sitting alone in an empty room did not hold
-- a session, and that case is left for a human to settle rather than paid out.
create or replace function public.close_due_video_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed integer;
begin
  with closed as (
    update public.video_sessions s
       set status = case
             when not exists (
               select 1 from public.video_presence_events e where e.session_id = s.id
             ) then 'no_show'::public.video_session_status
             else 'completed'::public.video_session_status
           end,
           ended_at = now()
     where s.status in ('scheduled', 'live')
       and s.end_at <= now()
    returning s.id
  )
  select count(*)::int into v_closed from closed;

  -- A booking whose session both sides attended is a session that happened.
  update public.bookings b
     set status = 'completed'
    from public.video_sessions s
   where s.booking_id = b.id
     and s.status = 'completed'
     and b.status = 'confirmed'
     and (
       select count(distinct e.profile_id)
         from public.video_presence_events e where e.session_id = s.id
     ) >= 2;

  return v_closed;
end;
$$;

revoke execute on function public.close_due_video_sessions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- One calendar
-- ---------------------------------------------------------------------------
-- Everything on it already exists somewhere else; this gathers it for the
-- person asking, and for nobody else — a team-mate's own mentor session is not
-- on their team-mates' calendars.
create or replace function public.my_calendar(p_from date, p_to date)
returns table (
  entry_kind text,
  entry_id   uuid,
  title_ar   text,
  detail_ar  text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  on_date    date,
  state      text,
  tone       text,
  link       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (select team_id from public.team_members tm, me
            where tm.profile_id = me.id and tm.is_active)

  -- mentor sessions: mine as a student, mine as the mentor, my team's
  select case when b.kind = 'team_mentor' then 'team_session' else 'mentor_session' end,
         b.id,
         coalesce(b.topic_ar, 'جلسة إرشاد'),
         to_char(b.scheduled_start, 'HH24:MI'),
         b.scheduled_start,
         b.scheduled_end,
         b.scheduled_start::date,
         b.status::text,
         case
           when b.status in ('cancelled', 'rejected', 'refunded', 'expired') then 'cancelled'
           when b.status = 'completed' then 'done'
           when b.status = 'confirmed' then (case when b.kind = 'team_mentor' then 'team' else 'mentor' end)
           else 'pending'
         end,
         '/bookings/' || b.id::text
    from public.bookings b, me
   where b.scheduled_start::date between p_from and p_to
     and (
       b.student_id = me.id
       or b.mentor_id = me.id
       or (b.team_id is not null and b.team_id in (select team_id from mine))
     )

  union all

  -- a team's own hours, for the members who are in them
  select 'team_meeting',
         s.id,
         'اجتماع فريق',
         to_char(s.start_at, 'HH24:MI'),
         s.start_at,
         s.end_at,
         s.start_at::date,
         s.status::text,
         case when s.status in ('cancelled', 'no_show') then 'cancelled'
              when s.status = 'completed' then 'done'
              else 'internal' end,
         '/sessions/' || s.id::text
    from public.video_sessions s
    join public.video_session_participants vp on vp.session_id = s.id
    cross join me
   where s.session_type = 'team_internal'
     and vp.profile_id = me.id
     and s.start_at::date between p_from and p_to

  union all

  -- what is due from me on a team board
  select 'task',
         t.id,
         t.title_ar,
         tm.title_ar,
         null::timestamptz,
         null::timestamptz,
         t.due_on,
         t.column_key::text,
         case when t.column_key = 'done' then 'done'
              when t.due_on < current_date then 'late'
              else 'task' end,
         '/teams/' || tm.id::text || '/tasks/' || t.id::text
    from public.team_tasks t
    join public.teams tm on tm.id = t.team_id
    cross join me
   where t.assignee_id = me.id
     and t.due_on between p_from and p_to

  union all

  -- the dates my teams work to
  select 'milestone',
         m.id,
         m.title_ar,
         p.title_ar,
         null::timestamptz,
         null::timestamptz,
         m.due_on,
         case when m.is_done then 'done' else 'open' end,
         case when m.is_done then 'done' else 'milestone' end,
         '/teams/' || p.team_id::text || '/projects'
    from public.project_milestones m
    join public.projects p on p.id = m.project_id
   where p.team_id in (select team_id from mine)
     and m.due_on between p_from and p_to

  union all

  select 'sprint',
         sp.id,
         'نهاية السبرنت ' || sp.number,
         sp.goal_ar,
         null::timestamptz,
         null::timestamptz,
         sp.ends_on,
         'sprint',
         'sprint',
         '/teams/' || sp.team_id::text || '/sprints'
    from public.sprints sp
   where sp.team_id in (select team_id from mine)
     and sp.ends_on between p_from and p_to

  order by 7, 5 nulls last;
$$;

comment on function public.my_calendar is
  'One feed of everything with a date on it that belongs to the caller. It gathers; it owns nothing.';

grant execute on function public.my_calendar(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- What is waiting for this person
-- ---------------------------------------------------------------------------
-- The point of this list is that nothing important goes quiet. Each row is
-- something only this person can move forward, with the number of times it is
-- waiting and where to go.
create or replace function public.needs_action()
returns table (action_key text, label_ar text, count integer, link text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)

  -- a student's own money and ratings
  select 'pay', 'حجوزات بانتظار إتمام الدفع',
         count(*)::int, '/bookings?filter=needs_action'
    from public.bookings b, me
   where b.student_id = me.id and b.status = 'payment_pending'
  having count(*) > 0

  union all

  select 'rate', 'جلسات انتهت بانتظار تقييمك',
         count(*)::int, '/bookings?tab=history'
    from public.bookings b, me
   where b.status = 'completed'
     and (b.student_id = me.id or b.mentor_id = me.id)
     and not exists (
       select 1 from public.session_feedback sf
        where sf.booking_id = b.id and sf.from_profile = me.id
     )
  having count(*) > 0

  union all

  -- a mentor's decisions
  select 'decide', 'طلبات حجز بانتظار قرارك',
         count(*)::int, '/mentor-requests'
    from public.bookings b, me
   where b.mentor_id = me.id and b.status = 'mentor_pending'
  having count(*) > 0

  union all

  select 'review', 'تسليمات بانتظار مراجعتك',
         count(*)::int, '/review'
    from public.submissions s, me
   where s.status in ('submitted', 'under_review')
     and public.is_mentor()
  having count(*) > 0

  union all

  -- what only an admin can settle
  select 'verify_payment', 'مدفوعات بانتظار التحقق',
         count(*)::int, '/admin/payments'
    from public.payments p
   where p.status = 'under_review' and public.is_admin()
  having count(*) > 0

  union all

  select 'payout', 'طلبات سحب بانتظار التحويل',
         count(*)::int, '/admin/payouts'
    from public.payout_requests pr
   where pr.status in ('requested', 'approved') and public.is_admin()
  having count(*) > 0

  union all

  -- a booked hour whose room stayed empty: nobody was paid, nobody was refunded
  select 'empty_session', 'جلسات لم تُعقد بانتظار قرار',
         count(*)::int, '/admin/payments'
    from public.video_sessions s
    join public.bookings b on b.id = s.booking_id
   where s.status = 'no_show' and b.status = 'confirmed' and public.is_admin()
  having count(*) > 0;
$$;

comment on function public.needs_action is
  'Everything waiting on this person, and only this person. Each row is something they can move.';

grant execute on function public.needs_action() to authenticated;

-- ---------------------------------------------------------------------------
-- The numbers at the top of the hub
-- ---------------------------------------------------------------------------
create or replace function public.booking_stats()
returns table (
  upcoming        integer,
  pending         integer,
  completed       integer,
  this_month      integer,
  hours           integer,
  today_as_mentor integer,
  mentor_upcoming integer,
  mentor_pending  integer,
  mentor_done     integer,
  mentor_earnings numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select
    (select count(*)::int from public.bookings b, me
      where b.student_id = me.id and b.status = 'confirmed' and b.scheduled_start >= now()),
    (select count(*)::int from public.bookings b, me
      where b.student_id = me.id
        and b.status in ('payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending')),
    (select count(*)::int from public.bookings b, me
      where b.student_id = me.id and b.status = 'completed'),
    (select count(*)::int from public.bookings b, me
      where b.student_id = me.id
        and b.scheduled_start >= date_trunc('month', now())
        and b.scheduled_start < date_trunc('month', now()) + interval '1 month'
        and b.status in ('confirmed', 'completed')),
    (select coalesce(sum(extract(epoch from (b.scheduled_end - b.scheduled_start)) / 3600), 0)::int
       from public.bookings b, me
      where b.student_id = me.id and b.status = 'completed'),
    (select count(*)::int from public.bookings b, me
      where b.mentor_id = me.id and b.scheduled_start::date = current_date
        and public.booking_holds_time(b.status)),
    (select count(*)::int from public.bookings b, me
      where b.mentor_id = me.id and b.status = 'confirmed' and b.scheduled_start >= now()),
    (select count(*)::int from public.bookings b, me
      where b.mentor_id = me.id and b.status = 'mentor_pending'),
    (select count(*)::int from public.bookings b, me
      where b.mentor_id = me.id and b.status = 'completed'),
    (select coalesce(sum(b.mentor_share_usd), 0) from public.bookings b, me
      where b.mentor_id = me.id and b.status = 'completed');
$$;

grant execute on function public.booking_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- The reminders, on the hours the booking document names
-- ---------------------------------------------------------------------------
-- 0046 sent the third reminder when the door opened, five minutes before. The
-- booking document asks for ten — early enough to walk back to a desk. The door
-- still opens at five; the reminder simply arrives before it.
create or replace function public.notify_due_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_total integer := 0;
begin
  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() + interval '23 hours' and now() + interval '25 hours'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'day', 'جلستك غداً',
      'تبدأ جلستك بعد نحو أربع وعشرين ساعة.');
  end loop;

  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() and now() + interval '1 hour'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'hour', 'جلستك بعد ساعة',
      'جهّز ما تحتاجه — تستطيع فحص الكاميرا والميكروفون حين يفتح الباب.');
  end loop;

  for v_row in
    select s.id from public.video_sessions s
     where s.status = 'scheduled'
       and s.start_at between now() and now() + interval '10 minutes'
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'lobby', 'جلستك تبدأ بعد قليل',
      'يفتح الباب قبل الموعد بخمس دقائق، وتستطيع حينها فحص الصوت والصورة.');
  end loop;

  for v_row in
    select s.id from public.video_sessions s
     where s.status in ('scheduled', 'live')
       and now() >= s.start_at and now() < s.end_at
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'started', 'بدأت الجلسة', 'الجلسة جارية الآن.');
  end loop;

  for v_row in
    select s.id, s.status, s.booking_id from public.video_sessions s
     where s.status in ('completed', 'no_show')
       and s.end_at < now()
  loop
    v_total := v_total + public.notify_session(
      v_row.id, 'ended',
      case when v_row.status = 'no_show' then 'انتهت الجلسة دون حضور' else 'انتهت الجلسة' end,
      case
        when v_row.status = 'no_show' then 'لم يدخل أحد الغرفة في وقتها.'
        when v_row.booking_id is not null then 'ملخّص الحضور بالداخل — ويسعدنا تقييمك للجلسة.'
        else 'ملخّص الحضور بالداخل.'
      end);
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.notify_due_sessions() from public, anon, authenticated;
