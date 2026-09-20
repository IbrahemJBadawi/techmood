-- =============================================================================
-- TechMood — 0008 Teams, projects, marketplace, incubator
-- =============================================================================

create table public.teams (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  title_ar    text not null,
  description_ar text,
  leader_id   uuid not null references public.profiles (id) on delete restrict,
  -- open roles the team is recruiting for
  needs       text[] not null default '{}',
  is_open     boolean not null default true,
  -- a team may exist to deliver a path's group project
  path_id     uuid references public.learning_paths (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       public.team_member_role not null default 'member',
  title_ar   text,
  joined_at  timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create index team_members_profile_idx on public.team_members (profile_id);

-- Now that teams exist, close the two forward references left earlier.
alter table public.submissions
  add constraint submissions_team_fk
  foreign key (team_id) references public.teams (id) on delete set null;

alter table public.bookings
  add constraint bookings_team_fk
  foreign key (team_id) references public.teams (id) on delete set null;

alter table public.call_sessions
  add constraint call_sessions_team_fk
  foreign key (team_id) references public.teams (id) on delete cascade;

-- Membership helper, used by RLS from here on.
create or replace function public.is_team_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team and tm.profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_team_leader(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team and t.leader_id = (select auth.uid())
  );
$$;

create table public.team_applications (
  id          uuid primary key default extensions.gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role_wanted text,
  message_ar  text,
  status      public.team_application_status not null default 'pending',
  decided_by  uuid references public.profiles (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),

  unique (team_id, profile_id)
);

create index team_applications_pending_idx on public.team_applications (team_id)
  where status = 'pending';

-- Accepting an application is the only way to gain membership.
create or replace function public.decide_team_application(p_application_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.team_applications%rowtype;
begin
  select * into v_app from public.team_applications where id = p_application_id;
  if not found then
    raise exception 'application % not found', p_application_id;
  end if;

  if not (public.is_team_leader(v_app.team_id) or public.is_admin()) then
    raise exception 'only the team leader may decide join requests';
  end if;

  update public.team_applications
     set status = case when p_accept then 'accepted' else 'declined' end::public.team_application_status,
         decided_by = (select auth.uid()),
         decided_at = now()
   where id = p_application_id;

  if p_accept then
    insert into public.team_members (team_id, profile_id, role, title_ar)
    values (v_app.team_id, v_app.profile_id, 'member', v_app.role_wanted)
    on conflict (team_id, profile_id) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Team workspace (kanban)
-- ---------------------------------------------------------------------------
create table public.team_tasks (
  id          uuid primary key default extensions.gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  title_ar    text not null,
  column_key  public.team_task_column not null default 'todo',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_on      date,
  sort_order  integer not null default 0,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index team_tasks_board_idx on public.team_tasks (team_id, column_key, sort_order);

create trigger team_tasks_touch before update on public.team_tasks
  for each row execute function public.touch_updated_at();

create table public.team_reviews (
  id         uuid primary key default extensions.gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  comment_ar text,
  created_at timestamptz not null default now(),

  unique (team_id, mentor_id)
);

-- ---------------------------------------------------------------------------
-- Projects & portfolio
-- ---------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default extensions.gen_random_uuid(),
  code        text not null unique default ('TMP-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6))),
  title_ar    text not null,
  description_ar text,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete set null,
  path_id     uuid references public.learning_paths (id) on delete set null,
  status      public.project_status not null default 'planning',
  tags        text[] not null default '{}',
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id);
create index projects_team_idx  on public.projects (team_id);

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create table public.project_milestones (
  id          uuid primary key default extensions.gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title_ar    text not null,
  description_ar text,
  is_done     boolean not null default false,
  due_on      date,
  sort_order  integer not null default 0
);

-- Proof attached to a project: repo, demo video, live site, design file.
create table public.project_evidence (
  id         uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind       public.evidence_kind not null,
  url        text not null,
  label      text,
  created_at timestamptz not null default now(),

  constraint project_evidence_url_is_http check (url ~* '^https?://')
);

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id             uuid primary key default extensions.gen_random_uuid(),
  kind           public.opportunity_kind not null,
  title_ar       text not null,
  organization_ar text,
  description_ar text,
  tags           text[] not null default '{}',
  compensation_ar text,
  posted_by      uuid not null references public.profiles (id) on delete cascade,
  team_id        uuid references public.teams (id) on delete cascade,
  status         public.content_status not null default 'published',
  created_at     timestamptz not null default now()
);

create index opportunities_kind_idx on public.opportunities (kind, status);

create table public.opportunity_applications (
  id             uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  cover_note_ar  text,
  status         public.team_application_status not null default 'pending',
  created_at     timestamptz not null default now(),

  unique (opportunity_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Incubator / startups
-- ---------------------------------------------------------------------------
create table public.startups (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name_ar     text not null,
  description_ar text,
  founder_id  uuid not null references public.profiles (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete set null,
  stage       public.startup_stage not null default 'idea',
  users_count integer not null default 0 check (users_count >= 0),
  is_in_incubator boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger startups_touch before update on public.startups
  for each row execute function public.touch_updated_at();

create table public.incubator_applications (
  id         uuid primary key default extensions.gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  pitch_ar   text not null,
  status     public.role_status not null default 'pending_review',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index incubator_applications_review_idx on public.incubator_applications (status)
  where status = 'pending_review';
