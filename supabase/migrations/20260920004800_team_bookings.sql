-- =============================================================================
-- 0048 — A team books a mentor, and pays per member
--
-- `bookings` has carried `kind = 'team_mentor'` and `seats` since 0007, the
-- pricing document says a team session costs the mentor's rate times the number
-- of attending members, and 0044 admits "the members it was booked for". All
-- three were waiting on the same missing piece: nothing created such a booking,
-- and nowhere said which members the seats were for.
--
-- So two things arrive together:
--
--   * `booking_seats` — the members a team session was booked for, named. The
--     room admits exactly them, which is what the seats were paid for.
--   * `create_team_booking_request()` — the leader's version of the student's
--     request. The price is read here, not sent: seats × the mentor's rate,
--     with the platform and mentor shares scaled the same way, so a crafted
--     call cannot buy five seats at the price of one.
-- =============================================================================

create table public.booking_seats (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  primary key (booking_id, profile_id)
);

create index booking_seats_profile_idx on public.booking_seats (profile_id);

alter table public.booking_seats enable row level security;

-- Whoever may read the booking may read who it was booked for. Writing goes
-- through the function, like everything else that decides money.
create policy booking_seats_read on public.booking_seats
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and (
           b.student_id = (select auth.uid())
           or b.mentor_id = (select auth.uid())
           or public.is_admin()
           or (b.team_id is not null and public.is_team_member(b.team_id))
         )
    )
  );

grant select on public.booking_seats to authenticated;

-- ---------------------------------------------------------------------------
-- The leader's request
-- ---------------------------------------------------------------------------
create or replace function public.create_team_booking_request(
  p_team         uuid,
  p_mentor       uuid,
  p_session_type uuid,
  p_starts_at    timestamptz,
  p_method_key   text,
  p_members      uuid[] default null,
  p_goal         text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader  uuid := (select auth.uid());
  v_level   public.mentor_level;
  v_prices  public.mentor_levels%rowtype;
  v_duration integer;
  v_hold    integer;
  v_seats   uuid[];
  v_count   integer;
  v_booking public.bookings%rowtype;
  v_member  uuid;
begin
  if v_leader is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  -- A team's sessions are the leader's to book: the money is the team's, and
  -- the seats are the team's members.
  if not public.is_team_leader(p_team) then
    raise exception 'قائد الفريق فقط من يحجز جلسات الفريق';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
    where pm.key = p_method_key and pm.is_enabled
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

  -- Named members, or the whole active team when nobody is named.
  v_seats := coalesce(
    p_members,
    array(select tm.profile_id from public.team_members tm
           where tm.team_id = p_team and tm.is_active)
  );

  -- Every seat has to be a member of this team; a seat for somebody outside it
  -- would be a stranger in the room.
  foreach v_member in array v_seats loop
    if not exists (
      select 1 from public.team_members tm
       where tm.team_id = p_team and tm.profile_id = v_member and tm.is_active
    ) then
      raise exception 'المقاعد لأعضاء الفريق فقط';
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
    kind, student_id, team_id, mentor_id, session_type_id,
    scheduled_start, scheduled_end,
    status, seats, price_usd, platform_share_usd, mentor_share_usd,
    session_goal_ar, reserved_until
  )
  values (
    'team_mentor', v_leader, p_team, p_mentor, p_session_type,
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

  return v_booking;
end;
$$;

comment on function public.create_team_booking_request is
  'A team leader books a mentor for named members. The price is seats times the mentor''s rate, read here and never sent.';

grant execute on function public.create_team_booking_request(uuid, uuid, uuid, timestamptz, text, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- The room admits the seats that were paid for
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
    -- The members the seats were bought for, by name.
    insert into public.video_session_participants (session_id, profile_id, role)
    select v_session, bs.profile_id,
           case when tm.role = 'leader' then 'leader' else 'member' end::public.session_role
      from public.booking_seats bs
      left join public.team_members tm
        on tm.team_id = new.team_id and tm.profile_id = bs.profile_id
     where bs.booking_id = new.id
    on conflict do nothing;

    -- A booking made before seats were named (0007 to 0047) still opens a room:
    -- the team's own members, up to the number of seats paid for.
    if not exists (
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
  end if;

  return new;
end;
$$;
