-- =============================================================================
-- TechMood — 0024 Incubator: startups, canvas, business plan, strategy
--
-- The founder's working documents live here. Three of them, deliberately
-- separate because they answer different questions:
--
--   CANVAS   — how the business works, on one page, as movable cards
--   PLAN     — the ten sections, written out, for someone who needs the detail
--   STRATEGY — where it is going: vision, mission, SWOT, and SMART goals with
--              numbers that can actually be checked
--
-- A startup is publicly listed, but everything a founder is still working out
-- is private to them and their team until they choose otherwise.
-- =============================================================================

alter table public.startups
  add column one_liner_ar   text,
  add column problem_ar     text,
  add column solution_ar    text,
  add column website_url    text,
  add column logo_url       text,
  add column founded_on     date,
  -- the canvas, plan and strategy are private working documents by default
  add column is_public      boolean not null default true;

-- ---------------------------------------------------------------------------
-- Who may work on it. One account, one identity — a co-founder is an existing
-- TechMood member, not a second login.
-- ---------------------------------------------------------------------------
create table public.startup_members (
  startup_id uuid not null references public.startups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       public.startup_member_role not null default 'member',
  title_ar   text,
  joined_at  timestamptz not null default now(),
  primary key (startup_id, profile_id)
);

create index startup_members_profile_idx on public.startup_members (profile_id);

-- The founder is a member from the start.
insert into public.startup_members (startup_id, profile_id, role)
select id, founder_id, 'founder' from public.startups
on conflict do nothing;

create or replace function public.add_founder_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.startup_members (startup_id, profile_id, role)
  values (new.id, new.founder_id, 'founder')
  on conflict do nothing;
  return new;
end;
$$;

create trigger startups_add_founder
  after insert on public.startups
  for each row execute function public.add_founder_as_member();

create or replace function public.can_edit_startup(p_startup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startup_members sm
    where sm.startup_id = p_startup
      and sm.profile_id = (select auth.uid())
      and sm.role in ('founder', 'cofounder', 'member')
  ) or public.is_admin();
$$;

create or replace function public.can_view_startup_workspace(p_startup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startup_members sm
    where sm.startup_id = p_startup and sm.profile_id = (select auth.uid())
  ) or public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Business Model Canvas. Cards belong to a block, carry a colour from a fixed
