-- =============================================================================
-- TechMood — 0025 Marketplace
--
-- Fixes two holes and builds the half that was missing.
--
--   HOLE 1: opportunities_write let any authenticated account post a job. A
--   plain student could advertise a paid position with nobody reviewing them.
--   Roles exist precisely because hiring and paying people needs review, so
--   posting now requires a reviewed role — and a team seat requires leading
--   that team.
--
--   HOLE 2: opportunity_applications had no UPDATE policy at all, so a poster
--   could never accept or decline anyone. Applications were write-once and
--   undecidable.
--
-- The thing that makes this marketplace different from a job board is that an
-- applicant arrives with a record: XP, stars, certificates, published work. A
-- poster sees that evidence — and only for people who actually applied to them.
-- =============================================================================

create type public.compensation_kind as enum (
  'fixed', 'hourly', 'monthly', 'equity', 'revenue_share', 'unpaid'
);

create type public.application_stage as enum (
  'submitted', 'shortlisted', 'accepted', 'declined', 'withdrawn'
);

-- ---------------------------------------------------------------------------
-- Opportunities gain the detail a real listing needs
-- ---------------------------------------------------------------------------
alter table public.opportunities
  add column compensation_kind public.compensation_kind,
  add column amount_min    numeric(10,2) check (amount_min >= 0),
  add column amount_max    numeric(10,2) check (amount_max >= 0),
  add column currency      text not null default 'USD',
  add column location_ar   text,
  add column is_remote     boolean not null default false,
  add column closes_on     date,
  add column seats         integer not null default 1 check (seats between 1 and 50),
  add column filled_count  integer not null default 0 check (filled_count >= 0),
  -- advisory, never a gate: see apply_to_opportunity()
  add column required_skills text[] not null default '{}',
  add column min_stars     numeric(2,1) check (min_stars between 0 and 5),
  add column required_path_id uuid references public.learning_paths (id) on delete set null,
  add column updated_at    timestamptz not null default now(),

  add constraint opportunities_amount_range check (amount_max is null or amount_min is null or amount_max >= amount_min),
  add constraint opportunities_seats_not_overfilled check (filled_count <= seats);

create trigger opportunities_touch before update on public.opportunities
  for each row execute function public.touch_updated_at();

create index opportunities_open_idx on public.opportunities (kind, created_at desc)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- Applications get a real lifecycle and a decision trail
-- ---------------------------------------------------------------------------
alter table public.opportunity_applications
  add column stage         public.application_stage not null default 'submitted',
  add column decided_by    uuid references public.profiles (id) on delete set null,
  add column decided_at    timestamptz,
  add column decision_note_ar text,
  -- a team seat is decided in the team, not in a second place
  add column team_application_id uuid references public.team_applications (id) on delete set null;

update public.opportunity_applications
   set stage = case status
                 when 'accepted' then 'accepted'
                 when 'declined' then 'declined'
                 when 'withdrawn' then 'withdrawn'
                 else 'submitted'
               end::public.application_stage;

alter table public.opportunity_applications drop column status;

create index opportunity_applications_stage_idx on public.opportunity_applications (opportunity_id, stage);

