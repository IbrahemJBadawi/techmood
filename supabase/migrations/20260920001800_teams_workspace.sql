-- =============================================================================
-- TechMood — 0018 Team workspace
--
-- A team here is a place where work happens, not a group chat. The organising
-- rule from the product spec: every task has an owner, a state and a date, and
-- the conversation is never where the work is tracked. So tasks, sprints,
-- documents and the activity log are first-class, and the chat only reports
-- what happened elsewhere.
-- =============================================================================

alter table public.teams
  add column team_code    text unique,
  add column kind         public.team_kind not null default 'project',
  add column status       public.team_status not null default 'active',
  add column visibility   public.team_visibility not null default 'private',
  add column join_policy  public.team_join_policy not null default 'invite_only',
  add column avatar_url   text,
  add column focus_ar     text,
  -- what the team chose to publish on its professional profile
  add column public_summary_ar text;

update public.teams
   set team_code = 'TMT-' || upper(substr(replace(id::text, '-', ''), 1, 6))
 where team_code is null;

alter table public.teams
  alter column team_code set not null,
  alter column team_code set default ('TMT-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6)));

comment on column public.teams.visibility is
  'private hides the team entirely; listed publishes only the professional '
  'profile the team opted into. Neither ever exposes tasks, chat or documents.';

-- What a member actually does on the team, separate from what they may do.
alter table public.team_members
  add column responsibility_ar text,
  add column is_active boolean not null default true;

-- Permissions are per-team so a leader can delegate without inventing roles.
create table public.team_permissions (
  team_id           uuid primary key references public.teams (id) on delete cascade,
  members_create_tasks   boolean not null default true,
  members_assign_tasks   boolean not null default false,
  members_invite         boolean not null default false,
  members_manage_docs    boolean not null default true,
  members_book_mentor    boolean not null default false,
  members_edit_project   boolean not null default false
);

create or replace function public.team_permission(p_team uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if public.is_team_leader(p_team) or public.is_admin() then
    return true;
  end if;

  if not public.is_team_member(p_team) then
    return false;
  end if;

  execute format('select coalesce(%I, false) from public.team_permissions where team_id = $1', p_permission)
    into v_allowed
    using p_team;

  -- no row yet means the defaults apply
  return coalesce(v_allowed, p_permission in ('members_create_tasks', 'members_manage_docs'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Sprints — the platform's Agile spine
-- ---------------------------------------------------------------------------
create table public.sprints (
  id          uuid primary key default extensions.gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  number      integer not null check (number > 0),
  goal_ar     text,
  starts_on   date not null,
  ends_on     date not null,
  status      public.sprint_status not null default 'planned',
  -- written at sprint review, not during
  review_ar   text,
  reflection_ar text,
  created_at  timestamptz not null default now(),

  unique (team_id, number),
  constraint sprints_dates_ordered check (ends_on >= starts_on)
);

create index sprints_team_idx on public.sprints (team_id, number desc);

-- ---------------------------------------------------------------------------
-- Tasks. Assignee, status and due date are the point; everything else is
-- detail hanging off them.
-- ---------------------------------------------------------------------------
alter table public.team_tasks
  add column description_ar text,
  add column priority       public.task_priority not null default 'normal',
  add column sprint_id      uuid references public.sprints (id) on delete set null,
  add column project_id     uuid references public.projects (id) on delete set null,
  add column blocked_reason_ar text,
  add column completed_at   timestamptz,
  -- small and fixed, in line with the rest of the XP economy
  add column xp_reward      integer not null default 3 check (xp_reward between 0 and 25);

create index team_tasks_assignee_idx on public.team_tasks (assignee_id, column_key);
create index team_tasks_sprint_idx   on public.team_tasks (sprint_id);
create index team_tasks_due_idx      on public.team_tasks (team_id, due_on)
  where column_key <> 'done';

-- A blocked task must say why, otherwise "blocked" carries no information.
create or replace function public.enforce_task_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.column_key = 'blocked' and coalesce(trim(new.blocked_reason_ar), '') = '' then
    raise exception 'a blocked task must record what is blocking it';
  end if;

  if new.column_key = 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.column_key <> 'done' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger team_tasks_rules
  before insert or update on public.team_tasks
  for each row execute function public.enforce_task_rules();

create table public.task_checklist_items (
  id         uuid primary key default extensions.gen_random_uuid(),
  task_id    uuid not null references public.team_tasks (id) on delete cascade,
  label_ar   text not null,
  is_done    boolean not null default false,
  sort_order integer not null default 0
);

create index task_checklist_task_idx on public.task_checklist_items (task_id, sort_order);

create table public.task_comments (
  id         uuid primary key default extensions.gen_random_uuid(),
  task_id    uuid not null references public.team_tasks (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body_ar    text not null check (char_length(body_ar) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- Handing in a task: evidence attaches to the task itself, not to the chat.
create table public.task_submissions (
  id         uuid primary key default extensions.gen_random_uuid(),
  task_id    uuid not null references public.team_tasks (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  notes_ar   text,
  created_at timestamptz not null default now()
);

create table public.task_submission_evidence (
  id            uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.task_submissions (id) on delete cascade,
  kind          public.evidence_kind not null,
  url           text not null,
  label         text,

  constraint task_evidence_url_is_http check (url ~* '^https?://')
);

-- ---------------------------------------------------------------------------
-- Documents. Not a dumping ground: each one is typed, and may point at the
-- project or task it belongs to.
-- ---------------------------------------------------------------------------
create table public.team_documents (
  id         uuid primary key default extensions.gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       public.team_document_kind not null,
  title_ar   text not null,
  body_ar    text,
  url        text,
  project_id uuid references public.projects (id) on delete set null,
  task_id    uuid references public.team_tasks (id) on delete set null,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_documents_has_content check (body_ar is not null or url is not null),
  constraint team_documents_url_is_http check (url is null or url ~* '^https?://')
);

create index team_documents_team_idx on public.team_documents (team_id, kind);

create trigger team_documents_touch before update on public.team_documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Activity: who did what, when, on which task, with what result.
-- This is what makes team work part of a member's professional record.
-- ---------------------------------------------------------------------------
create table public.team_activity (
  id         uuid primary key default extensions.gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  verb       text not null,
  task_id    uuid references public.team_tasks (id) on delete set null,
  subject_ar text,
  created_at timestamptz not null default now()
);

create index team_activity_team_idx on public.team_activity (team_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Team XP and stars, kept in their own ledger. A team's reputation is not the
-- sum of its members' personal XP, and must not inflate it either.
-- ---------------------------------------------------------------------------
create table public.team_xp_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  source     public.team_xp_source not null,
  xp         integer not null check (xp > 0),
  ref_table  text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),

  unique (team_id, source, ref_table, ref_id)
);

create table public.team_xp_rules (
  source      public.team_xp_source primary key,
  base_xp     integer not null default 0 check (base_xp between 0 and 200),
  per_star_xp integer not null default 0 check (per_star_xp between 0 and 40),
  description_ar text
);

insert into public.team_xp_rules (source, base_xp, per_star_xp, description_ar) values
  ('task_completed',     2,  0, 'إنجاز مهمة'),
  ('sprint_completed',  15,  0, 'إغلاق سبرنت'),
  ('project_completed', 60,  0, 'إكمال مشروع'),
  ('on_time_delivery',   5,  0, 'تسليم في الموعد'),
  ('mentor_review',      0, 10, 'تقييم منتور — 10 لكل نجمة');

create or replace function public.award_team_xp(
  p_team uuid, p_source public.team_xp_source, p_ref_table text, p_ref_id uuid, p_stars smallint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.team_xp_rules%rowtype;
  v_xp   integer;
begin
  select * into v_rule from public.team_xp_rules where source = p_source;
  if not found then return 0; end if;

  v_xp := v_rule.base_xp + (coalesce(p_stars, 0) * v_rule.per_star_xp);
  if v_xp <= 0 then return 0; end if;

  insert into public.team_xp_events (team_id, source, xp, ref_table, ref_id)
  values (p_team, p_source, v_xp, p_ref_table, p_ref_id)
  on conflict (team_id, source, ref_table, ref_id) do nothing;

  return v_xp;
end;
$$;

-- Completing a task pays the team a little, the member a little, and records
-- the on-time bonus only when it really was on time.
create or replace function public.on_task_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.column_key <> 'done' or old.column_key = 'done' then
    return new;
  end if;

  perform public.award_team_xp(new.team_id, 'task_completed', 'team_tasks', new.id);

  if new.due_on is not null and new.completed_at::date <= new.due_on then
    perform public.award_team_xp(new.team_id, 'on_time_delivery', 'team_tasks', new.id);
  end if;

  if new.assignee_id is not null and new.xp_reward > 0 then
    insert into public.xp_events (profile_id, source, xp, ref_table, ref_id)
    values (new.assignee_id, 'team_contribution', new.xp_reward, 'team_tasks', new.id)
    on conflict (profile_id, source, ref_table, ref_id) do nothing;
  end if;

  insert into public.team_activity (team_id, actor_id, verb, task_id, subject_ar)
  values (new.team_id, (select auth.uid()), 'task_completed', new.id, new.title_ar);

  return new;
end;
$$;

create trigger team_tasks_completed
  after update of column_key on public.team_tasks
  for each row execute function public.on_task_completed();

create or replace view public.team_xp
with (security_invoker = true) as
  select t.id as team_id,
         coalesce(sum(e.xp), 0)::integer as total_xp
  from public.teams t
  left join public.team_xp_events e on e.team_id = t.id
  group by t.id;

create or replace view public.team_stars
with (security_invoker = true) as
  select t.id as team_id,
         round(avg(r.stars)::numeric, 2) as stars_avg,
         count(r.id)::integer as reviews_count
  from public.teams t
  left join public.team_reviews r on r.team_id = t.id
  group by t.id;

-- ---------------------------------------------------------------------------
-- Invitations. One account, one TechMood ID — an invite reaches an existing
-- person, it never creates a second identity.
-- ---------------------------------------------------------------------------
create table public.team_invites (
  id          uuid primary key default extensions.gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  -- either a specific person, or a shareable token for a link
  invitee_id  uuid references public.profiles (id) on delete cascade,
  token       text unique default encode(extensions.gen_random_bytes(12), 'hex'),
  responsibility_ar text,
  invited_by  uuid not null references public.profiles (id) on delete cascade,
  status      public.team_application_status not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);

create unique index team_invites_one_open_per_person on public.team_invites (team_id, invitee_id)
  where invitee_id is not null and status = 'pending';

create or replace function public.accept_team_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_invite public.team_invites%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite from public.team_invites
   where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'this invitation is not valid any more';
  end if;

  if v_invite.invitee_id is not null and v_invite.invitee_id <> v_me then
    raise exception 'this invitation belongs to someone else';
  end if;

  insert into public.team_members (team_id, profile_id, role, title_ar, responsibility_ar)
  values (v_invite.team_id, v_me, 'member', v_invite.responsibility_ar, v_invite.responsibility_ar)
  on conflict (team_id, profile_id) do nothing;

  update public.team_invites set status = 'accepted' where id = v_invite.id;

  insert into public.team_activity (team_id, actor_id, verb, subject_ar)
  values (v_invite.team_id, v_me, 'member_joined', null);

  return v_invite.team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exhibition: a finished project becomes evidence on every member's profile.
-- ---------------------------------------------------------------------------
create table public.exhibition_entries (
  id            uuid primary key default extensions.gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  team_id       uuid references public.teams (id) on delete set null,
  submitted_by  uuid not null references public.profiles (id) on delete cascade,
  summary_ar    text not null,
  technologies  text[] not null default '{}',
  demo_url      text,
  status        public.exhibition_status not null default 'submitted',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note_ar text,
  created_at    timestamptz not null default now(),

  unique (project_id)
);

create index exhibition_entries_review_idx on public.exhibition_entries (status)
  where status = 'submitted';
