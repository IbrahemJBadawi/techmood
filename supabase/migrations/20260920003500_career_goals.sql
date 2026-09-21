-- =============================================================================
-- 0035 — Career goals: the ladder, not the shelf
--
-- The academy document is explicit about what a learner should be asked. Not
-- "which courses do you want" but "what do you want to become", and the
-- platform answers with the skills, the courses, the projects and the work
-- that get them there.
--
-- A goal is not a bigger path. Data Analyst crosses six paths in three schools
-- and does not stop at the catalogue: it ends in a real project, a portfolio,
-- a team and work. So a goal is an ordered list of steps, and a step is one of
-- three things — a course, a whole path, or a milestone outside the academy.
--
-- Two rules keep this from becoming a parallel system:
--
-- 1. A goal stores no progress. Every step's state is read from the rule that
--    already owns it: is_course_complete(), is_path_complete(), an approved
--    submission, a team membership, an accepted application. Finish a course
--    anywhere and the goal moves by itself.
--
-- 2. A goal invents no content. Its steps point at courses and paths that
--    exist, which is how a plan can honestly say "this rung is not built yet"
--    instead of pretending it is.
-- =============================================================================

create type public.goal_step_kind as enum ('course', 'path', 'milestone');

-- The milestones a career crosses after the catalogue ends. Each one is read
-- from a table that already records it; none of them is a checkbox.
create type public.goal_milestone as enum (
  'assessment',   -- a passed assessment
  'real_project', -- an approved course or path project
  'portfolio',    -- approved work carrying a public link
  'mentorship',   -- a completed mentor session
  'team',         -- an active seat on a team
  'work',         -- an accepted application to an opportunity
  'startup'       -- founding a startup in the incubator
);

create table public.career_goals (
  id             uuid primary key default extensions.gen_random_uuid(),
  slug           text not null unique,
  title_ar       text not null,
  title_en       text,
  description_ar text,
  outcome_ar     text,
  tags           text[] not null default '{}',
  status         public.content_status not null default 'published',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.career_goals is
  'What a learner wants to become. The platform answers with an ordered plan, never with a shelf of courses.';

create table public.career_goal_steps (
  id         uuid primary key default extensions.gen_random_uuid(),
  goal_id    uuid not null references public.career_goals (id) on delete cascade,
  kind       public.goal_step_kind not null,
  course_id  uuid references public.courses (id) on delete cascade,
  path_id    uuid references public.learning_paths (id) on delete cascade,
  milestone  public.goal_milestone,
  label_ar   text,
  label_en   text,
  note_ar    text,
  sort_order integer not null,

  unique (goal_id, sort_order),

  -- exactly one target, matching the kind
  constraint career_goal_steps_target check (
    (kind = 'course'    and course_id is not null and path_id is null and milestone is null) or
    (kind = 'path'      and path_id   is not null and course_id is null and milestone is null) or
    (kind = 'milestone' and milestone is not null and course_id is null and path_id is null)
  )
);

create index career_goal_steps_goal_idx on public.career_goal_steps (goal_id, sort_order);

-- One goal at a time. Changing it is normal — the history of what was chosen
-- is not what this table is for, so a row is replaced, not appended.
create table public.profile_career_goals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  goal_id    uuid not null references public.career_goals (id) on delete cascade,
  chosen_at  timestamptz not null default now(),

  primary key (profile_id)
);

alter table public.career_goals          enable row level security;
alter table public.career_goal_steps     enable row level security;
alter table public.profile_career_goals  enable row level security;

create policy career_goals_read_all on public.career_goals
  for select to anon, authenticated using (true);
create policy career_goals_admin_write on public.career_goals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy career_goal_steps_read_all on public.career_goal_steps
  for select to anon, authenticated using (true);
create policy career_goal_steps_admin_write on public.career_goal_steps
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Your goal is yours to read and yours to set.
create policy profile_career_goals_own on public.profile_career_goals
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select on public.career_goals, public.career_goal_steps to anon, authenticated;
grant select, insert, update, delete on public.profile_career_goals to authenticated;
grant insert, update, delete on public.career_goals, public.career_goal_steps to authenticated;

