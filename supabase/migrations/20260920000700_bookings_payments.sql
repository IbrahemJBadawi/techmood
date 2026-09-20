-- =============================================================================
-- TechMood — 0007 Bookings, manual-verification payments, video calls
--
-- The rule the whole flow exists to protect:
--   a booking is NEVER 'confirmed' before its payment is verified AND the mentor
--   has accepted it. The state machine below is enforced in the database, not in
--   the UI, so no client can skip a step.
-- =============================================================================

create table public.bookings (
  id                 uuid primary key default extensions.gen_random_uuid(),
  booking_code       text not null unique default ('TMB-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  kind               public.booking_kind not null default 'student_mentor',
  student_id         uuid references public.profiles (id) on delete set null,
  team_id            uuid,
  mentor_id          uuid not null references public.mentor_profiles (profile_id) on delete restrict,
  scheduled_start    timestamptz not null,
  scheduled_end      timestamptz not null,
  status             public.booking_status not null default 'draft',
  -- a team session is priced per attending member
  seats              integer not null default 1 check (seats between 1 and 20),
  price_usd          numeric(8,2) not null check (price_usd >= 0),
  platform_share_usd numeric(8,2) not null check (platform_share_usd >= 0),
  mentor_share_usd   numeric(8,2) not null check (mentor_share_usd >= 0),
  topic_ar           text,
  notes_ar           text,
  mentor_decided_at  timestamptz,
  confirmed_at       timestamptz,
  completed_at       timestamptz,
  cancelled_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint bookings_time_ordered check (scheduled_end > scheduled_start),
  constraint bookings_owner_matches_kind check (
    (kind = 'student_mentor' and student_id is not null and team_id is null) or
    (kind = 'team_mentor'    and team_id is not null)
  ),
  constraint bookings_shares_add_up check (platform_share_usd + mentor_share_usd = price_usd)
);

create index bookings_mentor_idx  on public.bookings (mentor_id, scheduled_start);
create index bookings_student_idx on public.bookings (student_id, scheduled_start desc);
create index bookings_status_idx  on public.bookings (status);

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- A mentor cannot be double-booked. Cancelled/rejected/refunded bookings free the slot.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    mentor_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
  )
  where (status not in ('cancelled', 'rejected', 'refunded', 'draft'));

-- ---------------------------------------------------------------------------
-- Booking rules: 3 days' notice, inside published availability, not on time off
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
begin
  if tg_op = 'INSERT' or new.scheduled_start is distinct from old.scheduled_start then
    -- Manual payment verification needs a real review window.
    if new.scheduled_start < now() + interval '3 days' then
      raise exception 'a session must be booked at least 3 days in advance';
    end if;
  end if;

  v_dow        := extract(dow from new.scheduled_start)::smallint;
  v_start_time := new.scheduled_start::time;
  v_end_time   := new.scheduled_end::time;

  if not exists (
    select 1 from public.mentor_availability ma
    where ma.mentor_id = new.mentor_id
      and ma.day_of_week = v_dow
      and ma.start_time <= v_start_time
      and ma.end_time   >= v_end_time
  ) then
    raise exception 'the requested slot is outside the mentor published availability';
  end if;

  if exists (
    select 1 from public.mentor_time_off t
    where t.mentor_id = new.mentor_id
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
  ) then
    raise exception 'the mentor is unavailable during the requested slot';
  end if;

  return new;
end;
$$;

create trigger bookings_rules
  before insert or update of scheduled_start, scheduled_end, mentor_id on public.bookings
  for each row execute function public.enforce_booking_rules();

-- ---------------------------------------------------------------------------
-- The state machine. Every legal edge is listed; anything else is rejected.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed public.booking_status[];
begin
  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'draft'            then array['payment_pending', 'cancelled']
    when 'payment_pending'  then array['payment_submitted', 'cancelled']
    when 'payment_submitted' then array['payment_verified', 'payment_pending', 'rejected', 'cancelled']
    when 'payment_verified' then array['mentor_pending', 'cancelled', 'refunded']
    when 'mentor_pending'   then array['confirmed', 'rejected', 'cancelled']
    when 'confirmed'        then array['completed', 'cancelled', 'refunded']
    when 'completed'        then array['refunded']
    when 'cancelled'        then array[]::text[]
    when 'rejected'         then array['refunded']
    when 'refunded'         then array[]::text[]
  end::public.booking_status[];

  if not (new.status = any (v_allowed)) then
    raise exception 'illegal booking transition % -> %', old.status, new.status;
  end if;

  -- A booking can only be confirmed once money is verified and the mentor agreed.
  if new.status = 'confirmed' then
    if not exists (
      select 1 from public.payments p
      where p.booking_id = new.id and p.status = 'verified'
    ) then
      raise exception 'a booking cannot be confirmed before its payment is verified';
    end if;
    new.confirmed_at := now();
  end if;

  if new.status = 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

