-- =============================================================================
-- 0042 — The profile becomes a professional identity, in three layers
--
-- Today a profile is one row with three link columns and a single boolean:
-- is_public, all or nothing. That answers "may anyone see me" and nothing
-- else, while the thing being asked for is a professional identity with a
-- public face, a deeper layer for the people who need it, and an account that
-- nobody else ever sees.
--
-- So visibility stops being a boolean and becomes a decision per section:
--
--   public       — anyone, signed in or not
--   professional — signed-in members who carry an approved working role
--                  (a mentor, a team leader, a company, a founder) and admins
--   private      — the owner and admins only
--
-- profiles.is_public stays and still wins: a profile switched off publishes
-- nothing, whatever its sections say. The per-section setting narrows, never
-- widens — one switch to disappear, and finer control when you are visible.
--
-- Three lists join it, because a professional record needs them and the
-- profile had nowhere to put them: external profiles (the three URL columns
-- could hold GitHub, LinkedIn and one website, and nothing else), education,
-- and experience. And external exhibitions, which are the one thing here a
-- person can claim about themselves — so they arrive unverified and an admin
-- has to confirm them before they read as anything.
-- =============================================================================

create type public.profile_audience as enum ('public', 'professional', 'private');

create type public.profile_section as enum (
  'about', 'identity', 'stats', 'skills', 'achievements', 'certificates',
  'learning', 'projects', 'evaluations', 'teams', 'experience', 'education',
  'links', 'external_exhibitions'
);

create table public.profile_section_visibility (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  section    public.profile_section not null,
  audience   public.profile_audience not null default 'public',

  primary key (profile_id, section)
);

alter table public.profile_section_visibility enable row level security;

create policy profile_section_visibility_read on public.profile_section_visibility
  for select to anon, authenticated using (true);

create policy profile_section_visibility_own on public.profile_section_visibility
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

grant select on public.profile_section_visibility to anon, authenticated;
grant insert, update, delete on public.profile_section_visibility to authenticated;

comment on table public.profile_section_visibility is
  'Who sees which part of a profile. A row is only needed to narrow a section; anything unset is public, and profiles.is_public still overrides everything.';

-- ---------------------------------------------------------------------------
-- Who is looking
-- ---------------------------------------------------------------------------
-- The professional layer is not "signed in". It is somebody who carries a
-- working role on the platform — a mentor, a team leader, a company, a founder
-- — because those are the people who have a reason to read a deeper record.
create or replace function public.is_professional_viewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_roles pr
     where pr.profile_id = (select auth.uid())
       and pr.status = 'approved'
       and pr.role in ('mentor', 'team_leader', 'company', 'founder')
  );
$$;

grant execute on function public.is_professional_viewer() to authenticated;

