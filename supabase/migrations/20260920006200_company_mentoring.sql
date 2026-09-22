-- =============================================================================
-- 0062 — A mentor the company chose, looking at what the company chose
--
-- Two halves of the same relationship, and neither worked.
--
-- **The mentor could not be let in.** 0060 gave a canvas a `mentors`
-- visibility — and nothing honoured it: the read policy knew the workspace and
-- the public and nobody in between. So a company could mark a wall "my mentors
-- may see this" and no mentor ever could.
--
-- **And the company could not book.** A booking has always belonged to a
-- student or a team. A founder booking on behalf of their company paid
-- personally, and the session carried no trace of which company it was about —
-- so the mentor arrived without the one thing they needed.
--
-- Both are fixed by the same idea: **access is granted by name, to a named
-- mentor, by whoever runs the company — and it can be taken back.**
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Letting a mentor in
-- ---------------------------------------------------------------------------
create table public.startup_mentor_access (
  startup_id uuid not null references public.startups (id) on delete cascade,
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  note_ar    text,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_on date,

  primary key (startup_id, mentor_id)
);

create index startup_mentor_access_mentor_idx on public.startup_mentor_access (mentor_id);

alter table public.startup_mentor_access enable row level security;

create policy startup_mentor_access_read on public.startup_mentor_access
  for select to authenticated
  using (
    mentor_id = (select auth.uid())
    or public.can_view_startup_workspace(startup_id)
  );

create policy startup_mentor_access_write on public.startup_mentor_access
  for all to authenticated
  using (public.can_manage_startup(startup_id))
  with check (public.can_manage_startup(startup_id));

grant select, insert, update, delete on public.startup_mentor_access to authenticated;

-- Does this person have a standing invitation into this company's thinking?
create or replace function public.is_startup_mentor(p_startup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startup_mentor_access a
     where a.startup_id = p_startup
       and a.mentor_id = (select auth.uid())
       and (a.expires_on is null or a.expires_on >= current_date)
  );
$$;

comment on function public.is_startup_mentor is
  'A named mentor, let in by whoever runs the company, for as long as the company says.';

grant execute on function public.is_startup_mentor(uuid) to authenticated;

-- Now `mentors` visibility means something.
drop policy canvases_read on public.canvases;

create policy canvases_read on public.canvases
  for select to anon, authenticated
  using (
    public.can_view_startup_workspace(startup_id)
    or (visibility in ('mentors', 'public') and public.is_startup_mentor(startup_id))
    or (visibility = 'public' and exists (
      select 1 from public.startups s where s.id = startup_id and s.is_public))
  );