-- ---------------------------------------------------------------------------
-- Who may post what
-- ---------------------------------------------------------------------------
create or replace function public.can_post_opportunity(
  p_kind public.opportunity_kind,
  p_team uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- a seat on a team is offered by whoever leads that team
    when p_kind = 'team_seat' then p_team is not null and public.is_team_leader(p_team)
    -- looking for a co-founder is a founder's business
    when p_kind = 'cofounder' then public.has_role('founder') or public.has_role('company')
    -- paid work is posted by accounts that passed review
    else public.has_role('company')
      or public.has_role('founder')
      or public.has_role('team_leader')
      or public.has_role('freelancer')
  end or public.is_admin();
$$;

comment on function public.can_post_opportunity is
  'A student-only account consumes the marketplace; posting requires a reviewed '
  'role. That is what role review is for.';

-- ---------------------------------------------------------------------------
-- How well an applicant matches — advisory, and deliberately not a gate.
--
-- A platform whose point is growth must not tell someone they are not allowed
-- to try. The requirements are shown to both sides honestly; the human decides.
-- ---------------------------------------------------------------------------
create or replace function public.opportunity_match(p_opportunity uuid, p_profile uuid)
returns table (
  meets_stars     boolean,
  meets_path      boolean,
  matched_skills  text[],
  missing_skills  text[],
  profile_stars   numeric,
  profile_xp      integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select required_skills, min_stars, required_path_id
    from public.opportunities where id = p_opportunity
  ),
  me as (
    select coalesce((select stars_avg from public.profile_stars where profile_id = p_profile), 0) as stars,
           coalesce((select total_xp  from public.profile_xp    where profile_id = p_profile), 0) as xp,
           coalesce((
             select array_agg(distinct s.name_en)
             from public.profile_skills ps
             join public.skills s on s.id = ps.skill_id
             where ps.profile_id = p_profile
           ), '{}') as skills
  )
  select
    o.min_stars is null or me.stars >= o.min_stars,
    o.required_path_id is null or exists (
      select 1 from public.certificates c
      where c.profile_id = p_profile
        and c.path_id = o.required_path_id
        and c.status = 'active'
    ),
    coalesce((select array_agg(r) from unnest(o.required_skills) r where r = any (me.skills)), '{}'),
    coalesce((select array_agg(r) from unnest(o.required_skills) r where not (r = any (me.skills))), '{}'),
    me.stars,
    me.xp
  from o, me;
$$;

-- ---------------------------------------------------------------------------
-- Applying. A team seat routes into the team's own application queue rather
-- than opening a second place where the same decision gets made.
-- ---------------------------------------------------------------------------
create or replace function public.apply_to_opportunity(p_opportunity uuid, p_cover text default null)
returns public.opportunity_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := (select auth.uid());
  v_opportunity public.opportunities%rowtype;
  v_team_app    uuid;
  v_application public.opportunity_applications%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_opportunity from public.opportunities where id = p_opportunity;
  if not found then
    raise exception 'opportunity % not found', p_opportunity;
  end if;

  if v_opportunity.status <> 'published' then
    raise exception 'this opportunity is not open for applications';
  end if;

  if v_opportunity.closes_on is not null and v_opportunity.closes_on < current_date then
    raise exception 'applications for this opportunity have closed';
  end if;

  if v_opportunity.filled_count >= v_opportunity.seats then
    raise exception 'this opportunity has been filled';
  end if;

  if v_opportunity.posted_by = v_me then
    raise exception 'you cannot apply to your own posting';
  end if;

  -- A team seat is the team's decision, made where the leader already works.
  if v_opportunity.kind = 'team_seat' and v_opportunity.team_id is not null then
    if public.is_team_member(v_opportunity.team_id) then
      raise exception 'you are already a member of this team';
    end if;

    insert into public.team_applications (team_id, profile_id, role_wanted, message_ar)
    values (v_opportunity.team_id, v_me, v_opportunity.title_ar, p_cover)
    on conflict (team_id, profile_id) do update set message_ar = excluded.message_ar
    returning id into v_team_app;
  end if;

  insert into public.opportunity_applications
    (opportunity_id, profile_id, cover_note_ar, team_application_id)
  values (p_opportunity, v_me, p_cover, v_team_app)
  returning * into v_application;

  perform public.notify(
    v_opportunity.posted_by,
    'system',
    'طلب جديد على: ' || v_opportunity.title_ar,
    null,
    '/marketplace/' || p_opportunity
  );

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deciding. Only the poster (or an admin) moves an application forward.
-- ---------------------------------------------------------------------------
create or replace function public.decide_opportunity_application(
  p_application uuid,
  p_stage       public.application_stage,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.opportunity_applications%rowtype;
  v_opportunity public.opportunities%rowtype;
begin
  select * into v_application from public.opportunity_applications where id = p_application;
  if not found then
    raise exception 'application % not found', p_application;
  end if;

  select * into v_opportunity from public.opportunities where id = v_application.opportunity_id;

  -- The applicant may withdraw; everything else belongs to the poster.
  if p_stage = 'withdrawn' then
    if v_application.profile_id is distinct from (select auth.uid()) then
      raise exception 'only the applicant may withdraw their application';
    end if;
  elsif v_opportunity.posted_by is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'only the poster may decide this application';
  end if;

  update public.opportunity_applications
     set stage = p_stage,
         decided_by = (select auth.uid()),
         decided_at = now(),
         decision_note_ar = p_note
   where id = p_application;

  if p_stage = 'accepted' then
    update public.opportunities
       set filled_count = filled_count + 1,
           status = case when filled_count + 1 >= seats then 'archived' else status end
     where id = v_application.opportunity_id;
  end if;

  if p_stage in ('shortlisted', 'accepted', 'declined') then
    perform public.notify(
      v_application.profile_id,
      'system',
      case p_stage
        when 'shortlisted' then 'وصل طلبك إلى القائمة المختصرة: ' || v_opportunity.title_ar
        when 'accepted'    then 'قُبل طلبك على: ' || v_opportunity.title_ar
        else 'لم يُقبل طلبك على: ' || v_opportunity.title_ar
      end,
      p_note,
      '/marketplace/' || v_application.opportunity_id
    );
  end if;
end;
$$;

-- A team seat decided inside the team flows back to the marketplace record, so
-- the applicant does not see two different answers to the same question.
create or replace function public.sync_team_application_to_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  update public.opportunity_applications
     set stage = case new.status
                   when 'accepted' then 'accepted'
                   when 'declined' then 'declined'
                   when 'withdrawn' then 'withdrawn'
                   else 'submitted'
                 end::public.application_stage,
         decided_by = new.decided_by,
         decided_at = new.decided_at
   where team_application_id = new.id;

  return new;
end;
$$;

create trigger team_applications_sync_marketplace
  after update of status on public.team_applications
  for each row execute function public.sync_team_application_to_opportunity();

-- ---------------------------------------------------------------------------
-- What a poster may see about someone who applied to them, and no one else.
-- ---------------------------------------------------------------------------
create or replace function public.applicant_evidence(p_application uuid)
returns table (
  full_name       text,
  techmood_id     text,
  headline        text,
  github_url      text,
  linkedin_url    text,
  total_xp        integer,
  stars_avg       numeric,
  certificates    integer,
  published_work  integer,
  approved_submissions integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_application public.opportunity_applications%rowtype;
  v_posted_by   uuid;
begin
  select * into v_application from public.opportunity_applications where id = p_application;
  if not found then
    raise exception 'application % not found', p_application;
  end if;

  select posted_by into v_posted_by from public.opportunities where id = v_application.opportunity_id;

  -- The evidence is visible because they applied to you, not because you asked.
  if v_posted_by is distinct from (select auth.uid())
     and v_application.profile_id is distinct from (select auth.uid())
     and not public.is_admin() then
    raise exception 'you may only view evidence for applications made to you';
  end if;

  return query
  select p.full_name,
         p.techmood_id,
         p.headline,
         p.github_url,
         p.linkedin_url,
         coalesce((select x.total_xp from public.profile_xp x where x.profile_id = p.id), 0),
         coalesce((select s.stars_avg from public.profile_stars s where s.profile_id = p.id), 0),
         (select count(*)::integer from public.certificates c
           where c.profile_id = p.id and c.status = 'active'),
         (select count(*)::integer from public.profile_exhibition_entries(p.id)),
         (select count(*)::integer from public.submissions sub
           where sub.profile_id = p.id and sub.status = 'approved')
  from public.profiles p
  where p.id = v_application.profile_id;
end;
$$;

-- =============================================================================
-- Authorization
-- =============================================================================
drop policy opportunities_write on public.opportunities;

create policy opportunities_create on public.opportunities
  for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and public.can_post_opportunity(kind, team_id)
  );

create policy opportunities_manage on public.opportunities
  for update to authenticated
  using (posted_by = (select auth.uid()) or public.is_admin())
  with check (posted_by = (select auth.uid()) or public.is_admin());

create policy opportunities_remove on public.opportunities
  for delete to authenticated
  using (posted_by = (select auth.uid()) or public.is_admin());

-- The missing half: a poster can now actually decide.
create policy opportunity_applications_decide on public.opportunity_applications
  for update to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.opportunities o
               where o.id = opportunity_id and o.posted_by = (select auth.uid()))
    or public.is_admin()
  )
  with check (
    profile_id = (select auth.uid())
    or exists (select 1 from public.opportunities o
               where o.id = opportunity_id and o.posted_by = (select auth.uid()))
    or public.is_admin()
  );

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.can_post_opportunity(public.opportunity_kind, uuid)  to authenticated;
grant execute on function public.opportunity_match(uuid, uuid)                        to authenticated;
grant execute on function public.apply_to_opportunity(uuid, text)                     to authenticated;
grant execute on function public.decide_opportunity_application(uuid, public.application_stage, text) to authenticated;
grant execute on function public.applicant_evidence(uuid)                             to authenticated;