-- ---------------------------------------------------------------------------
-- Is this milestone behind you?
-- ---------------------------------------------------------------------------
-- Each answer comes from the table that already records the thing. Nothing
-- here is a flag somebody has to remember to set.
create or replace function public.has_reached_milestone(p_profile uuid, p_milestone public.goal_milestone)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_milestone
    when 'assessment' then exists (
      select 1 from public.assessment_attempts aa
       where aa.profile_id = p_profile and aa.passed)
    when 'real_project' then exists (
      select 1 from public.submissions s
        join public.assignments a on a.id = s.assignment_id
       where s.profile_id = p_profile and s.status = 'approved'
         and a.kind in ('course_project', 'path_project'))
    when 'portfolio' then exists (
      select 1 from public.submissions s
        join public.submission_versions sv on sv.submission_id = s.id
        join public.submission_evidence se on se.version_id = sv.id
       where s.profile_id = p_profile and s.status = 'approved'
         and se.kind in ('github', 'linkedin', 'youtube', 'portfolio', 'website'))
    when 'mentorship' then exists (
      select 1 from public.bookings b
       where b.student_id = p_profile and b.status = 'completed')
    when 'team' then exists (
      select 1 from public.team_members tm
       where tm.profile_id = p_profile and tm.is_active)
    when 'work' then exists (
      select 1 from public.opportunity_applications oa
       where oa.profile_id = p_profile and oa.stage = 'accepted')
    when 'startup' then exists (
      select 1 from public.startups st where st.founder_id = p_profile)
  end;
$$;

comment on function public.has_reached_milestone is
  'Whether a career milestone is behind this person, read from the table that already records it.';

