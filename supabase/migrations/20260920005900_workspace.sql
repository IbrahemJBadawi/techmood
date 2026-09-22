-- =============================================================================
-- 0059 — A company workspace, not a company page
--
-- 0024 built a startup's thinking tools: a canvas, a plan, a strategy, a stage.
-- What it never built is the place a company actually runs from — where the
-- stage is a ladder with requirements rather than a label somebody sets, where
-- the people are more than founders, and where hiring, mentoring and the work
-- itself belong to the company instead of to whoever happened to post them.
--
-- Three things arrive here:
--
--   1. **A company is a workspace.** `startups` gains what any organisation
--      needs to introduce itself, and a `kind` — because an incubated startup
--      and a working company use the same room differently, not differently
--      enough to deserve a second table. Rule: do not build a parallel system
--      where one can grow.
--
--   2. **The ladder is real.** `incubation_stages` puts the eight rungs in one
--      place with their order and their purpose, `incubation_requirements` says
--      what each rung asks for, and `stage_progress()` answers whether each one
--      is met by looking at the work — the canvas, the plan, the goals, the
--      sessions — rather than by asking somebody to tick a box. A stage is
--      advanced by `advance_startup_stage()`, which refuses while a required
--      item is unmet. A stage nobody can fail is a label, not a stage.
--
--   3. **The room has more kinds of people.** Founder, co-founder and manager
--      run it; a member or an employee works in it; a freelancer sees the
--      projects they were brought in for; an advisor, a mentor or a viewer
--      reads. Editing, managing and reading are three different questions and
--      now have three different functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The company itself
-- ---------------------------------------------------------------------------
create type public.org_kind as enum ('startup', 'company');

-- one_liner, problem, solution, website, logo, founded_on and is_public
-- already arrived with 0024; what an organisation still lacked is who it is.
alter table public.startups
  add column kind        public.org_kind not null default 'startup',
  add column industry_ar text,
  add column location_ar text;

comment on column public.startups.is_public is
  'Whether the showcase page is open to the world. The workspace never is.';

-- ---------------------------------------------------------------------------
-- 2. Who may do what in the room
-- ---------------------------------------------------------------------------
-- Reading, working and running are three different questions. They were one.
create or replace function public.can_manage_startup(p_startup uuid)
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
       and sm.role in ('founder', 'cofounder', 'manager')
  ) or public.is_admin();
$$;

comment on function public.can_manage_startup is
  'Settings, hiring, the stage and who is in the room — the decisions that bind the company.';

grant execute on function public.can_manage_startup(uuid) to authenticated;

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
       and sm.role in ('founder', 'cofounder', 'manager', 'member', 'employee')
  ) or public.is_admin();
$$;

-- A freelancer, an advisor, a mentor or a viewer can be in the room without
-- being able to change what is on its walls.
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
-- 3. The ladder
-- ---------------------------------------------------------------------------
create table public.incubation_stages (
  stage      public.startup_stage primary key,
  sort_order integer not null unique,
  title_ar   text not null,
  purpose_ar text not null
);

create table public.incubation_requirements (
  key         text primary key,
  stage       public.startup_stage not null references public.incubation_stages (stage) on delete cascade,
  title_ar    text not null,
  detail_ar   text,
  -- how the platform knows it is met: a thing that exists, or a human tick
  check_kind  text not null check (check_kind in (
    'canvas_cards', 'plan_section', 'goal', 'goal_achieved', 'project',
    'project_done', 'mentor_session', 'document', 'manual'
  )),
  -- what the check needs: a plan section name, a number of cards, and so on
  check_arg   text,
  is_required boolean not null default true,
  sort_order  integer not null default 0
);

alter table public.incubation_stages enable row level security;
alter table public.incubation_requirements enable row level security;

create policy incubation_stages_read on public.incubation_stages
  for select to anon, authenticated using (true);
create policy incubation_requirements_read on public.incubation_requirements
  for select to anon, authenticated using (true);

grant select on public.incubation_stages, public.incubation_requirements to anon, authenticated;

