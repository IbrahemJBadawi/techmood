-- =============================================================================
-- TechMood — 0002 Identity: profiles, TechMood ID, roles, skills, achievements
-- Every other table in this database hangs off profiles.id. There is exactly
-- one identity per account, and it is never duplicated per module.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TechMood ID generator: TMU-XXXXXXXX
-- Crockford-style alphabet with I, L, O, U removed so an ID can be read aloud
-- and typed from a printed certificate without ambiguity.
-- ---------------------------------------------------------------------------
create or replace function public.generate_techmood_id()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := 'TMU-';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.techmood_id = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — the one professional identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  techmood_id   text not null unique default public.generate_techmood_id(),
  full_name     text not null,
  headline      text,
  bio           text,
  avatar_url    text,
  country       text,
  city          text,
  github_url    text,
  linkedin_url  text,
  website_url   text,
  -- A public professional profile is the point of the platform, but the user
  -- stays in control of it.
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_techmood_id_format check (techmood_id ~ '^TMU-[0-9A-HJKMNP-TV-Z]{8}$'),
  constraint profiles_full_name_len check (char_length(full_name) between 2 and 120)
);

create index profiles_techmood_id_idx on public.profiles (techmood_id);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

comment on table public.profiles is
  'One account -> one TechMood ID -> one professional identity -> one reputation.';

-- ---------------------------------------------------------------------------
-- profile_roles — a user may hold several roles at once
-- ---------------------------------------------------------------------------
create table public.profile_roles (
  id               uuid primary key default extensions.gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  role             public.user_role not null,
  status           public.role_status not null default 'pending_review',
  application_note text,
  evidence_url     text,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),

  unique (profile_id, role)
);

create index profile_roles_profile_idx on public.profile_roles (profile_id);
create index profile_roles_review_idx  on public.profile_roles (status) where status = 'pending_review';

comment on table public.profile_roles is
  'Student is auto-approved. Every other role enters pending_review; a rejected '
  'role leaves the account intact and the user continues as a student.';

-- Student is always approved; a rejected/pending non-student role must never
-- silently become approved from the client.
create or replace function public.enforce_student_role_autoapproval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'student' then
    new.status := 'approved';
  end if;

  -- admin can only ever be granted by another admin (or by a direct SQL/seed run)
  if new.role = 'admin' and new.status = 'approved'
     and (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'admin role cannot be self-granted';
  end if;

  return new;
end;
$$;

create trigger profile_roles_student_autoapproval
  before insert or update on public.profile_roles
  for each row execute function public.enforce_student_role_autoapproval();

-- ---------------------------------------------------------------------------
-- New auth user -> profile + student role, in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name)
  values (new.id, v_name);

  -- everyone starts as a student, always approved
  insert into public.profile_roles (profile_id, role, status)
  values (new.id, 'student', 'approved');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance, reused by later migrations
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Skills & achievements
-- ---------------------------------------------------------------------------
create table public.skills (
  id       uuid primary key default extensions.gen_random_uuid(),
  slug     text not null unique,
  name_ar  text not null,
  name_en  text not null
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id   uuid not null references public.skills (id) on delete cascade,
  -- evidence-backed skills are the ones proven by an approved submission
  is_verified boolean not null default false,
  primary key (profile_id, skill_id)
);

create table public.achievements (
  id            uuid primary key default extensions.gen_random_uuid(),
  slug          text not null unique,
  name_ar       text not null,
  description_ar text,
  icon          text,
  xp_award      integer not null default 0 check (xp_award between 0 and 200)
);

create table public.profile_achievements (
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  awarded_at     timestamptz not null default now(),
  primary key (profile_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Reputation dimensions (the passport meters), derived not hand-written
-- ---------------------------------------------------------------------------
create table public.reputation_dimensions (
  slug    text primary key,
  name_ar text not null,
  weight  numeric(4,2) not null default 1.00 check (weight > 0)
);

create table public.reputation_scores (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dimension  text not null references public.reputation_dimensions (slug) on delete cascade,
  value      numeric(5,2) not null check (value between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (profile_id, dimension)
);

-- =============================================================================
-- Helper functions (SECURITY DEFINER, empty search_path, fully qualified)
-- These are the single source of truth for authorization across every policy.
-- =============================================================================

-- The profile id of the caller. Profiles share the primary key of auth.users,
-- so this is auth.uid() narrowed to "has an actual profile row".
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = (select auth.uid())
      and pr.role = p_role
      and pr.status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

create or replace function public.is_mentor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('mentor');
$$;

comment on function public.current_profile_id is
  'Caller profile id. Never trust a client-supplied profile id; RLS resolves identity here.';
