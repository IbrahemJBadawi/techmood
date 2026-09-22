-- =============================================================================
-- 0050 — The market's other half: people, teams, and what happens after yes
--
-- 0025 built one side of a marketplace: an opening is posted, somebody applies,
-- and the poster sees the applicant's real record rather than a CV. What it
-- never built is the other three quarters of what a market is.
--
--   * **Nobody can be found.** There is no way to say "I am available", no rate,
--     no services — so a company can post work but cannot look for a person.
--   * **A team cannot be hired**, although teams are the thing this platform
--     is best at making.
--   * **Nothing can be kept** — no saving an opening to come back to.
--   * **Nobody can be asked.** A poster who finds somebody has no way to
--     invite them; they can only wait to be applied to.
--   * **And "accepted" is the end of the road.** The moment somebody says yes,
--     the marketplace forgets them: there is no work, no deliverable, no
--     record that the job was done — which is the very thing the platform is
--     built to prove.
--
-- This migration is the answer to those five, and it builds none of them from
-- scratch: availability hangs off the profile, a team's offer off the team, the
-- work off `projects`, and every signal of trust off records that already exist
-- because somebody earned them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Being findable is a choice, and it is made once
-- ---------------------------------------------------------------------------
create table public.freelancer_profiles (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  is_available  boolean not null default false,
  headline_ar   text,
  summary_ar    text,
  rate_kind     text not null default 'hourly' check (rate_kind in ('hourly', 'project')),
  rate_min_usd  numeric(8,2) check (rate_min_usd >= 0),
  rate_max_usd  numeric(8,2) check (rate_max_usd >= 0),
  languages     text[] not null default '{}',
  updated_at    timestamptz not null default now(),

  constraint freelancer_rate_range check (
    rate_max_usd is null or rate_min_usd is null or rate_max_usd >= rate_min_usd
  )
);

create index freelancer_profiles_available_idx on public.freelancer_profiles (is_available);

create trigger freelancer_profiles_touch before update on public.freelancer_profiles
  for each row execute function public.touch_updated_at();

-- What somebody offers, and from what price. Not a shop: a starting point for
-- a conversation, which is what a rate on a market really is.
create table public.freelancer_services (
  id           uuid primary key default extensions.gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  title_ar     text not null,
  detail_ar    text,
  from_usd     numeric(8,2) check (from_usd >= 0),
  sort_order   integer not null default 0
);

create index freelancer_services_profile_idx on public.freelancer_services (profile_id, sort_order);

alter table public.freelancer_profiles enable row level security;
alter table public.freelancer_services enable row level security;

-- Listed means listed: what an available freelancer publishes is public, and
-- what they have not published is nobody's business.
create policy freelancer_profiles_read on public.freelancer_profiles
  for select to anon, authenticated
  using (is_available or profile_id = (select auth.uid()) or public.is_admin());

create policy freelancer_profiles_own on public.freelancer_profiles
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy freelancer_services_read on public.freelancer_services
  for select to anon, authenticated
  using (exists (
    select 1 from public.freelancer_profiles fp
     where fp.profile_id = freelancer_services.profile_id
       and (fp.is_available or fp.profile_id = (select auth.uid()) or public.is_admin())
  ));

create policy freelancer_services_own on public.freelancer_services
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

grant select on public.freelancer_profiles to anon, authenticated;
grant select on public.freelancer_services to anon, authenticated;
grant insert, update, delete on public.freelancer_profiles to authenticated;
grant insert, update, delete on public.freelancer_services to authenticated;

-- Listing yourself is for accounts that passed the freelancer review; the
-- platform says whose work it will put in front of a paying client.
create or replace function public.enforce_freelancer_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_available and not exists (
    select 1 from public.profile_roles pr
     where pr.profile_id = new.profile_id
       and pr.role = 'freelancer'
       and pr.status = 'approved'
  ) then
    raise exception 'إدراج نفسك في السوق يحتاج دور فريلانسر معتمد';
  end if;

  return new;
end;
$$;

create trigger freelancer_profiles_require_role
  before insert or update on public.freelancer_profiles
  for each row execute function public.enforce_freelancer_listing();

-- ---------------------------------------------------------------------------
-- A team can be hired, too
-- ---------------------------------------------------------------------------
alter table public.teams
  add column offers_services    boolean not null default false,
  add column service_summary_ar text,
  add column rate_from_usd      numeric(10,2) check (rate_from_usd >= 0);