insert into public.incubation_stages (stage, sort_order, title_ar, purpose_ar) values
  ('idea',            1, 'الفكرة',          'ما المشكلة، ولمن؟ وما الذي يجعلها تستحق العمل؟'),
  ('validation',      2, 'التحقق',          'اختبار الفكرة مع أناس حقيقيين قبل بناء أي شيء.'),
  ('business_model',  3, 'نموذج العمل',      'من أين يأتي المال، وأين يذهب.'),
  ('mvp',             4, 'أبسط نسخة',        'أصغر شيء يمكن لأحد استخدامه فعلاً.'),
  ('market_test',     5, 'اختبار السوق',     'وضع النسخة أمام السوق ومعرفة ما حدث.'),
  ('first_customers', 6, 'أول العملاء',      'أول من استخدم وبقي — لا أول من سجّل.'),
  ('revenue',         7, 'الإيراد',          'أول دخل حقيقي، ولو صغيراً.'),
  ('growth',          8, 'النمو',            'ما الذي يتكرر، وكيف يكبر دون أن ينكسر.');

insert into public.incubation_requirements (key, stage, title_ar, detail_ar, check_kind, check_arg, sort_order) values
  -- idea
  ('idea.problem',      'idea', 'المشكلة مكتوبة في خطة العمل', 'قسم «وصف المشروع» مكتمل.', 'plan_section', 'company_description', 1),
  ('idea.segments',     'idea', 'شريحة العملاء على النموذج', 'ثلاث بطاقات على الأقل في «شرائح العملاء».', 'canvas_cards', 'customer_segments:3', 2),
  ('idea.value',        'idea', 'القيمة المقترحة على النموذج', 'بطاقتان على الأقل في «القيمة المقترحة».', 'canvas_cards', 'value_propositions:2', 3),
  -- validation
  ('validation.market', 'validation', 'تحليل السوق مكتمل', null, 'plan_section', 'market_analysis', 1),
  ('validation.rivals', 'validation', 'تحليل المنافسين مكتمل', null, 'plan_section', 'competitive_analysis', 2),
  ('validation.mentor', 'validation', 'جلسة إرشاد واحدة على الأقل', 'رأي من خارج الفريق قبل البناء.', 'mentor_session', null, 3),
  -- business model
  ('model.revenue',     'business_model', 'مصادر الإيرادات على النموذج', null, 'canvas_cards', 'revenue_streams:2', 1),
  ('model.cost',        'business_model', 'هيكل التكاليف على النموذج', null, 'canvas_cards', 'cost_structure:2', 2),
  ('model.financial',   'business_model', 'الخطة المالية مكتوبة', null, 'plan_section', 'financial_plan', 3),
  -- mvp
  ('mvp.project',       'mvp', 'مشروع بناء النسخة الأولى', 'مشروع في مساحة العمل يحمل بناء الـMVP.', 'project', null, 1),
  ('mvp.goal',          'mvp', 'هدف SMART لإطلاق النسخة', null, 'goal', null, 2),
  ('mvp.done',          'mvp', 'المشروع مكتمل', null, 'project_done', null, 3),
  -- market test
  ('test.plan',         'market_test', 'خطة التسويق والمبيعات', null, 'plan_section', 'marketing_and_sales', 1),
  ('test.goal',         'market_test', 'هدف قابل للقياس لاختبار السوق', null, 'goal', null, 2),
  ('test.result',       'market_test', 'نتيجة الاختبار موثّقة', 'مستند يحمل ما تعلّمتموه.', 'document', null, 3),
  -- first customers
  ('customers.goal',    'first_customers', 'هدف عدد العملاء تحقّق', null, 'goal_achieved', null, 1),
  ('customers.ops',     'first_customers', 'خطة التشغيل مكتوبة', null, 'plan_section', 'operations', 2),
  -- revenue
  ('revenue.goal',      'revenue', 'هدف إيراد تحقّق', null, 'goal_achieved', null, 1),
  ('revenue.mentor',    'revenue', 'مراجعة مع منتور بعد أول إيراد', null, 'mentor_session', null, 2),
  -- growth
  ('growth.team',       'growth', 'فريق من ثلاثة أشخاص على الأقل', null, 'manual', null, 1),
  ('growth.risks',      'growth', 'المخاطر وخطة التعامل معها', null, 'plan_section', 'risks_and_mitigation', 2);

-- A requirement the platform cannot see for itself is ticked by a person, and
-- the tick is a record with a name on it.
create table public.startup_requirement_ticks (
  startup_id      uuid not null references public.startups (id) on delete cascade,
  requirement_key text not null references public.incubation_requirements (key) on delete cascade,
  note_ar         text,
  ticked_by       uuid references public.profiles (id) on delete set null,
  ticked_at       timestamptz not null default now(),

  primary key (startup_id, requirement_key)
);

alter table public.startup_requirement_ticks enable row level security;

