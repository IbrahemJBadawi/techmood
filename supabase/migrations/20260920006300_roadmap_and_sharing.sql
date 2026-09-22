-- =============================================================================
-- 0063 — A roadmap made of real things, and a way to show it once
--
-- **The roadmap.** A company's dates already exist: goals have a due date,
-- projects have a life, the incubation ladder has rungs. What was missing is
-- the horizontal view — the quarter — and the one thing a roadmap needs that
-- none of those have: a line for something the company intends but has not yet
-- started. So `roadmap_items` holds the intentions, `roadmap()` gathers them
-- together with the goals and projects that already exist, and an item can
-- become a project the moment work starts on it. Nothing is written twice.
--
-- **The share.** A canvas, a plan or a roadmap sometimes has to be shown to
-- somebody with no account — an investor, a partner, a jury. Sending a
-- screenshot loses the thing that makes it worth showing; opening the workspace
-- gives away everything. A share is therefore narrow and temporary by
-- construction: one company, one kind of thing, one token, and a date it stops
-- working. Nobody can widen it by guessing a URL, because the token says what
-- it opens.
-- =============================================================================

create type public.roadmap_status as enum ('planned', 'in_progress', 'done', 'dropped');

create table public.roadmap_items (
  id         uuid primary key default extensions.gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  title_ar   text not null check (char_length(title_ar) between 2 and 200),
  detail_ar  text,
  -- the quarter it belongs to, as people actually say it
  year       integer not null check (year between 2024 and 2100),
  quarter    integer not null check (quarter between 1 and 4),
  status     public.roadmap_status not null default 'planned',
  project_id uuid references public.projects (id) on delete set null,
  goal_id    uuid references public.smart_goals (id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index roadmap_items_startup_idx on public.roadmap_items (startup_id, year, quarter, sort_order);

alter table public.roadmap_items enable row level security;

create policy roadmap_items_read on public.roadmap_items
  for select to anon, authenticated
  using (
    public.can_view_startup_workspace(startup_id)
    or public.is_startup_mentor(startup_id)
    or exists (select 1 from public.startups s where s.id = startup_id and s.is_public)
  );

create policy roadmap_items_write on public.roadmap_items
  for all to authenticated
  using (public.can_edit_startup(startup_id))
  with check (public.can_edit_startup(startup_id));

grant select, insert, update, delete on public.roadmap_items to authenticated;
grant select on public.roadmap_items to anon;

-- ---------------------------------------------------------------------------
-- The quarters, gathered
-- ---------------------------------------------------------------------------
-- Three sources, one timeline: what the company intends, what it set itself as
-- a measurable goal, and what it is actually building. A roadmap that only
-- shows intentions is a wish list.
create or replace function public.roadmap(p_startup uuid)
returns table (
  source     text,
  item_id    uuid,
  title_ar   text,
  detail_ar  text,
  year       integer,
  quarter    integer,
  state      text,
  link       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select 'item', r.id, r.title_ar, r.detail_ar, r.year, r.quarter, r.status::text,
         case when r.project_id is not null then '/projects/' || r.project_id::text else null end
    from public.roadmap_items r
   where r.startup_id = p_startup

  union all

  select 'goal', g.id, g.title_ar, g.metric_label_ar,
         extract(year from g.due_on)::int,
         extract(quarter from g.due_on)::int,
         g.status::text,
         null
    from public.smart_goals g
   where g.startup_id = p_startup

  union all

  select 'project', pj.id, pj.title_ar, pj.description_ar,
         extract(year from pj.created_at)::int,
         extract(quarter from pj.created_at)::int,
         pj.status::text,
         '/projects/' || pj.id::text
    from public.projects pj
   where pj.startup_id = p_startup

  order by 5, 6, 1;
$$;

comment on function public.roadmap is
  'The company''s quarters: what it intends, what it measured itself against, and what it is building. Gathered, never re-entered.';

grant execute on function public.roadmap(uuid) to anon, authenticated;

-- An intention becomes work the moment somebody starts it.
create or replace function public.roadmap_item_to_project(p_item uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item    public.roadmap_items%rowtype;
  v_startup public.startups%rowtype;
  v_project uuid;
begin
  select * into v_item from public.roadmap_items where id = p_item;
  if not found then
    raise exception 'العنصر غير موجود';
  end if;

  if not public.can_edit_startup(v_item.startup_id) then
    raise exception 'لا تملك صلاحية التعديل في مساحة العمل هذه';
  end if;

  if v_item.project_id is not null then
    return v_item.project_id;
  end if;

  select * into v_startup from public.startups where id = v_item.startup_id;

  insert into public.projects
    (title_ar, description_ar, owner_id, startup_id, team_id, status, kind, is_public)
  values (v_item.title_ar, v_item.detail_ar, (select auth.uid()), v_item.startup_id,
          v_startup.team_id, 'planning', 'startup', false)
  returning id into v_project;

  update public.roadmap_items
     set project_id = v_project, status = 'in_progress'
   where id = p_item;

  return v_project;
end;
$$;

grant execute on function public.roadmap_item_to_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Showing it once, to one person, until a date
-- ---------------------------------------------------------------------------
create type public.share_scope as enum ('canvas', 'plan', 'roadmap', 'showcase');

create table public.startup_shares (
  id         uuid primary key default extensions.gen_random_uuid(),
  token      text not null unique
               default encode(extensions.gen_random_bytes(16), 'hex'),
  startup_id uuid not null references public.startups (id) on delete cascade,
  scope      public.share_scope not null,
  -- which canvas, when the scope is a canvas
  canvas_id  uuid references public.canvases (id) on delete cascade,
  label_ar   text,
  expires_on date,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  views      integer not null default 0,

  constraint share_canvas_has_a_canvas check (scope <> 'canvas' or canvas_id is not null)
);

create index startup_shares_startup_idx on public.startup_shares (startup_id, created_at desc);

alter table public.startup_shares enable row level security;

-- The company sees its own links. Nobody else lists them — a share is used by
-- whoever holds it, not found by looking.
create policy startup_shares_read on public.startup_shares
  for select to authenticated using (public.can_view_startup_workspace(startup_id));

create policy startup_shares_write on public.startup_shares
  for all to authenticated
  using (public.can_manage_startup(startup_id))
  with check (public.can_manage_startup(startup_id));

grant select, insert, update, delete on public.startup_shares to authenticated;

-- What a link opens, to somebody with no account.
--
-- The token is the whole authorisation, so the function gives out exactly what
-- the share names and nothing near it: no workspace, no other canvas, no
-- members, no money. An expired or revoked link returns nothing at all.
create or replace function public.shared_view(p_token text)
returns table (
  scope        public.share_scope,
  company_name text,
  one_liner    text,
  label_ar     text,
  canvas_id    uuid,
  canvas_title text,
  payload      jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.startup_shares%rowtype;
begin
  select * into v_share from public.startup_shares
   where token = p_token
     and revoked_at is null
     and (expires_on is null or expires_on >= current_date);

  if not found then
    return;
  end if;

  return query
  select v_share.scope,
         s.name_ar,
         s.one_liner_ar,
         v_share.label_ar,
         v_share.canvas_id,
         (select c.title_ar from public.canvases c where c.id = v_share.canvas_id),
         case v_share.scope
           when 'canvas' then jsonb_build_object(
             'blocks', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'key', b.key, 'title', b.title_ar, 'hint', b.hint_ar,
                        'cards', coalesce((
                          select jsonb_agg(jsonb_build_object('body', c2.body_ar, 'colour', c2.colour)
                                           order by c2.sort_order)
                            from public.canvas_cards c2
                           where c2.canvas_id = v_share.canvas_id and c2.block_key = b.key
                        ), '[]'::jsonb))
                      order by b.sort_order)
                 from public.canvas_blocks b where b.canvas_id = v_share.canvas_id
             ), '[]'::jsonb))

           when 'plan' then jsonb_build_object(
             'sections', coalesce((
               select jsonb_agg(jsonb_build_object('section', p.section, 'body', p.body_ar,
                                                   'complete', p.is_complete))
                 from public.business_plan_sections p where p.startup_id = v_share.startup_id
             ), '[]'::jsonb))

           when 'roadmap' then jsonb_build_object(
             'items', coalesce((
               select jsonb_agg(jsonb_build_object('title', r.title_ar, 'detail', r.detail_ar,
                                                   'year', r.year, 'quarter', r.quarter,
                                                   'status', r.status)
                                order by r.year, r.quarter)
                 from public.roadmap_items r where r.startup_id = v_share.startup_id
             ), '[]'::jsonb))

           else jsonb_build_object(
             'problem', s.problem_ar,
             'solution', s.solution_ar,
             'stage', s.stage,
             'projects', coalesce((
               select jsonb_agg(jsonb_build_object('title', pj.title_ar, 'status', pj.status))
                 from public.projects pj
                where pj.startup_id = v_share.startup_id
                  and pj.status in ('completed', 'sold')
             ), '[]'::jsonb))
         end
    from public.startups s where s.id = v_share.startup_id;
end;
$$;

grant execute on function public.shared_view(text) to anon, authenticated;

-- Opening a link is worth counting: a company should know whether the investor
-- ever looked.
create or replace function public.record_share_view(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.startup_shares
     set views = views + 1
   where token = p_token and revoked_at is null
     and (expires_on is null or expires_on >= current_date);
$$;

grant execute on function public.record_share_view(text) to anon, authenticated;

create or replace function public.revoke_share(p_share uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup uuid;
begin
  select startup_id into v_startup from public.startup_shares where id = p_share;
  if v_startup is null then
    raise exception 'الرابط غير موجود';
  end if;

  if not public.can_manage_startup(v_startup) then
    raise exception 'إدارة الشركة فقط من تسحب الروابط';
  end if;

  update public.startup_shares set revoked_at = now() where id = p_share;
end;
$$;

grant execute on function public.revoke_share(uuid) to authenticated;