-- palette, and are ordered inside their block — which is all "move" needs to be.
-- ---------------------------------------------------------------------------
create table public.canvas_cards (
  id         uuid primary key default extensions.gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  block      public.canvas_block not null,
  body_ar    text not null check (char_length(body_ar) between 1 and 600),
  colour     public.card_colour not null default 'default',
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index canvas_cards_board_idx on public.canvas_cards (startup_id, block, sort_order);

create trigger canvas_cards_touch before update on public.canvas_cards
  for each row execute function public.touch_updated_at();

-- Moving a card is a block change plus a position, done in one place so the
-- ordering inside the destination stays sane.
create or replace function public.move_canvas_card(
  p_card  uuid,
  p_block public.canvas_block,
  p_index integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup uuid;
  v_position integer;
begin
  select startup_id into v_startup from public.canvas_cards where id = p_card;
  if v_startup is null then
    raise exception 'card % not found', p_card;
  end if;

  if not public.can_edit_startup(v_startup) then
    raise exception 'you do not have edit access to this canvas';
  end if;

  if p_index is null then
    select coalesce(max(sort_order), -1) + 1 into v_position
    from public.canvas_cards
    where startup_id = v_startup and block = p_block and id <> p_card;
  else
    v_position := greatest(p_index, 0);

    -- make room at the destination
    update public.canvas_cards
       set sort_order = sort_order + 1
     where startup_id = v_startup and block = p_block
       and sort_order >= v_position and id <> p_card;
  end if;

  update public.canvas_cards
     set block = p_block, sort_order = v_position
   where id = p_card;
end;
$$;

-- ---------------------------------------------------------------------------
-- The ten-section business plan. One row per section, so progress is a count
-- rather than a guess at how full a blob of text is.
-- ---------------------------------------------------------------------------
create table public.business_plan_sections (
  startup_id  uuid not null references public.startups (id) on delete cascade,
  section     public.plan_section not null,
  body_ar     text,
  is_complete boolean not null default false,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (startup_id, section)
);

-- A section cannot be marked done while it is empty.
create or replace function public.enforce_plan_section_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_complete and coalesce(trim(new.body_ar), '') = '' then
    raise exception 'an empty section cannot be marked complete';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger business_plan_sections_rules
  before insert or update on public.business_plan_sections
  for each row execute function public.enforce_plan_section_rules();

create or replace view public.business_plan_progress
with (security_invoker = true) as
  select s.id as startup_id,
         count(*) filter (where p.is_complete)::integer as completed_sections,
         10 as total_sections,
         round(count(*) filter (where p.is_complete) * 100.0 / 10)::integer as percent
  from public.startups s
  left join public.business_plan_sections p on p.startup_id = s.id
  group by s.id;

-- ---------------------------------------------------------------------------
-- Strategy: where it is going, and how anyone would know.
-- ---------------------------------------------------------------------------
create table public.startup_strategy (
  startup_id uuid primary key references public.startups (id) on delete cascade,
  vision_ar  text,
  mission_ar text,
  values_ar  text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger startup_strategy_touch before update on public.startup_strategy
  for each row execute function public.touch_updated_at();

create table public.swot_items (
  id         uuid primary key default extensions.gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  quadrant   public.swot_quadrant not null,
  body_ar    text not null check (char_length(body_ar) between 1 and 400),
  sort_order integer not null default 0
);

create index swot_items_startup_idx on public.swot_items (startup_id, quadrant, sort_order);

-- SMART goals. The letters are only worth writing down if the system holds them
-- to it, so measurable means a metric with numbers, and time-bound means a date.
create table public.smart_goals (
  id             uuid primary key default extensions.gen_random_uuid(),
  startup_id     uuid not null references public.startups (id) on delete cascade,
  title_ar       text not null,
  specific_ar    text not null,
  achievable_ar  text,
  relevant_ar    text,
  -- measurable
  metric_label_ar text not null,
  baseline_value numeric(14,2) not null default 0,
  target_value   numeric(14,2) not null,
  current_value  numeric(14,2) not null default 0,
  -- time-bound
  starts_on      date not null,
  due_on         date not null,
  status         public.goal_status not null default 'planned',
  owner_id       uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint smart_goals_dates_ordered check (due_on >= starts_on),
  constraint smart_goals_target_moves  check (target_value <> baseline_value)
);

create index smart_goals_startup_idx on public.smart_goals (startup_id, due_on);

create trigger smart_goals_touch before update on public.smart_goals
  for each row execute function public.touch_updated_at();

-- Progress is computed from the numbers, not typed in, and the status follows
-- from progress against time elapsed rather than from optimism.
create or replace view public.smart_goal_progress
with (security_invoker = true) as
  select g.id as goal_id,
         g.startup_id,
         case
           when g.target_value = g.baseline_value then 0
           else greatest(0, least(100, round(
             (g.current_value - g.baseline_value) * 100.0 / (g.target_value - g.baseline_value)
           )))::integer
         end as percent,
         case
           when current_date > g.due_on then 100
           when g.due_on = g.starts_on then 100
           else greatest(0, least(100, round(
             (current_date - g.starts_on) * 100.0 / (g.due_on - g.starts_on)
           )))::integer
         end as time_elapsed_percent
  from public.smart_goals g;

-- ---------------------------------------------------------------------------
-- Stage history, so "we reached MVP in March" is a record and not a memory.
-- ---------------------------------------------------------------------------
create table public.startup_stage_history (
  id         uuid primary key default extensions.gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  stage      public.startup_stage not null,
  note_ar    text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index startup_stage_history_idx on public.startup_stage_history (startup_id, changed_at desc);

create or replace function public.record_startup_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.startup_stage_history (startup_id, stage, changed_by)
    values (new.id, new.stage, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger startups_stage_history
  after insert or update of stage on public.startups
  for each row execute function public.record_startup_stage();

-- ---------------------------------------------------------------------------
-- Applying to the incubator
-- ---------------------------------------------------------------------------
alter table public.incubator_applications
  add column stage_at_application public.startup_stage,
  add column plan_percent_at_application integer;

create or replace function public.apply_to_incubator(p_startup uuid, p_pitch text)
returns public.incubator_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup public.startups%rowtype;
  v_percent integer;
  v_app     public.incubator_applications%rowtype;
begin
  select * into v_startup from public.startups where id = p_startup;
  if not found then
    raise exception 'startup % not found', p_startup;
  end if;

  if v_startup.founder_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'only the founder may apply to the incubator';
  end if;

  if coalesce(trim(p_pitch), '') = '' then
    raise exception 'the application needs a pitch';
  end if;

  if exists (
    select 1 from public.incubator_applications ia
    where ia.startup_id = p_startup and ia.status = 'pending_review'
  ) then
    raise exception 'an application for this startup is already under review';
  end if;

  -- The canvas is the minimum evidence that the idea has been thought through.
  if (select count(*) from public.canvas_cards where startup_id = p_startup) < 6 then
    raise exception 'fill in your business model canvas before applying';
  end if;

  select percent into v_percent from public.business_plan_progress where startup_id = p_startup;

  insert into public.incubator_applications
    (startup_id, pitch_ar, stage_at_application, plan_percent_at_application)
  values (p_startup, p_pitch, v_startup.stage, coalesce(v_percent, 0))
  returning * into v_app;

  return v_app;
end;
$$;

create or replace function public.review_incubator_application(
  p_application uuid,
  p_approve     boolean,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin may review an incubator application';
  end if;

  select startup_id into v_startup from public.incubator_applications where id = p_application;
  if v_startup is null then
    raise exception 'application % not found', p_application;
  end if;

  update public.incubator_applications
     set status = case when p_approve then 'approved' else 'rejected' end::public.role_status,
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         review_note = p_note
   where id = p_application;

  if p_approve then
    update public.startups set is_in_incubator = true where id = v_startup;
  end if;
end;
$$;

-- =============================================================================
-- Authorization. The startup is listed; the founder's thinking is not.
-- =============================================================================
alter table public.startup_members        enable row level security;
alter table public.canvas_cards           enable row level security;
alter table public.business_plan_sections enable row level security;
alter table public.startup_strategy       enable row level security;
alter table public.swot_items             enable row level security;
alter table public.smart_goals            enable row level security;
alter table public.startup_stage_history  enable row level security;

drop policy startups_read on public.startups;
create policy startups_read on public.startups
  for select to anon, authenticated
  using (is_public or public.can_view_startup_workspace(id));

create policy startup_members_read on public.startup_members
  for select to anon, authenticated
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.startups s
               where s.id = startup_id and (s.is_public or public.can_view_startup_workspace(s.id)))
  );

create policy startup_members_manage on public.startup_members
  for all to authenticated
  using (exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = (select auth.uid()))
         or public.is_admin())
  with check (exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = (select auth.uid()))
              or public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'canvas_cards', 'business_plan_sections', 'startup_strategy', 'swot_items', 'smart_goals'
  ]
  loop
    execute format($f$
      create policy %I on public.%I
        for select to authenticated using (public.can_view_startup_workspace(startup_id));
    $f$, t || '_view', t);

    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (public.can_edit_startup(startup_id))
        with check (public.can_edit_startup(startup_id));
    $f$, t || '_edit', t);
  end loop;
end
$$;

create policy startup_stage_history_view on public.startup_stage_history
  for select to anon, authenticated
  using (exists (select 1 from public.startups s
                 where s.id = startup_id and (s.is_public or public.can_view_startup_workspace(s.id))));

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.can_edit_startup(uuid)                              to authenticated;
grant execute on function public.can_view_startup_workspace(uuid)                    to authenticated;
grant execute on function public.move_canvas_card(uuid, public.canvas_block, integer) to authenticated;
grant execute on function public.apply_to_incubator(uuid, text)                      to authenticated;
grant execute on function public.review_incubator_application(uuid, boolean, text)    to authenticated;
