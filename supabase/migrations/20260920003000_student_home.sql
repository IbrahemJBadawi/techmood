-- =============================================================================
-- TechMood — 0030 The student command centre
--
-- The home page stops being a brochure and becomes a place to work from. What
-- it needs that the schema did not have:
--
--   * a daily activity record and a streak — derived, never stored, because
--     every qualifying act is already written somewhere (a finished lesson, a
--     submission, an assessment attempt, an attended session, a closed team
--     task). Storing a second copy would be a number that can drift from the
--     facts it claims to summarise.
--   * one agenda across the whole platform: lessons, own work, assessments,
--     mentor sessions and team tasks in four columns.
--   * "where was I?" — the path, course and lesson to resume, with the two
--     percentages that matter.
--   * focus sessions, which are stored, because a timer nobody records is a
--     toy. They earn no XP: sitting still is not an achievement.
--   * leaderboards that can be windowed, ranked, and answer "where am I?".
--
-- Every read function below works on auth.uid() and takes no profile argument.
-- That is deliberate: a home page cannot be turned into someone else's home
-- page by editing an id in the URL, because there is no id to edit.
-- =============================================================================

create type public.agenda_column as enum ('today', 'in_progress', 'upcoming', 'completed');

-- ---------------------------------------------------------------------------
-- One of your (at most three) fields is the one you lead with.
-- ---------------------------------------------------------------------------
alter table public.profile_fields
  add column is_primary boolean not null default false;