-- May the caller see this section of this profile?
create or replace function public.can_see_profile_section(
  p_profile uuid,
  p_section public.profile_section
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_profile = (select auth.uid()) then true
    when public.is_admin() then true
    when not (select is_public from public.profiles where id = p_profile) then false
    else coalesce(
      (select v.audience from public.profile_section_visibility v
        where v.profile_id = p_profile and v.section = p_section),
      'public'::public.profile_audience
    ) = 'public'
      or (coalesce(
            (select v.audience from public.profile_section_visibility v
              where v.profile_id = p_profile and v.section = p_section),
            'public'::public.profile_audience
          ) = 'professional' and public.is_professional_viewer())
  end;
$$;

comment on function public.can_see_profile_section is
  'The one place the three layers are decided. Every profile query asks it rather than reimplementing the rule.';

grant execute on function public.can_see_profile_section(uuid, public.profile_section) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- External profiles: a list, not three columns
-- ---------------------------------------------------------------------------
create type public.link_kind as enum (
  'linkedin', 'github', 'behance', 'dribbble', 'kaggle', 'youtube',
  'portfolio', 'website', 'x', 'other'
);

create table public.profile_links (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       public.link_kind not null,
  label      text,
  url        text not null,
  sort_order integer not null default 0,

  unique (profile_id, kind, url),
  constraint profile_links_url_is_http check (url ~* '^https?://')
);

create index profile_links_profile_idx on public.profile_links (profile_id, sort_order);

-- The three columns move into the list they should always have been.
insert into public.profile_links (profile_id, kind, url, sort_order)
select id, 'github', github_url, 1 from public.profiles
 where github_url is not null and github_url ~* '^https?://'
on conflict do nothing;

insert into public.profile_links (profile_id, kind, url, sort_order)
select id, 'linkedin', linkedin_url, 2 from public.profiles
 where linkedin_url is not null and linkedin_url ~* '^https?://'
on conflict do nothing;

insert into public.profile_links (profile_id, kind, url, sort_order)
select id, 'website', website_url, 3 from public.profiles
 where website_url is not null and website_url ~* '^https?://'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Education and experience
-- ---------------------------------------------------------------------------
create table public.profile_education (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  degree      text,
  field       text,
  started_on  date,
  ended_on    date,
  is_current  boolean not null default false,

  constraint profile_education_dates check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index profile_education_profile_idx on public.profile_education (profile_id, started_on desc);

create type public.experience_kind as enum ('job', 'freelance', 'volunteer', 'internship', 'techmood');

create table public.profile_experience (
  id           uuid primary key default extensions.gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  organisation text not null,
  title        text not null,
  kind         public.experience_kind not null default 'job',
  summary      text,
  started_on   date,
  ended_on     date,
  is_current   boolean not null default false,

  constraint profile_experience_dates check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index profile_experience_profile_idx on public.profile_experience (profile_id, started_on desc);

-- ---------------------------------------------------------------------------
-- External exhibitions: the one thing a person claims about themselves
-- ---------------------------------------------------------------------------
-- Everything else on a TechMood profile is a fact the platform recorded: an
-- approved submission, an issued certificate, a published project. This is
-- not — it happened somewhere else — so it arrives as a claim and reads as
-- one until an admin has looked at the evidence.
create table public.external_exhibitions (
  id           uuid primary key default extensions.gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  organiser    text,
  role_ar      text,
  result_ar    text,
  evidence_url text,
  held_on      date,
  status       public.taxonomy_status not null default 'pending_review',
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now(),

  constraint external_exhibitions_evidence_is_http
    check (evidence_url is null or evidence_url ~* '^https?://')
);

create index external_exhibitions_review_idx on public.external_exhibitions (status)
  where status = 'pending_review';

alter table public.profile_links         enable row level security;
alter table public.profile_education     enable row level security;
alter table public.profile_experience    enable row level security;
alter table public.external_exhibitions  enable row level security;

-- Each list is readable when its section is, and written only by its owner.
create policy profile_links_read on public.profile_links
  for select to anon, authenticated
  using (public.can_see_profile_section(profile_id, 'links'));
create policy profile_links_own on public.profile_links
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy profile_education_read on public.profile_education
  for select to anon, authenticated
  using (public.can_see_profile_section(profile_id, 'education'));
create policy profile_education_own on public.profile_education
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy profile_experience_read on public.profile_experience
  for select to anon, authenticated
  using (public.can_see_profile_section(profile_id, 'experience'));
create policy profile_experience_own on public.profile_experience
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- A claim that has not been checked is visible to its owner and to the admins
-- who check it. Nobody else sees it at all until it is verified.
create policy external_exhibitions_read on public.external_exhibitions
  for select to anon, authenticated
  using (
    (status = 'approved' and public.can_see_profile_section(profile_id, 'external_exhibitions'))
    or profile_id = (select auth.uid())
    or public.is_admin()
  );
create policy external_exhibitions_own on public.external_exhibitions
  for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy external_exhibitions_edit on public.external_exhibitions
  for update to authenticated
  using (profile_id = (select auth.uid()) and status <> 'approved')
  with check (profile_id = (select auth.uid()) and status <> 'approved');
create policy external_exhibitions_delete on public.external_exhibitions
  for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

grant select on public.profile_links, public.profile_education,
                public.profile_experience, public.external_exhibitions to anon, authenticated;
grant insert, update, delete on public.profile_links, public.profile_education,
                public.profile_experience, public.external_exhibitions to authenticated;

-- Verifying is an admin act, like every other verification on the platform.
create or replace function public.review_external_exhibition(
  p_entry   uuid,
  p_approve boolean,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'مراجعة المشاركات الخارجية للإدارة فقط';
  end if;

  update public.external_exhibitions
     set status = case when p_approve then 'approved' else 'rejected' end::public.taxonomy_status,
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         review_note = p_note
   where id = p_entry;
end;
$$;

grant execute on function public.review_external_exhibition(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The card: one row, everything the hero shows
-- ---------------------------------------------------------------------------
-- Every number here is counted from what the platform recorded — approved
-- work, issued certificates, published projects, completed sessions — so the
-- card cannot say more than the record does. It is one query because it is the
-- first thing on the page and the thing people share.
create or replace function public.profile_card(p_techmood_id text)
returns table (
  profile_id     uuid,
  techmood_id    text,
  full_name      text,
  display_name   text,
  username       text,
  headline       text,
  bio            text,
  avatar_url     text,
  primary_field  text,
  level_no       integer,
  level_title    text,
  points         integer,
  stars_avg      numeric,
  rated_count    integer,
  projects       integer,
  certificates   integer,
  courses_done   integer,
  paths_done     integer,
  sessions       integer,
  teams          integer,
  achievements   integer,
  skills_proven  integer,
  updated_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.* from public.profiles p
     where upper(p.techmood_id) = upper(trim(p_techmood_id))
       and (p.is_public or p.id = (select auth.uid()) or public.is_admin())
  ),
  xp as (select coalesce(sum(e.xp), 0)::int as total from public.xp_events e, me where e.profile_id = me.id)
  select me.id,
         me.techmood_id,
         me.full_name,
         me.display_name,
         me.username,
         me.headline,
         case when public.can_see_profile_section(me.id, 'about') then me.bio end,
         me.avatar_url,
         (select f.name_ar from public.profile_fields pf
            join public.fields f on f.id = pf.field_id
           where pf.profile_id = me.id and pf.is_primary),
         (select l.sort_order from public.xp_levels l
           where l.min_xp <= (select total from xp) order by l.min_xp desc limit 1),
         (select l.title_ar from public.xp_levels l
           where l.min_xp <= (select total from xp) order by l.min_xp desc limit 1),
         (select total from xp),
         (select round(avg(ev.stars)::numeric, 1) from public.evaluations ev
            join public.submissions s on s.id = ev.submission_id
           where s.profile_id = me.id and ev.decision = 'approved' and ev.stars is not null),
         (select count(*)::int from public.evaluations ev
            join public.submissions s on s.id = ev.submission_id
           where s.profile_id = me.id and ev.decision = 'approved' and ev.stars is not null),
         (select count(*)::int from public.profile_exhibition_entries(me.id)),
         (select count(*)::int from public.certificates c
           where c.profile_id = me.id and c.status = 'active'),
         (select count(*)::int from public.certificates c
           where c.profile_id = me.id and c.status = 'active' and c.kind = 'course'),
         (select count(*)::int from public.certificates c
           where c.profile_id = me.id and c.status = 'active' and c.kind = 'path'),
         (select count(*)::int from public.bookings b
           where b.student_id = me.id and b.status = 'completed'),
         (select count(*)::int from public.team_members tm
           where tm.profile_id = me.id and tm.is_active),
         (select count(*)::int from public.profile_achievements pa where pa.profile_id = me.id),
         (select count(*)::int from public.profile_skills ps
           where ps.profile_id = me.id and ps.is_verified),
         me.updated_at
    from me;
$$;

comment on function public.profile_card is
  'The hero of a profile, and the card people share. Every number is counted from the record, so the card cannot claim more than the platform can show.';

grant execute on function public.profile_card(text) to anon, authenticated;

-- What a mentor's review says about somebody, without the session behind it.
-- The dimensions are the platform's own; the comments stay where they were
-- written, which is between the learner and the person who wrote them.
create or replace function public.profile_reputation(p_profile uuid)
returns table (dimension text, name_ar text, value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select rs.dimension, rd.name_ar, rs.value
    from public.reputation_scores rs
    join public.reputation_dimensions rd on rd.slug = rs.dimension
   where rs.profile_id = p_profile
     and public.can_see_profile_section(p_profile, 'evaluations')
   order by rd.weight desc;
$$;

grant execute on function public.profile_reputation(uuid) to anon, authenticated;