-- A mentor who may read a wall may read what is on it.
create or replace function public.canvas_board(p_canvas uuid)
returns table (
  block_key   text,
  block_title text,
  block_hint  text,
  block_sort  integer,
  card_id     uuid,
  body_ar     text,
  colour      public.card_colour,
  note_ar     text,
  tags        text[],
  sort_order  integer,
  linked      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.key, b.title_ar, b.hint_ar, b.sort_order,
         c.id, c.body_ar, c.colour, c.note_ar, c.tags, c.sort_order,
         coalesce((
           select jsonb_agg(jsonb_build_object('kind', l.target_kind, 'id', l.target_id))
             from public.canvas_card_links l where l.card_id = c.id
         ), '[]'::jsonb)
    from public.canvas_blocks b
    left join public.canvas_cards c on c.canvas_id = b.canvas_id and c.block_key = b.key
   where b.canvas_id = p_canvas
     and exists (
       select 1 from public.canvases cv
        where cv.id = p_canvas
          and (
            public.can_view_startup_workspace(cv.startup_id)
            or (cv.visibility in ('mentors', 'public') and public.is_startup_mentor(cv.startup_id))
            or (cv.visibility = 'public'
                and exists (select 1 from public.startups s
                             where s.id = cv.startup_id and s.is_public))
          )
     )
   order by b.sort_order, c.sort_order;
$$;

grant execute on function public.canvas_board(uuid) to anon, authenticated;

-- What a mentor has been given the keys to, and what they may look at.
create or replace function public.my_mentored_companies()
returns table (
  startup_id uuid,
  name_ar    text,
  one_liner_ar text,
  stage      public.startup_stage,
  granted_at timestamptz,
  expires_on date,
  canvases   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name_ar, s.one_liner_ar, s.stage, a.granted_at, a.expires_on,
         (select count(*)::int from public.canvases c
           where c.startup_id = s.id and c.visibility in ('mentors', 'public'))
    from public.startup_mentor_access a
    join public.startups s on s.id = a.startup_id
   where a.mentor_id = (select auth.uid())
     and (a.expires_on is null or a.expires_on >= current_date)
   order by a.granted_at desc;
$$;

grant execute on function public.my_mentored_companies() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The company as the party to a session
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column startup_id uuid references public.startups (id) on delete set null;

create index bookings_startup_idx on public.bookings (startup_id);

-- The old check knew a student and a team. A company booking has a company on
-- it, and whoever booked it as the person the platform talks to.
alter table public.bookings drop constraint bookings_owner_matches_kind;

alter table public.bookings
  add constraint bookings_owner_matches_kind check (
    (kind = 'student_mentor'  and student_id is not null and team_id is null) or
    (kind = 'team_mentor'     and team_id is not null) or
    (kind = 'company_mentor'  and startup_id is not null and student_id is not null)
  );

-- Reading a company's booking belongs to the company's people, as well as to
-- the two sides of the session.
drop policy bookings_read on public.bookings;

create policy bookings_read on public.bookings
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or mentor_id = (select auth.uid())
    or public.is_admin()
    or (team_id is not null and public.is_team_member(team_id))
    or (startup_id is not null and public.can_view_startup_workspace(startup_id))
  );

-- ---------------------------------------------------------------------------
-- Booking one
-- ---------------------------------------------------------------------------
-- Priced per attending seat, like a team's, because a mentor's hour with four
-- people in it is not the hour they sell to one.
create or replace function public.create_company_booking_request(
  p_startup      uuid,
  p_mentor       uuid,
  p_session_type uuid,
  p_starts_at    timestamptz,
  p_method_key   text,
  p_members      uuid[] default null,
  p_goal         text default null,
  p_grant_mentor boolean default true
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := (select auth.uid());
  v_level    public.mentor_level;
  v_prices   public.mentor_levels%rowtype;
  v_duration integer;
  v_hold     integer;
  v_seats    uuid[];
  v_count    integer;
  v_booking  public.bookings%rowtype;
  v_member   uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.can_manage_startup(p_startup) then
    raise exception 'إدارة الشركة فقط من تحجز جلساتها';
  end if;

  if not exists (
    select 1 from public.payment_methods pm where pm.key = p_method_key and pm.is_enabled
  ) then
    raise exception 'طريقة الدفع غير متاحة';
  end if;

  select mp.level into v_level
    from public.mentor_profiles mp
   where mp.profile_id = p_mentor and mp.is_accepting;

  if v_level is null then
    raise exception 'هذا المنتور لا يستقبل حجوزات';
  end if;

  if not exists (
    select 1 from public.mentor_session_types mst
    where mst.mentor_id = p_mentor and mst.session_type_id = p_session_type and mst.is_active
  ) then
    raise exception 'هذا المنتور لا يقدّم هذا النوع من الجلسات';
  end if;

  v_seats := coalesce(p_members, array[v_me]);

  foreach v_member in array v_seats loop
    if not exists (
      select 1 from public.startup_members sm
       where sm.startup_id = p_startup and sm.profile_id = v_member
    ) then
      raise exception 'المقاعد لأعضاء مساحة العمل فقط';
    end if;
  end loop;

  v_count := coalesce(array_length(v_seats, 1), 0);
  if v_count < 1 then
    raise exception 'اختر عضواً واحداً على الأقل';
  end if;
  if v_count > 20 then
    raise exception 'عشرون مقعداً كحد أقصى';
  end if;

  select * into v_prices from public.mentor_levels where level = v_level;
  select duration_minutes into v_duration from public.session_types where id = p_session_type;
  v_hold := coalesce(public.setting_int('booking_reservation_minutes'), 45);

  insert into public.bookings (
    kind, student_id, startup_id, mentor_id, session_type_id,
    scheduled_start, scheduled_end, status, seats,
    price_usd, platform_share_usd, mentor_share_usd, session_goal_ar, reserved_until
  )
  values (
    'company_mentor', v_me, p_startup, p_mentor, p_session_type,
    p_starts_at, p_starts_at + (v_duration || ' minutes')::interval,
    'payment_pending', v_count,
    v_prices.session_price_usd  * v_count,
    v_prices.platform_share_usd * v_count,
    v_prices.mentor_share_usd   * v_count,
    nullif(trim(coalesce(p_goal, '')), ''), now() + (v_hold || ' minutes')::interval
  )
  returning * into v_booking;

  insert into public.booking_seats (booking_id, profile_id)
  select v_booking.id, unnest(v_seats)
  on conflict do nothing;

  insert into public.payments (booking_id, method_key, amount_usd, status)
  values (v_booking.id, p_method_key, v_booking.price_usd, 'pending');

  -- The mentor cannot advise on what they cannot see. Granting is the default
  -- and is still a decision: it can be refused here, and withdrawn later.
  if p_grant_mentor then
    -- Booking a mentor re-opens access that had lapsed: a company asking for an
    -- hour is a company asking to be looked at again.
    insert into public.startup_mentor_access (startup_id, mentor_id, granted_by, note_ar)
    values (p_startup, p_mentor, v_me, 'وصول ممنوح مع حجز جلسة')
    on conflict (startup_id, mentor_id) do update
      set granted_by = excluded.granted_by,
          granted_at = now(),
          note_ar    = excluded.note_ar,
          expires_on = null;
  end if;

  return v_booking;
end;
$$;

grant execute on function public.create_company_booking_request(uuid, uuid, uuid, timestamptz, text, uuid[], text, boolean) to authenticated;

-- The room a company's session opens: the mentor, and the seats it booked.
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
    case new.kind
      when 'team_mentor'    then 'team_mentor'
      when 'company_mentor' then 'company_mentor'
      else 'student_mentor'
    end::public.video_session_type,
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
    return new;
  end if;

  -- The seats that were bought, by name.
  insert into public.video_session_participants (session_id, profile_id, role)
  select v_session, bs.profile_id,
         case when tm.role = 'leader' then 'leader' else 'member' end::public.session_role
    from public.booking_seats bs
    left join public.team_members tm
      on tm.team_id = new.team_id and tm.profile_id = bs.profile_id
   where bs.booking_id = new.id
  on conflict do nothing;

  -- A team booking made before seats were named still opens a room.
  if new.team_id is not null and not exists (
    select 1 from public.video_session_participants vp
     where vp.session_id = v_session and vp.profile_id <> new.mentor_id
  ) then
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

-- The session's constraint knew two kinds of booking-backed session.
alter table public.video_sessions drop constraint video_sessions_source;

alter table public.video_sessions
  add constraint video_sessions_source check (
    (session_type in ('student_mentor', 'team_mentor', 'company_mentor') and booking_id is not null) or
    (session_type = 'team_internal' and booking_id is null and team_id is not null)
  );
