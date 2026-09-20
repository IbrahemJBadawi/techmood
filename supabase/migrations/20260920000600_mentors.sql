-- =============================================================================
-- TechMood — 0006 Mentors: levels, pricing, availability
-- Price is a property of the mentor's LEVEL, not a free-text field, and the
-- platform/mentor split is stored with it.
-- =============================================================================

create table public.mentor_levels (
  level              public.mentor_level primary key,
  session_price_usd  numeric(8,2) not null check (session_price_usd > 0),
  platform_share_usd numeric(8,2) not null check (platform_share_usd >= 0),
  mentor_share_usd   numeric(8,2) not null check (mentor_share_usd >= 0),
  min_sessions       integer not null default 0 check (min_sessions >= 0),
  min_rating         numeric(3,2) not null default 0 check (min_rating between 0 and 5),
  sort_order         integer not null,

  constraint mentor_levels_shares_add_up
    check (platform_share_usd + mentor_share_usd = session_price_usd)
);

comment on table public.mentor_levels is
  'The published price ladder. The shares must always sum to the session price, '
  'so the platform cut can never silently drift.';

create table public.mentor_profiles (
  profile_id       uuid primary key references public.profiles (id) on delete cascade,
  level            public.mentor_level not null default 'L1',
  headline_ar      text,
  bio_ar           text,
  domains          text[] not null default '{}',
  years_experience integer check (years_experience between 0 and 60),
  session_minutes  integer not null default 60 check (session_minutes in (30, 45, 60, 90)),
  is_accepting     boolean not null default true,
  -- maintained by triggers from real sessions and real feedback
  sessions_count   integer not null default 0 check (sessions_count >= 0),
  rating_avg       numeric(3,2) check (rating_avg between 0 and 5),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger mentor_profiles_touch before update on public.mentor_profiles
  for each row execute function public.touch_updated_at();

-- A mentor must actually hold an approved mentor role.
create or replace function public.enforce_mentor_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profile_roles pr
    where pr.profile_id = new.profile_id
      and pr.role = 'mentor'
      and pr.status = 'approved'
  ) then
    raise exception 'profile % does not hold an approved mentor role', new.profile_id;
  end if;
  return new;
end;
$$;

create trigger mentor_profiles_require_role
  before insert or update of profile_id on public.mentor_profiles
  for each row execute function public.enforce_mentor_role();

-- ---------------------------------------------------------------------------
-- Availability: 7 weekdays, at most 5 hours per day (product rule)
-- ---------------------------------------------------------------------------
create table public.mentor_availability (
  id          uuid primary key default extensions.gen_random_uuid(),
  mentor_id   uuid not null references public.mentor_profiles (profile_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,

  constraint mentor_availability_ordered check (end_time > start_time)
);

create index mentor_availability_mentor_idx on public.mentor_availability (mentor_id, day_of_week);

create or replace function public.enforce_daily_availability_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
begin
  select coalesce(sum(extract(epoch from (end_time - start_time)) / 60), 0)::integer
    into v_minutes
  from public.mentor_availability
  where mentor_id = new.mentor_id
    and day_of_week = new.day_of_week
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_minutes := v_minutes + (extract(epoch from (new.end_time - new.start_time)) / 60)::integer;

  if v_minutes > 300 then
    raise exception 'a mentor may publish at most 5 hours of availability per day (requested % minutes)', v_minutes;
  end if;

  return new;
end;
$$;

create trigger mentor_availability_daily_cap
  before insert or update on public.mentor_availability
  for each row execute function public.enforce_daily_availability_cap();

create table public.mentor_time_off (
  id        uuid primary key default extensions.gen_random_uuid(),
  mentor_id uuid not null references public.mentor_profiles (profile_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  reason    text,
  constraint mentor_time_off_ordered check (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Level progression: a mentor's level is earned, and the price follows it.
-- ---------------------------------------------------------------------------
create or replace function public.mentor_eligible_level(p_mentor uuid)
returns public.mentor_level
language sql
stable
security definer
set search_path = ''
as $$
  select ml.level
  from public.mentor_levels ml
  join public.mentor_profiles mp on mp.profile_id = p_mentor
  where mp.sessions_count >= ml.min_sessions
    and coalesce(mp.rating_avg, 0) >= ml.min_rating
  order by ml.sort_order desc
  limit 1;
$$;

-- Only an admin may set a level, and never above what the mentor has earned.
create or replace function public.set_mentor_level(p_mentor uuid, p_level public.mentor_level)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_sort integer;
  v_req_sort integer;
begin
  if not public.is_admin() then
    raise exception 'only an admin may change a mentor level';
  end if;

  select sort_order into v_max_sort from public.mentor_levels
   where level = public.mentor_eligible_level(p_mentor);
  select sort_order into v_req_sort from public.mentor_levels where level = p_level;

  if v_req_sort > coalesce(v_max_sort, 0) then
    raise exception 'mentor % has not met the requirements for level %', p_mentor, p_level;
  end if;

  update public.mentor_profiles set level = p_level where profile_id = p_mentor;
end;
$$;
