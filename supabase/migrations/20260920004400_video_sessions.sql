-- =============================================================================
-- 0044 — Video sessions: the call is part of the booking, not a product
--
-- A booking already carries who, when, how much and whether it was paid for.
-- What it has never carried is the call itself: who may enter, when the door
-- opens, who actually turned up and for how long, and when it ends. 0030 added
-- bookings.meeting_url, which is a link — and a link is exactly what this
-- system must not be, because a link can be forwarded.
--
-- So a session is its own object with its own life:
--
--   Booking (confirmed) ──> VideoSession ──> Participants
--                                 │              └─ presence events
--                                 └─ scheduled → lobby → live → completed
--
-- Four rules shape it.
--
-- 1. **No session exists before the booking is confirmed.** A pending booking
--    is not a room waiting to be entered; the trigger that creates the session
--    fires on confirmation, and nowhere else.
--
-- 2. **The server is the clock.** Which door is open is computed from now()
--    against the session's own times. Nothing a browser says about the time
--    can open a door or hold one open.
--
-- 3. **Attendance is a log, presence is derived.** Joining and leaving are
--    append-only events; how long somebody was present is counted from them,
--    so a reconnect is two events and not a lost record.
--
-- 4. **Only named participants enter.** A team booking admits the members it
--    was booked for, not everybody on the team — which is what the seats were
--    paid for.
-- =============================================================================

create type public.video_session_type as enum ('student_mentor', 'team_mentor', 'team_internal');

create type public.video_session_status as enum (
  'scheduled', 'live', 'completed', 'cancelled', 'no_show'
);

create type public.session_role as enum ('mentor', 'student', 'member', 'leader');

create table public.video_sessions (
  id           uuid primary key default extensions.gen_random_uuid(),
  session_code text not null unique
                 default ('TMS-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  booking_id   uuid unique references public.bookings (id) on delete cascade,
  team_id      uuid references public.teams (id) on delete cascade,
  session_type public.video_session_type not null,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       public.video_session_status not null default 'scheduled',
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),

  constraint video_sessions_time_ordered check (end_at > start_at),
  -- a mentor session is a booking; an internal one is a team's own time
  constraint video_sessions_source check (
    (session_type in ('student_mentor', 'team_mentor') and booking_id is not null) or
    (session_type = 'team_internal' and booking_id is null and team_id is not null)
  )
);

create index video_sessions_window_idx on public.video_sessions (start_at)
  where status = 'scheduled';

create table public.video_session_participants (
  session_id uuid not null references public.video_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       public.session_role not null,

  primary key (session_id, profile_id)
);

create index video_session_participants_profile_idx
  on public.video_session_participants (profile_id);

-- Append-only, like every other record of something that happened. A reconnect
-- is another pair of rows, never an edit of the first.
create table public.video_presence_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.video_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('joined', 'left')),
  at         timestamptz not null default now()
);

create index video_presence_events_session_idx
  on public.video_presence_events (session_id, profile_id, at);

alter table public.video_sessions             enable row level security;
alter table public.video_session_participants enable row level security;
alter table public.video_presence_events      enable row level security;

-- ---------------------------------------------------------------------------
-- Who may see a session at all
-- ---------------------------------------------------------------------------
create or replace function public.is_session_participant(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.video_session_participants vp
     where vp.session_id = p_session and vp.profile_id = (select auth.uid())
  );
$$;

grant execute on function public.is_session_participant(uuid) to authenticated;

create policy video_sessions_read on public.video_sessions
  for select to authenticated
  using (public.is_session_participant(id) or public.is_admin());

create policy video_session_participants_read on public.video_session_participants
  for select to authenticated
  using (public.is_session_participant(session_id) or public.is_admin());

create policy video_presence_events_read on public.video_presence_events
  for select to authenticated
  using (public.is_session_participant(session_id) or public.is_admin());

-- Every write goes through a function: joining is an authorisation decision,
-- not an insert a client gets to make.
grant select on public.video_sessions, public.video_session_participants,
                public.video_presence_events to authenticated;