-- ---------------------------------------------------------------------------
-- Can this step be taken today?
-- ---------------------------------------------------------------------------
-- A step pointing at an outline is not a step anyone can take, and — this is
-- the part that matters — it is not a step anyone can have finished either.
-- is_course_complete() answers "nothing left to do", and a course with no
-- lessons and no required work has nothing left to do the moment it is
-- created. Without this guard a plan made mostly of outlines would report
-- itself half finished on the day it was written.
create or replace function public.is_goal_step_open(p_step uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case gs.kind
    when 'course' then
      exists (select 1 from public.courses c
               where c.id = gs.course_id and c.status = 'published')
      and exists (select 1 from public.path_courses pc
                    join public.learning_paths p on p.id = pc.path_id
                   where pc.course_id = gs.course_id and p.status = 'published')
    when 'path' then
      exists (select 1 from public.learning_paths p
               where p.id = gs.path_id and p.status = 'published')
    else true
  end
  from public.career_goal_steps gs
 where gs.id = p_step;
$$;

comment on function public.is_goal_step_open is
  'Whether a goal step points at content that is actually being taught. An outline can neither be started nor counted as finished.';

-- ---------------------------------------------------------------------------
-- The catalogue of goals
-- ---------------------------------------------------------------------------
create or replace function public.career_goals_catalogue()
returns table (
  id             uuid,
  slug           text,
  title_ar       text,
  title_en       text,
  description_ar text,
  outcome_ar     text,
  tags           text[],
  steps_total    integer,
  steps_done     integer,
  percent        integer,
  is_chosen      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  done as (
    select gs.goal_id, count(*)::int as finished
      from public.career_goal_steps gs
      cross join me
     where public.is_goal_step_open(gs.id)
       and case gs.kind
             when 'course'    then coalesce(public.is_course_complete(me.id, gs.course_id), false)
             when 'path'      then coalesce(public.is_path_complete(me.id, gs.path_id), false)
             when 'milestone' then coalesce(public.has_reached_milestone(me.id, gs.milestone), false)
           end
     group by gs.goal_id
  )
  select g.id, g.slug, g.title_ar, g.title_en, g.description_ar, g.outcome_ar, g.tags,
         (select count(*) from public.career_goal_steps s where s.goal_id = g.id)::int,
         coalesce(d.finished, 0),
         case when (select count(*) from public.career_goal_steps s where s.goal_id = g.id) = 0 then 0
              else (coalesce(d.finished, 0) * 100
                    / (select count(*) from public.career_goal_steps s where s.goal_id = g.id))::int
         end,
         exists (select 1 from public.profile_career_goals pg
                  cross join me where pg.profile_id = me.id and pg.goal_id = g.id)
    from public.career_goals g
    left join done d on d.goal_id = g.id
   where g.status = 'published'
   order by g.sort_order;
$$;

-- ---------------------------------------------------------------------------
-- The plan for one goal
-- ---------------------------------------------------------------------------
-- Every row carries three things a learner needs and nothing else: what the
-- step is, whether it is behind them, and whether it can be opened today.
-- A step pointing at content that is still an outline says so rather than
-- offering a link into nothing.
create or replace function public.career_goal_plan(p_goal text)
returns table (
  step_id     uuid,
  kind        public.goal_step_kind,
  sort_order  integer,
  title_ar    text,
  title_en    text,
  note_ar     text,
  slug        text,
  path_slug   text,
  milestone   public.goal_milestone,
  is_done     boolean,
  is_open     boolean,
  percent     integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select gs.id,
         gs.kind,
         gs.sort_order,
         case gs.kind
           when 'course' then (select c.title_ar from public.courses c where c.id = gs.course_id)
           when 'path'   then (select p.title_ar from public.learning_paths p where p.id = gs.path_id)
           else coalesce(gs.label_ar, '')
         end,
         case gs.kind
           when 'course' then (select c.title_en from public.courses c where c.id = gs.course_id)
           when 'path'   then (select p.title_en from public.learning_paths p where p.id = gs.path_id)
           else gs.label_en
         end,
         gs.note_ar,
         case gs.kind
           when 'course' then (select c.slug from public.courses c where c.id = gs.course_id)
           when 'path'   then (select p.slug from public.learning_paths p where p.id = gs.path_id)
           else null
         end,
         -- a course is opened through a path, so the plan carries one that is live
         case when gs.kind = 'course' then (
           select p.slug from public.path_courses pc
             join public.learning_paths p on p.id = pc.path_id
            where pc.course_id = gs.course_id and p.status = 'published'
            order by p.sort_order limit 1)
         end,
         gs.milestone,
         public.is_goal_step_open(gs.id)
           and case gs.kind
                 when 'course'    then coalesce(public.is_course_complete(me.id, gs.course_id), false)
                 when 'path'      then coalesce(public.is_path_complete(me.id, gs.path_id), false)
                 when 'milestone' then coalesce(public.has_reached_milestone(me.id, gs.milestone), false)
               end,
         public.is_goal_step_open(gs.id),
         case gs.kind
           when 'course' then (
             select case when count(l.id) = 0 then 0
                    else (count(*) filter (where lp.status = 'completed') * 100 / count(l.id))::int end
               from public.modules m
               join public.lessons l on l.module_id = m.id
               left join public.lesson_progress lp
                 on lp.lesson_id = l.id and lp.profile_id = me.id
              where m.course_id = gs.course_id)
           when 'path' then (
             select case when count(*) = 0 then 0
                    else (count(*) filter (where public.is_course_complete(me.id, pc.course_id)) * 100 / count(*))::int end
               from public.path_courses pc where pc.path_id = gs.path_id)
           else null
         end
    from public.career_goal_steps gs
    join public.career_goals g on g.id = gs.goal_id
    cross join me
   where g.slug = p_goal and g.status = 'published'
   order by gs.sort_order;
$$;

comment on function public.career_goal_plan is
  'One goal, step by step, with this caller''s standing on each. Nothing is stored: finish a course anywhere and the plan moves.';

-- ---------------------------------------------------------------------------
-- Choosing, and changing your mind
-- ---------------------------------------------------------------------------
create or replace function public.choose_career_goal(p_goal text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_goal uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول لاختيار هدف مهني';
  end if;

  select id into v_goal from public.career_goals
   where slug = p_goal and status = 'published';

  if v_goal is null then
    raise exception 'لا يوجد هدف مهني بهذا المعرّف';
  end if;

  insert into public.profile_career_goals (profile_id, goal_id)
  values (v_me, v_goal)
  on conflict (profile_id) do update set goal_id = excluded.goal_id, chosen_at = now();
end;
$$;

create or replace function public.clear_career_goal()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profile_career_goals where profile_id = (select auth.uid());
$$;

grant execute on function public.career_goals_catalogue()        to authenticated;
grant execute on function public.career_goal_plan(text)          to authenticated;
grant execute on function public.choose_career_goal(text)        to authenticated;
grant execute on function public.clear_career_goal()             to authenticated;
-- has_reached_milestone() takes a profile, so it is never handed to clients:
-- it would answer "does this stranger have a team, a job, a startup" for any
-- id put in the request. The two functions above are SECURITY DEFINER and
-- call it for the caller only.
revoke execute on function public.has_reached_milestone(uuid, public.goal_milestone)
  from public, anon, authenticated;
revoke execute on function public.is_goal_step_open(uuid) from public, anon;