-- ---------------------------------------------------------------------------
-- Keeping something to come back to
-- ---------------------------------------------------------------------------
create table public.market_saves (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  target_kind text not null check (target_kind in ('opportunity', 'talent', 'team')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),

  primary key (profile_id, target_kind, target_id)
);

alter table public.market_saves enable row level security;

-- What somebody saved is theirs alone — not a signal, not a count, not public.
create policy market_saves_own on public.market_saves
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, delete on public.market_saves to authenticated;

-- ---------------------------------------------------------------------------
-- Asking somebody, instead of waiting to be asked
-- ---------------------------------------------------------------------------
create table public.opportunity_invites (
  id             uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  invited_profile uuid references public.profiles (id) on delete cascade,
  invited_team    uuid references public.teams (id) on delete cascade,
  invited_by     uuid not null references public.profiles (id) on delete cascade,
  message_ar     text,
  status         text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,

  constraint invite_has_one_recipient check (
    (invited_profile is not null and invited_team is null) or
    (invited_profile is null and invited_team is not null)
  ),
  unique (opportunity_id, invited_profile, invited_team)
);

create index opportunity_invites_profile_idx on public.opportunity_invites (invited_profile, status);
create index opportunity_invites_team_idx    on public.opportunity_invites (invited_team, status);

alter table public.opportunity_invites enable row level security;

create policy opportunity_invites_read on public.opportunity_invites
  for select to authenticated
  using (
    invited_profile = (select auth.uid())
    or invited_by = (select auth.uid())
    or public.is_admin()
    or (invited_team is not null and public.is_team_member(invited_team))
  );

grant select on public.opportunity_invites to authenticated;

-- ---------------------------------------------------------------------------
-- A proposal is part of an application, not a second object
-- ---------------------------------------------------------------------------
alter table public.opportunity_applications
  add column proposed_amount_usd numeric(10,2) check (proposed_amount_usd >= 0),
  add column proposed_days       integer check (proposed_days between 1 and 365),
  -- what the applicant chose to put in front of this poster
  add column shared_sections     text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- What happens after yes
-- ---------------------------------------------------------------------------
-- An accepted application used to be the end of the road: the marketplace
-- recorded a decision and forgot the work. But the work is the point — it is
-- what a mentor evaluates, what the exhibition shows, and what reputation is
-- built from. So accepting opens a project, and the project is an ordinary
-- TechMood project with tasks, files and a workspace, marked as work done for
-- somebody.
alter table public.projects
  add column opportunity_id   uuid references public.opportunities (id) on delete set null,
  add column client_id        uuid references public.profiles (id) on delete set null,
  add column agreed_amount_usd numeric(10,2) check (agreed_amount_usd >= 0);

create index projects_opportunity_idx on public.projects (opportunity_id);
create index projects_client_idx on public.projects (client_id);

create or replace function public.open_project_for_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_project     uuid;
begin
  if new.stage::text <> 'accepted' or old.stage::text = 'accepted' then
    return new;
  end if;

  select * into v_opportunity from public.opportunities where id = new.opportunity_id;

  -- A team seat is somebody joining a team, not a piece of work being handed
  -- over; the team's own workspace already holds what follows.
  if v_opportunity.kind = 'team_seat' then
    return new;
  end if;

  if exists (select 1 from public.projects p where p.opportunity_id = new.opportunity_id
              and p.owner_id = new.profile_id) then
    return new;
  end if;

  insert into public.projects (
    title_ar, description_ar, owner_id, client_id, opportunity_id,
    status, kind, is_public, agreed_amount_usd
  )
  values (
    v_opportunity.title_ar,
    v_opportunity.description_ar,
    new.profile_id,
    v_opportunity.posted_by,
    v_opportunity.id,
    'planning',
    'client',
    false,
    coalesce(new.proposed_amount_usd, v_opportunity.amount_max, v_opportunity.amount_min)
  )
  returning id into v_project;

  perform public.notify(
    new.profile_id,
    'system',
    'بدأ عملك على: ' || v_opportunity.title_ar,
    'فُتحت مساحة العمل — المهام والملفات والتسليم كلها هنا.',
    '/projects/' || v_project::text
  );

  return new;
end;
$$;