create policy startup_ticks_read on public.startup_requirement_ticks
  for select to authenticated using (public.can_view_startup_workspace(startup_id));

create policy startup_ticks_write on public.startup_requirement_ticks
  for all to authenticated
  using (public.can_manage_startup(startup_id))
  with check (public.can_manage_startup(startup_id));

grant select, insert, update, delete on public.startup_requirement_ticks to authenticated;

-- ---------------------------------------------------------------------------
-- 4. A project can belong to a company, and so can an opening
-- ---------------------------------------------------------------------------
alter table public.projects
  add column startup_id uuid references public.startups (id) on delete set null;

create index projects_startup_idx on public.projects (startup_id);

alter table public.opportunities
  add column startup_id uuid references public.startups (id) on delete cascade;

create index opportunities_startup_idx on public.opportunities (startup_id);

-- A company's own people can read and run its projects.
create policy projects_startup_read on public.projects
  for select to authenticated
  using (startup_id is not null and public.can_view_startup_workspace(startup_id));

create policy projects_startup_write on public.projects
  for all to authenticated
  using (startup_id is not null and public.can_edit_startup(startup_id))
  with check (startup_id is not null and public.can_edit_startup(startup_id));

-- Whoever runs the company may hire for it, whatever their personal roles are.
create or replace function public.can_post_opportunity(
  p_kind public.opportunity_kind,
  p_team uuid default null,
  p_startup uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_startup is not null then public.can_manage_startup(p_startup)
    when p_kind = 'team_seat' then p_team is not null and public.is_team_leader(p_team)
    when p_kind = 'cofounder' then public.has_role('founder') or public.has_role('company')
    else public.has_role('company')
      or public.has_role('founder')
      or public.has_role('team_leader')
      or public.has_role('freelancer')
  end or public.is_admin();
$$;

grant execute on function public.can_post_opportunity(public.opportunity_kind, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The documents a company keeps
-- ---------------------------------------------------------------------------
create type public.company_document_kind as enum (
  'business_plan', 'feasibility', 'pitch_deck', 'financial', 'strategy',
  'market_research', 'report', 'legal', 'certificate', 'other'
);

create table public.startup_documents (
  id          uuid primary key default extensions.gen_random_uuid(),
  startup_id  uuid not null references public.startups (id) on delete cascade,
  kind        public.company_document_kind not null default 'other',
  title_ar    text not null,
  summary_ar  text,
  url         text,
  storage_path text,
  version     integer not null default 1 check (version > 0),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint startup_document_has_a_location check (url is not null or storage_path is not null),
  constraint startup_document_url_is_http check (url is null or url ~* '^https?://')
);

create index startup_documents_idx on public.startup_documents (startup_id, kind, created_at desc);

alter table public.startup_documents enable row level security;

create policy startup_documents_read on public.startup_documents
  for select to authenticated using (public.can_view_startup_workspace(startup_id));

create policy startup_documents_write on public.startup_documents
  for all to authenticated
  using (public.can_edit_startup(startup_id))
  with check (public.can_edit_startup(startup_id));

grant select, insert, update, delete on public.startup_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Is this rung's work actually done?
-- ---------------------------------------------------------------------------
-- Every answer is read off work that exists somewhere else in the platform.
-- Nothing here asks the founder how they are doing.
create or replace function public.stage_progress(p_startup uuid, p_stage public.startup_stage default null)
returns table (
  requirement_key text,
  stage           public.startup_stage,
  title_ar        text,
  detail_ar       text,
  is_required     boolean,
  met             boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select coalesce(p_stage, (select s.stage from public.startups s where s.id = p_startup)) as stage
  )
  select r.key,
         r.stage,
         r.title_ar,
         r.detail_ar,
         r.is_required,
         case r.check_kind
           when 'plan_section' then exists (
             select 1 from public.business_plan_sections b
              where b.startup_id = p_startup
                and b.section::text = r.check_arg
                and b.is_complete
           )
           when 'canvas_cards' then (
             select count(*) from public.canvas_cards c
              where c.startup_id = p_startup
                and c.block::text = split_part(r.check_arg, ':', 1)
           ) >= coalesce(nullif(split_part(r.check_arg, ':', 2), '')::int, 1)
           when 'goal' then exists (
             select 1 from public.smart_goals g where g.startup_id = p_startup
           )
           when 'goal_achieved' then exists (
             select 1 from public.smart_goals g
              where g.startup_id = p_startup and g.status = 'achieved'
           )
           when 'project' then exists (
             select 1 from public.projects pj where pj.startup_id = p_startup
           )
           when 'project_done' then exists (
             select 1 from public.projects pj
              where pj.startup_id = p_startup and pj.status in ('completed', 'sold')
           )
           when 'mentor_session' then exists (
             select 1 from public.bookings b
               join public.startup_members sm on sm.profile_id = b.student_id
              where sm.startup_id = p_startup and b.status = 'completed'
           )
           when 'document' then exists (
             select 1 from public.startup_documents d where d.startup_id = p_startup
           )
           else exists (
             select 1 from public.startup_requirement_ticks tk
              where tk.startup_id = p_startup and tk.requirement_key = r.key
           )
         end
    from public.incubation_requirements r, target
   where r.stage = target.stage
     and (public.can_view_startup_workspace(p_startup) or public.is_admin())
   order by r.sort_order;
$$;

comment on function public.stage_progress is
  'What this rung of the ladder asks for, and whether the work that answers it exists. Nothing here is self-reported.';

-- ---------------------------------------------------------------------------
-- 6. Climbing a rung
-- ---------------------------------------------------------------------------
-- A stage nobody can fail to reach is a label. This one refuses while a
-- required item is unmet, and says which.
create or replace function public.advance_startup_stage(p_startup uuid, p_note text default null)
returns public.startup_stage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup public.startups%rowtype;
  v_missing text;
  v_next    public.startup_stage;
begin
  select * into v_startup from public.startups where id = p_startup;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if not public.can_manage_startup(p_startup) then
    raise exception 'إدارة المشروع فقط من ترفع مرحلته';
  end if;

  select string_agg(sp.title_ar, '، ') into v_missing
    from public.stage_progress(p_startup) sp
   where sp.is_required and not sp.met;

  if v_missing is not null then
    raise exception 'لم تكتمل متطلبات هذه المرحلة: %', v_missing;
  end if;

  select st.stage into v_next
    from public.incubation_stages st
   where st.sort_order = (
     select cur.sort_order + 1 from public.incubation_stages cur where cur.stage = v_startup.stage
   );

  if v_next is null then
    raise exception 'هذه آخر مرحلة في السلّم';
  end if;

  update public.startups set stage = v_next where id = p_startup;

  update public.startup_stage_history
     set note_ar = p_note
   where startup_id = p_startup and stage = v_next
     and changed_at = (select max(changed_at) from public.startup_stage_history
                        where startup_id = p_startup);

  return v_next;
end;
$$;

grant execute on function public.advance_startup_stage(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. The numbers at the top of the workspace
-- ---------------------------------------------------------------------------
create or replace function public.startup_overview(p_startup uuid)
returns table (
  members           integer,
  projects          integer,
  projects_done     integer,
  goals             integer,
  goals_achieved    integer,
  mentors           integer,
  open_positions    integer,
  documents         integer,
  plan_percent      integer,
  canvas_cards      integer,
  stage             public.startup_stage,
  stage_order       integer,
  stage_total       integer,
  stage_met         integer,
  stage_required    integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.startup_members sm where sm.startup_id = p_startup),
    (select count(*)::int from public.projects pj where pj.startup_id = p_startup),
    (select count(*)::int from public.projects pj
      where pj.startup_id = p_startup and pj.status in ('completed', 'sold')),
    (select count(*)::int from public.smart_goals g where g.startup_id = p_startup),
    (select count(*)::int from public.smart_goals g
      where g.startup_id = p_startup and g.status = 'achieved'),
    (select count(*)::int from public.startup_members sm
      where sm.startup_id = p_startup and sm.role = 'advisor'),
    (select count(*)::int from public.opportunities o
      where o.startup_id = p_startup and o.status = 'published'),
    (select count(*)::int from public.startup_documents d where d.startup_id = p_startup),
    (select coalesce(bp.percent, 0) from public.business_plan_progress bp where bp.startup_id = p_startup),
    (select count(*)::int from public.canvas_cards c where c.startup_id = p_startup),
    (select s.stage from public.startups s where s.id = p_startup),
    (select st.sort_order from public.incubation_stages st
      where st.stage = (select s.stage from public.startups s where s.id = p_startup)),
    (select count(*)::int from public.incubation_stages),
    (select count(*)::int from public.stage_progress(p_startup) sp where sp.met),
    (select count(*)::int from public.stage_progress(p_startup) sp where sp.is_required)
  where public.can_view_startup_workspace(p_startup) or public.is_admin();
$$;

grant execute on function public.startup_overview(uuid) to authenticated;