create unique index profile_fields_one_primary
  on public.profile_fields (profile_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- A booked session needs somewhere to happen.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column meeting_url text;

comment on column public.bookings.meeting_url is
  'Set by the mentor once the session is confirmed. Read only by the two people in it and by admins — the booking policies already scope that.';

-- ---------------------------------------------------------------------------
-- Focus sessions (the pomodoro)
-- ---------------------------------------------------------------------------
create table public.focus_sessions (
  id              uuid primary key default extensions.gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  planned_minutes smallint not null default 25 check (planned_minutes between 5 and 120),
  -- what the person said they were working on, if anything
  subject_ar      text,
  ref_table       text,
  ref_id          uuid,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  was_completed   boolean not null default false,

  constraint focus_sessions_ordered check (ended_at is null or ended_at >= started_at)
);

create index focus_sessions_profile_idx on public.focus_sessions (profile_id, started_at desc);

comment on table public.focus_sessions is
  'A recorded pomodoro. Awards no XP and does not count towards the streak: the streak measures work that produced something, and a timer produces nothing.';

alter table public.focus_sessions enable row level security;

create policy focus_sessions_own on public.focus_sessions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Daily activity, derived from what actually happened
-- ---------------------------------------------------------------------------
create or replace function public.activity_days(p_from date, p_to date)
returns table (on_date date, sources text[])
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  acts as (
    select lp.completed_at::date as d, 'lesson' as source
      from public.lesson_progress lp, me
     where lp.profile_id = me.id and lp.completed_at is not null
    union all
    select s.created_at::date, 'work'
      from public.submissions s, me
     where s.profile_id = me.id
    union all
    select aa.created_at::date, 'assessment'
      from public.assessment_attempts aa, me
     where aa.profile_id = me.id
    union all
    select b.completed_at::date, 'mentor_session'
      from public.bookings b, me
     where b.student_id = me.id and b.completed_at is not null
    union all
    select t.completed_at::date, 'team'
      from public.team_tasks t, me
     where t.assignee_id = me.id and t.completed_at is not null
    union all
    select e.enrolled_at::date, 'course'
      from public.enrollments e, me
     where e.profile_id = me.id
  )
  select g.d::date,
         coalesce(array_agg(distinct a.source) filter (where a.source is not null), '{}')
    from generate_series(p_from, p_to, interval '1 day') as g(d)
    left join acts a on a.d = g.d::date
   group by g.d
   order by g.d;
$$;

comment on function public.activity_days is
  'One row per day in the window, with the kinds of qualifying activity on it. A day with an empty array is a day nothing was finished.';

-- The streak counts back from today, and tolerates an empty today: a day is not
-- over until it is over, and losing a 40-day streak at 9am would be a lie.
create or replace function public.current_streak()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days date[];
  v_cursor date := current_date;
  v_streak integer := 0;
begin
  select array_agg(on_date)
    into v_days
    from public.activity_days(current_date - 400, current_date)
   where cardinality(sources) > 0;

  if v_days is null then
    return 0;
  end if;

  if not (current_date = any (v_days)) then
    v_cursor := current_date - 1;
  end if;

  while v_cursor = any (v_days) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return v_streak;
end;
$$;

-- ---------------------------------------------------------------------------
-- Where was I?
-- ---------------------------------------------------------------------------
create or replace function public.continue_learning()
returns table (
  path_id        uuid,
  path_slug      text,
  path_title     text,
  course_id      uuid,
  course_slug    text,
  course_title   text,
  lesson_id      uuid,
  lesson_title   text,
  path_percent   integer,
  course_percent integer,
  last_activity  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  -- the lesson touched most recently, and the course and path it belongs to
  recent as (
    select lp.lesson_id, lp.updated_at, l.title_ar as lesson_title, l.sort_order,
           c.id as course_id, c.slug as course_slug, c.title_ar as course_title
      from public.lesson_progress lp
      join public.lessons l  on l.id = lp.lesson_id
      join public.modules m  on m.id = l.module_id
      join public.courses c  on c.id = m.course_id
      cross join me
     where lp.profile_id = me.id
     order by lp.updated_at desc
     limit 1
  ),
  -- the path the person is enrolled in that contains that course
  chosen as (
    select r.*, lp2.id as path_id, lp2.slug as path_slug, lp2.title_ar as path_title
      from recent r
      join public.path_courses pc on pc.course_id = r.course_id
      join public.learning_paths lp2 on lp2.id = pc.path_id
      join public.enrollments e on e.path_id = lp2.id
      cross join me
     where e.profile_id = me.id
     order by e.enrolled_at desc
     limit 1
  ),
  -- the next lesson that is not finished yet, in course order
  next_lesson as (
    select l.id, l.title_ar
      from chosen ch
      cross join me
      join public.modules m on m.course_id = ch.course_id
      join public.lessons l on l.module_id = m.id
      left join public.lesson_progress lp
        on lp.lesson_id = l.id and lp.profile_id = me.id
     where coalesce(lp.status, 'available') <> 'completed'
     order by m.sort_order, l.sort_order
     limit 1
  )
  select ch.path_id,
         ch.path_slug,
         ch.path_title,
         ch.course_id,
         ch.course_slug,
         ch.course_title,
         coalesce(nl.id, ch.lesson_id),
         coalesce(nl.title_ar, ch.lesson_title),
         -- a path's progress is its courses that are complete
         (
           select case when count(*) = 0 then 0
                  else (count(*) filter (where public.is_course_complete(me.id, pc.course_id)) * 100 / count(*))::int
                  end
             from public.path_courses pc cross join me
            where pc.path_id = ch.path_id
         ),
         -- a course's progress is its lessons that are complete
         (
           select case when count(l.id) = 0 then 0
                  else (count(lp.lesson_id) filter (where lp.status = 'completed') * 100 / count(l.id))::int
                  end
             from public.modules m
             join public.lessons l on l.module_id = m.id
             left join public.lesson_progress lp
               on lp.lesson_id = l.id and lp.profile_id = (select auth.uid())
            where m.course_id = ch.course_id
         ),
         ch.updated_at
    from chosen ch
    left join next_lesson nl on true;
$$;

-- ---------------------------------------------------------------------------
-- One agenda for the whole platform
-- ---------------------------------------------------------------------------
create or replace function public.student_agenda(p_horizon_days integer default 14)
returns table (
  entry_kind text,
  entry_id   uuid,
  title_ar   text,
  detail_ar  text,
  bucket     public.agenda_column,
  due_on     date,
  link       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  horizon as (select (current_date + greatest(p_horizon_days, 1)) as until)

  -- lessons in the courses of the paths you joined
  select 'lesson', l.id, l.title_ar, c.title_ar,
         case
           when lp.status = 'in_progress' then 'in_progress'
           when lp.status = 'completed' and lp.completed_at::date = current_date then 'completed'
           else 'today'
         end::public.agenda_column,
         null::date,
         '/academy/' || path.slug || '/' || c.slug
    from public.enrollments e
    join public.learning_paths path on path.id = e.path_id
    join public.path_courses pc on pc.path_id = path.id
    join public.courses c on c.id = pc.course_id
    join public.modules m on m.course_id = c.id
    join public.lessons l on l.module_id = m.id
    cross join me
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.profile_id = me.id
   where e.profile_id = me.id
     and (
       lp.status = 'in_progress'
       or (lp.status = 'completed' and lp.completed_at::date = current_date)
       or (lp.status is null or lp.status = 'available')
     )

  union all

  -- your own work, wherever it stands
  select 'work', s.id, a.title_ar, null,
         case s.status
           when 'draft'             then 'today'
           when 'changes_requested' then 'today'
           when 'submitted'         then 'in_progress'
           when 'under_review'      then 'in_progress'
           else 'completed'
         end::public.agenda_column,
         null::date,
         '/academy'
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    cross join me
   where s.profile_id = me.id
     and (s.status <> 'approved' or s.updated_at::date = current_date)

  union all

  -- assessments in your courses that you have not passed
  select 'assessment', ass.id, ass.title_ar, c.title_ar,
         'upcoming'::public.agenda_column,
         null::date,
         '/academy/' || path.slug || '/' || c.slug
    from public.enrollments e
    join public.learning_paths path on path.id = e.path_id
    join public.path_courses pc on pc.path_id = path.id
    join public.courses c on c.id = pc.course_id
    join public.assessments ass on ass.course_id = c.id
    cross join me
   where e.profile_id = me.id
     and not exists (
       select 1 from public.assessment_attempts aa
        where aa.assessment_id = ass.id and aa.profile_id = me.id and aa.passed
     )

  union all

  -- mentor sessions you are in
  select 'session', b.id,
         coalesce(b.topic_ar, 'جلسة إرشاد'),
         to_char(b.scheduled_start, 'HH24:MI'),
         case
           when b.status = 'completed' and b.completed_at::date = current_date then 'completed'
           when b.scheduled_start::date = current_date then 'today'
           else 'upcoming'
         end::public.agenda_column,
         b.scheduled_start::date,
         '/bookings/' || b.id::text
    from public.bookings b cross join me cross join horizon
   where b.student_id = me.id
     and (
       (b.status in ('confirmed', 'payment_verified', 'mentor_pending')
        and b.scheduled_start::date between current_date and horizon.until)
       or (b.status = 'completed' and b.completed_at::date = current_date)
     )

  union all

  -- team tasks that are yours
  select 'team_task', t.id, t.title_ar, tm.title_ar,
         case t.column_key
           when 'done'  then 'completed'
           when 'todo'  then (case when t.due_on is not null and t.due_on <= current_date
                                   then 'today' else 'upcoming' end)
           else 'in_progress'
         end::public.agenda_column,
         t.due_on,
         '/teams/' || tm.id::text || '/tasks/' || t.id::text
    from public.team_tasks t
    join public.teams tm on tm.id = t.team_id
    cross join me
   where t.assignee_id = me.id
     and (t.column_key <> 'done' or t.completed_at::date = current_date);
$$;

comment on function public.student_agenda is
  'The daily board. Everything on it already exists somewhere else — this gathers it, it does not own it.';

-- ---------------------------------------------------------------------------
-- The progress picture
-- ---------------------------------------------------------------------------
create or replace function public.student_progress()
returns table (
  paths_joined       integer,
  paths_completed    integer,
  courses_completed  integer,
  lessons_completed  integer,
  work_approved      integer,
  assessments_passed integer,
  sessions_attended  integer,
  team_tasks_done    integer,
  certificates       integer,
  achievements       integer,
  skills_total       integer,
  skills_verified    integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select
    (select count(*) from public.enrollments e, me where e.profile_id = me.id and e.path_id is not null)::int,
    (select count(*) from public.enrollments e, me
      where e.profile_id = me.id and e.path_id is not null and public.is_path_complete(me.id, e.path_id))::int,
    (select count(*) from public.certificates c, me
      where c.profile_id = me.id and c.status = 'active' and c.kind = 'course')::int,
    (select count(*) from public.lesson_progress lp, me
      where lp.profile_id = me.id and lp.status = 'completed')::int,
    (select count(*) from public.submissions s, me
      where s.profile_id = me.id and s.status = 'approved')::int,
    (select count(distinct aa.assessment_id) from public.assessment_attempts aa, me
      where aa.profile_id = me.id and aa.passed)::int,
    (select count(*) from public.bookings b, me
      where b.student_id = me.id and b.status = 'completed')::int,
    (select count(*) from public.team_tasks t, me
      where t.assignee_id = me.id and t.column_key = 'done')::int,
    (select count(*) from public.certificates c, me
      where c.profile_id = me.id and c.status = 'active')::int,
    (select count(*) from public.profile_achievements pa, me where pa.profile_id = me.id)::int,
    (select count(*) from public.profile_skills ps, me where ps.profile_id = me.id)::int,
    (select count(*) from public.profile_skills ps, me where ps.profile_id = me.id and ps.is_verified)::int;
$$;

-- ---------------------------------------------------------------------------
-- What to do next: opportunities and mentors that actually fit
-- ---------------------------------------------------------------------------
create or replace function public.suggested_opportunities(p_limit integer default 4)
returns table (
  id             uuid,
  title_ar       text,
  kind           public.opportunity_kind,
  organization_ar text,
  tags           text[],
  required_skills text[],
  matched_skills text[],
  is_eligible    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select coalesce(array_agg(distinct s.slug), '{}') as skills
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      cross join me
     where ps.profile_id = me.id
  ),
  fields as (
    select coalesce(array_agg(distinct f.slug), '{}') as slugs
      from public.profile_fields pf
      join public.fields f on f.id = pf.field_id
      cross join me
     where pf.profile_id = me.id
  ),
  stars as (
    select coalesce((select ps.stars_avg from public.profile_stars ps, me where ps.profile_id = me.id), 0) as value
  )
  select o.id, o.title_ar, o.kind, o.organization_ar, o.tags, o.required_skills,
         array(select unnest(o.required_skills) intersect select unnest(mine.skills)),
         (stars.value >= coalesce(o.min_stars, 0)
          and (o.required_path_id is null or public.is_path_complete(me.id, o.required_path_id)))
    from public.opportunities o
    cross join me cross join mine cross join fields cross join stars
   where o.status = 'published'
     and o.posted_by <> me.id
     and not exists (
       select 1 from public.opportunity_applications oa
        where oa.opportunity_id = o.id and oa.profile_id = me.id
     )
   order by
     -- skills you already have, then your fields, then the newest
     cardinality(array(select unnest(o.required_skills) intersect select unnest(mine.skills))) desc,
     cardinality(array(select unnest(o.tags) intersect select unnest(fields.slugs))) desc,
     o.created_at desc
   limit greatest(p_limit, 1);
$$;

create or replace function public.suggested_mentors(p_limit integer default 3)
returns table (
  profile_id  uuid,
  full_name   text,
  display_name text,
  avatar_url  text,
  headline_ar text,
  level       public.mentor_level,
  rating_avg  numeric,
  sessions_count integer,
  price_usd   numeric,
  shared_fields text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  fields as (
    select coalesce(array_agg(distinct f.slug), '{}') as slugs
      from public.profile_fields pf
      join public.fields f on f.id = pf.field_id
      cross join me
     where pf.profile_id = me.id
  )
  select mp.profile_id, p.full_name, p.display_name, p.avatar_url, mp.headline_ar,
         mp.level, coalesce(mp.rating_avg, 0), mp.sessions_count, ml.session_price_usd,
         array(select unnest(mp.domains) intersect select unnest(fields.slugs))
    from public.mentor_profiles mp
    join public.profiles p on p.id = mp.profile_id
    join public.mentor_levels ml on ml.level = mp.level
    cross join me cross join fields
   where mp.approved_at is not null
     and mp.is_accepting
     and mp.profile_id <> me.id
   order by
     cardinality(array(select unnest(mp.domains) intersect select unnest(fields.slugs))) desc,
     coalesce(mp.rating_avg, 0) desc,
     mp.sessions_count desc
   limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards: ranked, windowed, and able to answer "where am I?"
--
-- Points are XP: quantity of recorded progress. Rating is stars: quality of
-- reviewed work. They are never added together, and neither is ever a count of
-- followers or logins.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_students_ranked(
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  rank integer, profile_id uuid, techmood_id text, name text, avatar_url text,
  points integer, stars numeric, achievements integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by t.points desc, t.stars desc, t.name))::int,
         t.profile_id, t.techmood_id, t.name, t.avatar_url, t.points, t.stars, t.achievements
    from (
      select p.id as profile_id, p.techmood_id,
             coalesce(p.display_name, p.full_name) as name, p.avatar_url,
             coalesce((select sum(x.xp) from public.xp_events x
                        where x.profile_id = p.id
                          and (p_since is null or x.created_at >= p_since)), 0)::int as points,
             coalesce((select s.stars_avg from public.profile_stars s where s.profile_id = p.id), 0) as stars,
             ((select count(*) from public.profile_achievements pa where pa.profile_id = p.id)
              + (select count(*) from public.certificates c
                  where c.profile_id = p.id and c.status = 'active'))::int as achievements
        from public.profiles p
        join public.profile_roles pr
          on pr.profile_id = p.id and pr.role = 'student' and pr.status = 'approved'
       where p.is_public
    ) t
   order by t.points desc, t.stars desc, t.name
   limit greatest(p_limit, 1);
$$;

create or replace function public.leaderboard_mentors_ranked(
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  rank integer, profile_id uuid, name text, avatar_url text,
  points integer, stars numeric, sessions integer, evaluations integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by t.sessions desc, t.stars desc, t.name))::int,
         t.profile_id, t.name, t.avatar_url, t.points, t.stars, t.sessions, t.evaluations
    from (
      select mp.profile_id,
             coalesce(p.display_name, p.full_name) as name, p.avatar_url,
             coalesce((select sum(x.xp) from public.xp_events x
                        where x.profile_id = mp.profile_id
                          and (p_since is null or x.created_at >= p_since)), 0)::int as points,
             coalesce(mp.rating_avg, 0) as stars,
             mp.sessions_count as sessions,
             (select count(*) from public.evaluations e where e.evaluator_id = mp.profile_id)::int as evaluations
        from public.mentor_profiles mp
        join public.profiles p on p.id = mp.profile_id
       where p.is_public and mp.approved_at is not null
    ) t
   order by t.sessions desc, t.stars desc, t.name
   limit greatest(p_limit, 1);
$$;

create or replace function public.leaderboard_teams_ranked(
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  rank integer, team_id uuid, name text, avatar_url text,
  points integer, stars numeric, projects integer, members integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by t.points desc, t.stars desc, t.name))::int,
         t.team_id, t.name, t.avatar_url, t.points, t.stars, t.projects, t.members
    from (
      select tt.id as team_id, tt.title_ar as name, tt.avatar_url,
             coalesce((select sum(e.xp) from public.team_xp_events e
                        where e.team_id = tt.id
                          and (p_since is null or e.created_at >= p_since)), 0)::int as points,
             coalesce((select round(avg(r.stars), 2) from public.team_reviews r where r.team_id = tt.id), 0) as stars,
             (select count(*) from public.projects pj
               where pj.team_id = tt.id and pj.status = 'completed')::int as projects,
             (select count(*) from public.team_members m where m.team_id = tt.id)::int as members
        from public.teams tt
       where tt.visibility = 'listed'
    ) t
   order by t.points desc, t.stars desc, t.name
   limit greatest(p_limit, 1);
$$;

-- Companies are ranked on what the platform actually records about them: the
-- opportunities they published and the people they took on. There is no company
-- rating yet, because nothing on TechMood rates an employer — that needs a
-- product decision, not a formula invented here.
create or replace function public.leaderboard_companies_ranked(
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  rank integer, profile_id uuid, name text, avatar_url text,
  opportunities integer, seats_filled integer, accepted integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by t.accepted desc, t.opportunities desc, t.name))::int,
         t.profile_id, t.name, t.avatar_url, t.opportunities, t.seats_filled, t.accepted
    from (
      select p.id as profile_id,
             coalesce(p.display_name, p.full_name) as name, p.avatar_url,
             -- published, including the ones now archived because they filled:
             -- filling a post is the outcome, not a reason to stop counting it
             (select count(*) from public.opportunities o
               where o.posted_by = p.id and o.status in ('published', 'archived')
                 and (p_since is null or o.created_at >= p_since))::int as opportunities,
             coalesce((select sum(o.filled_count) from public.opportunities o
                        where o.posted_by = p.id
                          and (p_since is null or o.created_at >= p_since)), 0)::int as seats_filled,
             (select count(*) from public.opportunity_applications oa
               join public.opportunities o2 on o2.id = oa.opportunity_id
              where o2.posted_by = p.id and oa.stage = 'accepted'
                and (p_since is null or oa.created_at >= p_since))::int as accepted
        from public.profiles p
        join public.profile_roles pr
          on pr.profile_id = p.id and pr.role = 'company' and pr.status = 'approved'
       where p.is_public
    ) t
   order by t.accepted desc, t.opportunities desc, t.name
   limit greatest(p_limit, 1);
$$;

-- "Your Rank: #27" — computed over everyone, not over the page you can see.
create or replace function public.my_leaderboard_rank(p_since timestamptz default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with everyone as (
    select p.id,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = p.id
                        and (p_since is null or x.created_at >= p_since)), 0) as points,
           coalesce((select s.stars_avg from public.profile_stars s where s.profile_id = p.id), 0) as stars
      from public.profiles p
      join public.profile_roles pr
        on pr.profile_id = p.id and pr.role = 'student' and pr.status = 'approved'
  ),
  ranked as (
    select id, rank() over (order by points desc, stars desc) as position from everyone
  )
  select position::int from ranked where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Granted on the one new table rather than across the schema: a blanket
-- "grant on all tables" here would silently hand back the INSERT that 0028
-- revoked on role_request_events, which is what keeps that trail append-only
-- in privilege and not only in policy.
grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select on public.focus_sessions to anon;

grant execute on function public.activity_days(date, date)                       to authenticated;
grant execute on function public.current_streak()                                to authenticated;
grant execute on function public.continue_learning()                             to authenticated;
grant execute on function public.student_agenda(integer)                         to authenticated;
grant execute on function public.student_progress()                              to authenticated;
grant execute on function public.suggested_opportunities(integer)                to authenticated;
grant execute on function public.suggested_mentors(integer)                      to authenticated;
grant execute on function public.leaderboard_students_ranked(timestamptz, integer)  to anon, authenticated;
grant execute on function public.leaderboard_mentors_ranked(timestamptz, integer)   to anon, authenticated;
grant execute on function public.leaderboard_teams_ranked(timestamptz, integer)     to anon, authenticated;
grant execute on function public.leaderboard_companies_ranked(timestamptz, integer) to anon, authenticated;
grant execute on function public.my_leaderboard_rank(timestamptz)                to authenticated;