-- ---------------------------------------------------------------------------
-- The clock lives here
-- ---------------------------------------------------------------------------
-- 'waiting'  — too early; the door is shut
-- 'lobby'    — the five minutes before, mic and camera can be checked
-- 'live'     — the session's own hour
-- 'ended'    — over, and not re-openable
create or replace function public.session_phase(p_session uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.status in ('cancelled', 'no_show') then 'ended'
    when s.status = 'completed' then 'ended'
    when now() >= s.end_at then 'ended'
    when now() >= s.start_at then 'live'
    when now() >= s.start_at - interval '5 minutes' then 'lobby'
    else 'waiting'
  end
  from public.video_sessions s where s.id = p_session;
$$;

comment on function public.session_phase is
  'Which door is open, decided by the server''s clock against the session''s own times. A browser''s idea of the time cannot open one.';

grant execute on function public.session_phase(uuid) to authenticated;

-- The same clock, readable. A countdown drawn in a browser has to be anchored
-- to the clock that actually decides the door, not to the machine it is drawn
-- on — this is what the page anchors to.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.server_now() to authenticated;

-- ---------------------------------------------------------------------------
-- A confirmed booking is what creates a session
-- ---------------------------------------------------------------------------
create or replace function public.open_session_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  insert into public.video_sessions (booking_id, team_id, session_type, start_at, end_at)
  values (
    new.id,
    new.team_id,
    case when new.kind = 'team_mentor' then 'team_mentor' else 'student_mentor' end::public.video_session_type,
    new.scheduled_start,
    new.scheduled_end
  )
  on conflict (booking_id) do nothing
  returning id into v_session;

  if v_session is null then
    return new;
  end if;

  insert into public.video_session_participants (session_id, profile_id, role)
  values (v_session, new.mentor_id, 'mentor')
  on conflict do nothing;

  if new.kind = 'student_mentor' then
    insert into public.video_session_participants (session_id, profile_id, role)
    values (v_session, new.student_id, 'student')
    on conflict do nothing;
  else
    -- A team session admits the members it was booked for. Until seats are
    -- picked one by one, that is the team's active members up to the number
    -- of seats paid for — never simply everybody on the team.
    insert into public.video_session_participants (session_id, profile_id, role)
    select v_session, tm.profile_id,
           case when tm.role = 'leader' then 'leader' else 'member' end::public.session_role
      from public.team_members tm
     where tm.team_id = new.team_id and tm.is_active
     order by (tm.role = 'leader') desc, tm.joined_at
     limit new.seats
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger bookings_open_session
  after update of status on public.bookings
  for each row execute function public.open_session_for_booking();

-- ---------------------------------------------------------------------------
-- A team's own time, with a limit that is the team's and not each member's
-- ---------------------------------------------------------------------------
create or replace function public.schedule_internal_session(
  p_team    uuid,
  p_start   timestamptz,
  p_end     timestamptz,
  p_members uuid[] default null
)
returns public.video_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_session public.video_sessions;
  v_used    integer;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.is_team_member(p_team) then
    raise exception 'أعضاء الفريق فقط من يحجزون اجتماعاته';
  end if;

  if p_end <= p_start then
    raise exception 'وقت النهاية يجب أن يكون بعد البداية';
  end if;

  -- Two a week, for the team, counted from the start of this week.
  select count(*) into v_used
    from public.video_sessions s
   where s.team_id = p_team
     and s.session_type = 'team_internal'
     and s.status <> 'cancelled'
     and s.start_at >= date_trunc('week', now())
     and s.start_at <  date_trunc('week', now()) + interval '7 days';

  if v_used >= 2 then
    raise exception 'بلغ فريقك حدّ اجتماعين داخليين في الأسبوع';
  end if;

  insert into public.video_sessions (team_id, session_type, start_at, end_at)
  values (p_team, 'team_internal', p_start, p_end)
  returning * into v_session;

  insert into public.video_session_participants (session_id, profile_id, role)
  select v_session.id, tm.profile_id,
         case when tm.role = 'leader' then 'leader' else 'member' end::public.session_role
    from public.team_members tm
   where tm.team_id = p_team
     and tm.is_active
     and (p_members is null or tm.profile_id = any (p_members))
  on conflict do nothing;

  return v_session;
end;
$$;

grant execute on function public.schedule_internal_session(uuid, timestamptz, timestamptz, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Entering, leaving, and coming back
-- ---------------------------------------------------------------------------
create or replace function public.join_video_session(p_session uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_phase text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not exists (
    select 1 from public.video_session_participants vp
     where vp.session_id = p_session and vp.profile_id = v_me
  ) then
    raise exception 'لست من المشاركين في هذه الجلسة';
  end if;

  v_phase := public.session_phase(p_session);

  if v_phase = 'waiting' then
    raise exception 'الباب يفتح قبل الموعد بخمس دقائق';
  end if;

  if v_phase = 'ended' then
    raise exception 'انتهت هذه الجلسة';
  end if;

  update public.video_sessions
     set status = 'live'
   where id = p_session and status = 'scheduled' and now() >= start_at;

  insert into public.video_presence_events (session_id, profile_id, kind)
  values (p_session, v_me, 'joined');

  return v_phase;
end;
$$;

create or replace function public.leave_video_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    return;
  end if;

  -- Leaving is not the end of anything: the session runs until its time is up
  -- and the person can come back while it does.
  insert into public.video_presence_events (session_id, profile_id, kind)
  select p_session, v_me, 'left'
   where exists (
     select 1 from public.video_session_participants vp
      where vp.session_id = p_session and vp.profile_id = v_me
   );
end;
$$;

grant execute on function public.join_video_session(uuid)  to authenticated;
grant execute on function public.leave_video_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Attendance, counted from the log
-- ---------------------------------------------------------------------------
create or replace function public.session_attendance(p_session uuid)
returns table (
  profile_id    uuid,
  full_name     text,
  role          public.session_role,
  first_joined  timestamptz,
  last_left     timestamptz,
  entries       integer,
  minutes       integer,
  is_present    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (select s.start_at, s.end_at, s.id from public.video_sessions s where s.id = p_session),
  paired as (
    select e.profile_id,
           e.kind,
           e.at,
           lead(e.at) over (partition by e.profile_id order by e.at) as next_at,
           lead(e.kind) over (partition by e.profile_id order by e.at) as next_kind
      from public.video_presence_events e
     where e.session_id = p_session
  ),
  spans as (
    select p.profile_id,
           p.at as entered,
           coalesce(
             case when p.next_kind = 'left' then p.next_at end,
             least(now(), (select end_at from bounds))
           ) as exited
      from paired p
     where p.kind = 'joined'
  )
  select vp.profile_id,
         pr.full_name,
         vp.role,
         (select min(e.at) from public.video_presence_events e
           where e.session_id = p_session and e.profile_id = vp.profile_id and e.kind = 'joined'),
         (select max(e.at) from public.video_presence_events e
           where e.session_id = p_session and e.profile_id = vp.profile_id and e.kind = 'left'),
         (select count(*)::int from public.video_presence_events e
           where e.session_id = p_session and e.profile_id = vp.profile_id and e.kind = 'joined'),
         coalesce((
           select sum(greatest(0, extract(epoch from (sp.exited - sp.entered))))::int / 60
             from spans sp where sp.profile_id = vp.profile_id
         ), 0),
         coalesce((
           select e.kind = 'joined'
             from public.video_presence_events e
            where e.session_id = p_session and e.profile_id = vp.profile_id
            order by e.at desc limit 1
         ), false) and public.session_phase(p_session) = 'live'
    from public.video_session_participants vp
    join public.profiles pr on pr.id = vp.profile_id
   where vp.session_id = p_session
     and (public.is_session_participant(p_session) or public.is_admin())
   order by vp.role, pr.full_name;
$$;

comment on function public.session_attendance is
  'Who turned up and for how long, counted from the presence log. A reconnect is two more events, never a lost record.';

grant execute on function public.session_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Closing what the clock has already ended
-- ---------------------------------------------------------------------------
-- The phase is derived, so a session is over the moment its time is, whether
-- or not anything ran. This writes that down — and marks a session nobody
-- attended as a no-show rather than a completed one.
create or replace function public.close_due_video_sessions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.video_sessions s
       set status = case
             when not exists (
               select 1 from public.video_presence_events e where e.session_id = s.id
             ) then 'no_show'::public.video_session_status
             else 'completed'::public.video_session_status
           end,
           ended_at = coalesce(s.ended_at, s.end_at)
     where s.status in ('scheduled', 'live')
       and now() >= s.end_at
    returning 1
  )
  select count(*)::int from closed;
$$;

revoke execute on function public.close_due_video_sessions() from public, anon, authenticated;

-- What a person has ahead of them, and behind them.
create or replace function public.my_sessions(p_past boolean default false)
returns table (
  id           uuid,
  session_code text,
  session_type public.video_session_type,
  start_at     timestamptz,
  end_at       timestamptz,
  status       public.video_session_status,
  phase        text,
  my_role      public.session_role,
  counterpart  text,
  participants integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select s.id,
         s.session_code,
         s.session_type,
         s.start_at,
         s.end_at,
         s.status,
         public.session_phase(s.id),
         vp.role,
         case
           when s.session_type = 'team_internal' then (select t.title_ar from public.teams t where t.id = s.team_id)
           when s.session_type = 'team_mentor' then (select t.title_ar from public.teams t where t.id = s.team_id)
           else (
             select pr.full_name from public.video_session_participants vp2
               join public.profiles pr on pr.id = vp2.profile_id
              where vp2.session_id = s.id and vp2.profile_id <> me.id
              limit 1)
         end,
         (select count(*)::int from public.video_session_participants vp3 where vp3.session_id = s.id)
    from public.video_sessions s
    join public.video_session_participants vp on vp.session_id = s.id
    cross join me
   where vp.profile_id = me.id
     and (case when p_past then s.end_at < now() else s.end_at >= now() end)
   order by s.start_at;
$$;

grant execute on function public.my_sessions(boolean) to authenticated;