create trigger bookings_transition
  before update of status on public.bookings
  for each row execute function public.enforce_booking_transition();

-- ---------------------------------------------------------------------------
-- Payments — manual verification MVP
-- ---------------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default extensions.gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  method           public.payment_method not null,
  amount_usd       numeric(8,2) not null check (amount_usd >= 0),
  status           public.payment_status not null default 'pending',
  -- what the student typed from their receipt
  reference        text,
  -- private storage object key for the uploaded proof; never a public URL
  proof_path       text,
  submitted_at     timestamptz,
  verified_by      uuid references public.profiles (id) on delete set null,
  verified_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index payments_one_active_per_booking on public.payments (booking_id)
  where status in ('pending', 'submitted', 'verified');
create index payments_review_idx on public.payments (status) where status = 'submitted';

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

comment on column public.payments.proof_path is
  'Storage key in the private payment-proofs bucket. Payment proof is personal '
  'financial data: only the payer and an admin may read it.';

-- Verification is an admin-only act, and it drives the booking forward.
create or replace function public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;

  select booking_id into v_booking from public.payments where id = p_payment_id;
  if v_booking is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  if p_approve then
    update public.payments
       set status = 'verified', verified_by = (select auth.uid()), verified_at = now()
     where id = p_payment_id;

    update public.bookings set status = 'payment_verified' where id = v_booking;
    -- hand it to the mentor for accept/decline
    update public.bookings set status = 'mentor_pending' where id = v_booking;
  else
    update public.payments
       set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = p_reason
     where id = p_payment_id;

    update public.bookings set status = 'payment_pending' where id = v_booking;
  end if;
end;
$$;

-- Mentor accept / decline
create or replace function public.mentor_decide_booking(p_booking_id uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentor uuid;
begin
  select mentor_id into v_mentor from public.bookings where id = p_booking_id;

  if v_mentor is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'only the booked mentor may decide this booking';
  end if;

  update public.bookings
     set status = case when p_accept then 'confirmed' else 'rejected' end::public.booking_status,
         mentor_decided_at = now(),
         cancelled_reason = case when p_accept then null else p_reason end
   where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Session content: the student work a mentor reviews during the session
-- ---------------------------------------------------------------------------
create table public.booking_submissions (
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  primary key (booking_id, submission_id)
);

create table public.session_feedback (
  id           uuid primary key default extensions.gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile   uuid not null references public.profiles (id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  comment_ar   text,
  created_at   timestamptz not null default now(),

  unique (booking_id, from_profile, to_profile)
);

-- Feedback on a mentor keeps their rating and level eligibility honest.
create or replace function public.refresh_mentor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mentor_profiles mp
     set rating_avg = sub.avg_stars
  from (
    select sf.to_profile, round(avg(sf.stars)::numeric, 2) as avg_stars
    from public.session_feedback sf
    where sf.to_profile = new.to_profile
    group by sf.to_profile
  ) sub
  where mp.profile_id = sub.to_profile;

  return new;
end;
$$;

create trigger session_feedback_refresh_rating
  after insert or update on public.session_feedback
  for each row execute function public.refresh_mentor_rating();

-- A completed session counts towards the mentor's session total and the student's XP.
create or replace function public.on_booking_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.mentor_profiles
       set sessions_count = sessions_count + 1
     where profile_id = new.mentor_id;

    if new.student_id is not null then
      perform public.award_xp(new.student_id, 'mentor_session_attended', 'bookings', new.id, null);
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_on_completed
  after update of status on public.bookings
  for each row execute function public.on_booking_completed();

-- ---------------------------------------------------------------------------
-- Video calls. Team-internal calls are free but capped at 2 per week.
-- ---------------------------------------------------------------------------
create table public.call_sessions (
  id         uuid primary key default extensions.gen_random_uuid(),
  kind       public.call_kind not null,
  booking_id uuid references public.bookings (id) on delete cascade,
  team_id    uuid,
  room_code  text not null unique default ('TMR-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10))),
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint call_sessions_source check (
    (kind in ('student_mentor', 'team_mentor') and booking_id is not null) or
    (kind = 'team_internal' and team_id is not null and booking_id is null)
  )
);

create index call_sessions_team_idx on public.call_sessions (team_id, starts_at desc);

create or replace function public.enforce_team_call_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.kind <> 'team_internal' then
    return new;
  end if;

  select count(*) into v_count
  from public.call_sessions
  where team_id = new.team_id
    and kind = 'team_internal'
    and starts_at >= date_trunc('week', new.starts_at)
    and starts_at <  date_trunc('week', new.starts_at) + interval '1 week';

  if v_count >= 2 then
    raise exception 'a team may hold at most 2 internal calls per week';
  end if;

  return new;
end;
$$;

create trigger call_sessions_team_quota
  before insert on public.call_sessions
  for each row execute function public.enforce_team_call_quota();