create trigger opportunity_applications_open_project
  after update of stage on public.opportunity_applications
  for each row execute function public.open_project_for_application();

-- ---------------------------------------------------------------------------
-- Inviting, and answering an invitation
-- ---------------------------------------------------------------------------
create or replace function public.invite_to_opportunity(
  p_opportunity uuid,
  p_profile     uuid default null,
  p_team        uuid default null,
  p_message     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := (select auth.uid());
  v_opportunity public.opportunities%rowtype;
  v_invite      uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_opportunity from public.opportunities where id = p_opportunity;
  if not found then
    raise exception 'الفرصة غير موجودة';
  end if;

  if v_opportunity.posted_by <> v_me and not public.is_admin() then
    raise exception 'صاحب الفرصة فقط من يدعو إليها';
  end if;

  if (p_profile is null) = (p_team is null) then
    raise exception 'الدعوة لشخص أو لفريق، لا للاثنين';
  end if;

  -- Somebody who never said they were available is not in this market.
  if p_profile is not null and not exists (
    select 1 from public.freelancer_profiles fp
     where fp.profile_id = p_profile and fp.is_available
  ) then
    raise exception 'هذا الشخص غير مدرج للعمل حالياً';
  end if;

  if p_team is not null and not exists (
    select 1 from public.teams t where t.id = p_team and t.offers_services
  ) then
    raise exception 'هذا الفريق لا يعرض خدماته حالياً';
  end if;

  insert into public.opportunity_invites (opportunity_id, invited_profile, invited_team, invited_by, message_ar)
  values (p_opportunity, p_profile, p_team, v_me, nullif(trim(coalesce(p_message, '')), ''))
  on conflict do nothing
  returning id into v_invite;

  if v_invite is null then
    raise exception 'الدعوة مرسلة بالفعل';
  end if;

  perform public.notify(
    coalesce(p_profile, (select t.leader_id from public.teams t where t.id = p_team)),
    'system',
    'دعوة للعمل على: ' || v_opportunity.title_ar,
    p_message,
    '/marketplace/' || p_opportunity::text
  );

  return v_invite;
end;
$$;

grant execute on function public.invite_to_opportunity(uuid, uuid, uuid, text) to authenticated;

-- Accepting an invitation is applying: the same queue, the same decision, one
-- step further along because somebody asked for you by name.
create or replace function public.respond_to_invite(p_invite uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_invite public.opportunity_invites%rowtype;
begin
  select * into v_invite from public.opportunity_invites where id = p_invite;
  if not found then
    raise exception 'الدعوة غير موجودة';
  end if;

  if v_invite.status <> 'sent' then
    raise exception 'تمّ الردّ على هذه الدعوة';
  end if;

  if v_invite.invited_profile is distinct from v_me
     and not (v_invite.invited_team is not null and public.is_team_leader(v_invite.invited_team)) then
    raise exception 'الدعوة ليست لك';
  end if;

  update public.opportunity_invites
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_invite;

  if not p_accept then
    return;
  end if;

  insert into public.opportunity_applications (opportunity_id, profile_id, cover_note_ar, stage)
  values (v_invite.opportunity_id, v_me,
          coalesce(v_invite.message_ar, 'قبول دعوة'),
          'shortlisted'::public.application_stage)
  on conflict (opportunity_id, profile_id) do nothing;

  perform public.notify(
    v_invite.invited_by,
    'system',
    'قُبلت دعوتك',
    null,
    '/marketplace/' || v_invite.opportunity_id::text
  );
end;
$$;

grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Saving, and unsaving
-- ---------------------------------------------------------------------------
create or replace function public.toggle_market_save(p_kind text, p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  delete from public.market_saves
   where profile_id = v_me and target_kind = p_kind and target_id = p_target;

  if found then
    return false;
  end if;

  insert into public.market_saves (profile_id, target_kind, target_id)
  values (v_me, p_kind, p_target);

  return true;
end;
$$;

grant execute on function public.toggle_market_save(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The market, counted
-- ---------------------------------------------------------------------------
create or replace function public.market_overview()
returns table (jobs integer, freelancers integer, teams integer, companies integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.opportunities o where o.status = 'published'),
    (select count(*)::int from public.freelancer_profiles fp where fp.is_available),
    (select count(*)::int from public.teams t where t.offers_services),
    (select count(distinct pr.profile_id)::int from public.profile_roles pr
      where pr.role = 'company' and pr.status = 'approved');
$$;

grant execute on function public.market_overview() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who is available, with the record they earned
-- ---------------------------------------------------------------------------
-- Everything in a row here was earned somewhere else: the stars from real
-- evaluations, the skills from approved work, the projects from the exhibition.
-- The market shows them; it does not mint them.
create or replace function public.market_talent(
  p_search text default null,
  p_skill  text default null,
  p_limit  integer default 24
)
returns table (
  profile_id     uuid,
  techmood_id    text,
  full_name      text,
  headline       text,
  avatar_url     text,
  rate_kind      text,
  rate_min_usd   numeric,
  rate_max_usd   numeric,
  stars_avg      numeric,
  total_xp       integer,
  skills         text[],
  projects       integer,
  certificates   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.techmood_id,
         p.full_name,
         coalesce(fp.headline_ar, p.headline),
         p.avatar_url,
         fp.rate_kind,
         fp.rate_min_usd,
         fp.rate_max_usd,
         coalesce((select ps.stars_avg from public.profile_stars ps where ps.profile_id = p.id), 0),
         coalesce((select px.total_xp from public.profile_xp px where px.profile_id = p.id), 0),
         coalesce((
           select array_agg(s.name_ar order by s.name_ar)
             from public.profile_skills psk
             join public.skills s on s.id = psk.skill_id
            where psk.profile_id = p.id
         ), '{}'),
         (select count(*)::int from public.profile_exhibition_entries(p.id)),
         (select count(*)::int from public.certificates c
           where c.profile_id = p.id and c.status = 'active')
    from public.freelancer_profiles fp
    join public.profiles p on p.id = fp.profile_id
   where fp.is_available
     and (p_search is null or p_search = ''
          or p.full_name ilike '%' || p_search || '%'
          or coalesce(fp.headline_ar, p.headline, '') ilike '%' || p_search || '%')
     and (p_skill is null or p_skill = '' or exists (
       select 1 from public.profile_skills psk
         join public.skills s on s.id = psk.skill_id
        where psk.profile_id = p.id
          and (s.slug = p_skill or s.name_ar = p_skill or s.name_en = p_skill)
     ))
   order by coalesce((select ps.stars_avg from public.profile_stars ps where ps.profile_id = p.id), 0) desc,
            p.full_name
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

grant execute on function public.market_talent(text, text, integer) to authenticated;

-- Teams that say they take work.
create or replace function public.market_teams(p_search text default null, p_limit integer default 24)
returns table (
  team_id       uuid,
  title_ar      text,
  summary_ar    text,
  rate_from_usd numeric,
  members       integer,
  stars_avg     numeric,
  projects      integer,
  needs         text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         t.title_ar,
         coalesce(t.service_summary_ar, t.description_ar),
         t.rate_from_usd,
         (select count(*)::int from public.team_members tm where tm.team_id = t.id and tm.is_active),
         coalesce((select ts.stars_avg from public.team_stars ts where ts.team_id = t.id), 0),
         (select count(*)::int from public.projects pj where pj.team_id = t.id),
         t.needs
    from public.teams t
   where t.offers_services
     and (p_search is null or p_search = ''
          or t.title_ar ilike '%' || p_search || '%'
          or coalesce(t.service_summary_ar, t.description_ar, '') ilike '%' || p_search || '%')
   order by coalesce((select ts.stars_avg from public.team_stars ts where ts.team_id = t.id), 0) desc, t.title_ar
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

grant execute on function public.market_teams(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Why anybody should believe a row in this market
-- ---------------------------------------------------------------------------
-- Not one word "verified". Each signal names what was checked and counts the
-- records behind it, so a reader can disagree with it.
create or replace function public.trust_signals(p_profile uuid)
returns table (signal text, label_ar text, count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select 'skills', 'مهارات موثّقة بعمل مُقيَّم',
         (select count(*)::int from public.profile_skills ps where ps.profile_id = p_profile)
  union all
  select 'certificates', 'شهادات صادرة عن TechMood',
         (select count(*)::int from public.certificates c
           where c.profile_id = p_profile and c.status = 'active')
  union all
  select 'exhibited', 'مشاريع معروضة بعد تقييم',
         (select count(*)::int from public.profile_exhibition_entries(p_profile))
  union all
  select 'evaluations', 'تقييمات منتور على أعمال مُسلَّمة',
         (select count(*)::int from public.evaluations ev
           join public.submissions s on s.id = ev.submission_id
          where s.profile_id = p_profile and ev.decision = 'approved')
  union all
  select 'client_work', 'أعمال أُنجزت لعملاء داخل المنصة',
         (select count(*)::int from public.projects pj
           where pj.owner_id = p_profile and pj.kind = 'client' and pj.status = 'completed');
$$;

grant execute on function public.trust_signals(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- What an opening asks for, and where to learn it
-- ---------------------------------------------------------------------------
-- The loop this platform is built on, closed: an opening names skills, the
-- academy teaches them, and the person reading the opening is shown the way
-- from one to the other instead of being told they do not qualify.
create or replace function public.opportunity_learning(p_opportunity uuid)
returns table (path_id uuid, slug text, title_ar text, teaches text[])
language sql
stable
security definer
set search_path = ''
as $$
  with wanted as (
    select unnest(o.required_skills) as skill_name
      from public.opportunities o where o.id = p_opportunity
  ),
  mine as (
    select s.name_en, s.name_ar
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
     where ps.profile_id = (select auth.uid())
  ),
  missing as (
    select w.skill_name from wanted w
     where not exists (select 1 from mine m where m.name_en = w.skill_name or m.name_ar = w.skill_name)
  )
  select lp.id, lp.slug, lp.title_ar,
         array_agg(distinct sk.name_ar)
    from public.learning_paths lp
    join public.path_courses pc on pc.path_id = lp.id
    join public.courses c on c.id = pc.course_id
    join public.modules m on m.course_id = c.id
    join public.lessons l on l.module_id = m.id
    join public.lesson_skills ls on ls.lesson_id = l.id
    join public.skills sk on sk.id = ls.skill_id
   where lp.status = 'published'
     and (sk.name_en in (select skill_name from missing)
          or sk.name_ar in (select skill_name from missing))
   group by lp.id, lp.slug, lp.title_ar
   order by count(distinct sk.id) desc
   limit 4;
$$;

grant execute on function public.opportunity_learning(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One person's market, in one read
-- ---------------------------------------------------------------------------
create or replace function public.my_market()
returns table (
  bucket    text,
  item_id   uuid,
  title_ar  text,
  detail_ar text,
  state     text,
  link      text,
  at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)

  select 'application', a.id, o.title_ar, o.organization_ar, a.stage::text,
         '/marketplace/' || o.id::text, a.created_at
    from public.opportunity_applications a
    join public.opportunities o on o.id = a.opportunity_id
    cross join me
   where a.profile_id = me.id

  union all

  select 'invite', i.id, o.title_ar, i.message_ar, i.status,
         '/marketplace/' || o.id::text, i.created_at
    from public.opportunity_invites i
    join public.opportunities o on o.id = i.opportunity_id
    cross join me
   where i.invited_profile = me.id
      or (i.invited_team is not null and public.is_team_leader(i.invited_team))

  union all

  select 'work', pj.id, pj.title_ar, pj.description_ar, pj.status::text,
         '/projects/' || pj.id::text, pj.created_at
    from public.projects pj
    cross join me
   where pj.kind = 'client'
     and (pj.owner_id = me.id or pj.client_id = me.id
          or (pj.team_id is not null and public.is_team_member(pj.team_id)))

  union all

  select 'saved', ms.target_id,
         case ms.target_kind
           when 'opportunity' then (select o.title_ar from public.opportunities o where o.id = ms.target_id)
           when 'team'        then (select t.title_ar from public.teams t where t.id = ms.target_id)
           else (select p.full_name from public.profiles p where p.id = ms.target_id)
         end,
         ms.target_kind,
         'saved',
         case ms.target_kind
           when 'opportunity' then '/marketplace/' || ms.target_id::text
           when 'team'        then '/teams/' || ms.target_id::text
           else '/u/' || coalesce((select p.techmood_id from public.profiles p where p.id = ms.target_id), '')
         end,
         ms.created_at
    from public.market_saves ms
    cross join me
   where ms.profile_id = me.id

  order by 7 desc;
$$;

comment on function public.my_market is
  'Applications, invitations, work and saved things — one person''s side of the market, gathered.';

grant execute on function public.my_market() to authenticated;
