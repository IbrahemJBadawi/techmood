-- =============================================================================
-- 0078 — Everything in the catalogue can be switched on, off, or "coming soon"
--
-- The admin asked to enable, disable, add, edit or announce every path,
-- course, lesson and project. Paths and courses always had a status; lessons
-- and a course's projects (assignments) had none, so a lesson could only exist
-- or be deleted. Both now carry the same four states the catalogue already
-- speaks: draft (being written, invisible), planned («قريباً», its title shown,
-- not openable), published, archived (switched off).
--
-- The rule that matters is what those states do to people's progress:
--
--   * **Published and planned count; draft and archived do not.** A lesson or
--     course announced as coming soon is part of what finishing means — the
--     thing is not finished while a part of it is still coming. One that is
--     switched off, or not yet announced, is not held against anybody.
--   * **Only published can be done.** Nobody completes a lesson, or submits to
--     a project, that is not open yet.
--
-- Every function that counts lessons toward a percentage or a certificate is
-- re-stated below with that filter — generated from its latest definition and
-- checked line by line, not rewritten by hand.
--
-- And the owner's rule for paths, which replaces the old one: **a path with at
-- least one ready course is open; a path with none is «قريباً».** It is kept
-- true by triggers, not by whoever remembers to click. An admin can still
-- switch a path off (archived) or hold it back (draft); the rule only moves a
-- path between open and coming-soon.
--
-- Conflict, resolved by the owner's instruction: 0036 refused to publish a
-- path until *every* required course was published. The new rule opens it
-- with one. A path certificate still needs every announced course finished,
-- so opening early never makes the certificate cheaper.
-- =============================================================================

alter table public.lessons
  add column status public.content_status not null default 'published';

alter table public.assignments
  add column status public.content_status not null default 'published';

-- What a learner may see: open things, and the titles of things coming.
drop policy lessons_read_all on public.lessons;
create policy lessons_read_all on public.lessons
  for select to anon, authenticated
  using (status in ('published', 'planned') or public.is_admin());

drop policy assignments_read_all on public.assignments;
create policy assignments_read_all on public.assignments
  for select to anon, authenticated
  using (status in ('published', 'planned') or public.is_admin());

-- A course counts toward its path while it is open or announced.
create or replace function public.course_counts_in_path(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses c
                  where c.id = p_course and c.status in ('published', 'planned'));
$$;

grant execute on function public.course_counts_in_path(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Only an open lesson can be completed; only an open project submitted to
-- ---------------------------------------------------------------------------
create or replace function public.enforce_open_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and not exists (select 1 from public.lessons l where l.id = new.lesson_id and l.status = 'published') then
    raise exception 'هذا الدرس غير متاح حالياً';
  end if;
  return new;
end;
$$;

create trigger lesson_progress_open_lesson
  before insert or update of status on public.lesson_progress
  for each row execute function public.enforce_open_lesson();

create or replace function public.enforce_open_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.assignments a
                  where a.id = new.assignment_id and a.status = 'published') then
    raise exception 'هذا المشروع غير متاح للتسليم حالياً';
  end if;
  return new;
end;
$$;

create trigger submissions_open_assignment
  before insert on public.submissions
  for each row execute function public.enforce_open_assignment();

-- ---------------------------------------------------------------------------
-- Completion: published and announced count, draft and switched-off do not
-- ---------------------------------------------------------------------------
create or replace function public.course_lessons_completed(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    left join public.lesson_progress lp
           on lp.lesson_id = l.id and lp.profile_id = p_profile
    where m.course_id = p_course
      and l.status in ('published', 'planned')
      and coalesce(lp.status, 'available') <> 'completed'
  );
$$;

create or replace function public.course_work_approved(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.assignments a
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
    left join public.submissions s
           on s.assignment_id = a.id and s.profile_id = p_profile
    where a.is_required
      and a.status in ('published', 'planned')
      and (a.course_id = p_course or (m.course_id = p_course and l.status in ('published', 'planned')))
      and coalesce(s.status, 'draft') <> 'approved'
  );
$$;

create or replace function public.is_path_complete(p_profile uuid, p_path uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.path_courses pc
      where pc.path_id = p_path
        and pc.is_required
        and public.course_counts_in_path(pc.course_id)
        and not public.is_course_complete(p_profile, pc.course_id)
    )
    and not exists (
      select 1
      from public.assignments a
      left join public.submissions s
             on s.assignment_id = a.id and s.profile_id = p_profile
      where a.path_id = p_path
        and a.kind = 'path_project'
        and a.is_required
        and a.status in ('published', 'planned')
        and coalesce(s.status, 'draft') <> 'approved'
    );
$$;

create or replace function public.credential_application_done(p_profile uuid, p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not coalesce((select lc.requires_application from public.lesson_credentials lc
                        where lc.lesson_id = p_lesson), false) then true
    else exists (
      select 1 from public.assignments a
       where a.lesson_id = p_lesson and a.is_required and a.status in ('published', 'planned')
    ) and not exists (
      select 1 from public.assignments a
      left join public.submissions s
             on s.assignment_id = a.id and s.profile_id = p_profile
       where a.lesson_id = p_lesson and a.is_required and a.status in ('published', 'planned')
         and coalesce(s.status, 'draft') <> 'approved'
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Percentages and plans: the same filter, applied to the latest definitions
-- ---------------------------------------------------------------------------
create or replace function public.academy_courses()
returns table (
  id              uuid,
  slug            text,
  title_ar        text,
  title_en        text,
  description_ar  text,
  estimated_hours integer,
  level           public.course_level,
  modules_count   integer,
  lessons_count   integer,
  lessons_done    integer,
  percent         integer,
  is_complete     boolean,
  status          text,
  xp_award        integer,
  path_slugs      text[],
  path_titles_ar  text[],
  path_titles_en  text[],
  school_slugs    text[],
  in_enrolled_path boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  lesson_counts as (
    select m.course_id,
           count(l.id)::int as lessons,
           count(distinct m.id)::int as modules
      from public.modules m
      left join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
     group by m.course_id
  ),
  done_counts as (
    select m.course_id, count(*)::int as done
      from public.modules m
      join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
      join public.lesson_progress lp on lp.lesson_id = l.id
      cross join me
     where lp.profile_id = me.id and lp.status = 'completed'
     group by m.course_id
  )
  select c.id,
         c.slug,
         c.title_ar,
         c.title_en,
         c.description_ar,
         c.estimated_hours,
         c.level,
         coalesce(lc.modules, 0),
         coalesce(lc.lessons, 0),
         coalesce(dc.done, 0),
         case when coalesce(lc.lessons, 0) = 0 then 0
              else (coalesce(dc.done, 0) * 100 / lc.lessons)::int end,
         coalesce(public.is_course_complete(me.id, c.id), false),
         case
           when coalesce(public.is_course_complete(me.id, c.id), false) then 'completed'
           when coalesce(dc.done, 0) > 0 then 'in_progress'
           else 'not_started'
         end,
         (select r.base_xp from public.xp_rules r where r.source = 'course_completed'),
         -- a course has no school of its own; its domains are the paths carrying it
         coalesce((select array_agg(p.slug order by p.sort_order)
                     from public.path_courses pc
                     join public.learning_paths p on p.id = pc.path_id
                    where pc.course_id = c.id and p.status = 'published'), '{}'),
         coalesce((select array_agg(p.title_ar order by p.sort_order)
                     from public.path_courses pc
                     join public.learning_paths p on p.id = pc.path_id
                    where pc.course_id = c.id and p.status = 'published'), '{}'),
         coalesce((select array_agg(coalesce(p.title_en, p.title_ar) order by p.sort_order)
                     from public.path_courses pc
                     join public.learning_paths p on p.id = pc.path_id
                    where pc.course_id = c.id and p.status = 'published'), '{}'),
         coalesce((select array_agg(distinct s.slug)
                     from public.path_courses pc
                     join public.learning_paths p on p.id = pc.path_id
                     join public.schools s on s.id = p.school_id
                    where pc.course_id = c.id and p.status = 'published'), '{}'),
         exists (
           select 1 from public.path_courses pc
             join public.enrollments e on e.path_id = pc.path_id
            where pc.course_id = c.id and e.profile_id = me.id
         )
    from public.courses c
    left join lesson_counts lc on lc.course_id = c.id
    left join done_counts dc on dc.course_id = c.id
    cross join me
   where c.status = 'published'
   order by c.level, c.title_ar;
$$;

create or replace function public.academy_paths()
returns table (
  id              uuid,
  slug            text,
  title_ar        text,
  title_en        text,
  description_ar  text,
  tagline_ar      text,
  tags            text[],
  estimated_hours integer,
  school_slug     text,
  school_name_ar  text,
  school_name_en  text,
  courses_total   integer,
  courses_done    integer,
  percent         integer,
  is_enrolled     boolean,
  is_complete     boolean,
  status          text,
  level_from      public.course_level,
  level_to        public.course_level,
  last_activity   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select p.id,
         p.slug,
         p.title_ar,
         p.title_en,
         p.description_ar,
         p.tagline_ar,
         p.tags,
         p.estimated_hours,
         s.slug,
         s.name_ar,
         s.name_en,
         (select count(*) from public.path_courses pc where pc.path_id = p.id and public.course_counts_in_path(pc.course_id))::int,
         (select count(*) from public.path_courses pc
           where pc.path_id = p.id and public.course_counts_in_path(pc.course_id) and public.is_course_complete(me.id, pc.course_id))::int,
         (
           select case when count(*) = 0 then 0
                  else (count(*) filter (where public.is_course_complete(me.id, pc.course_id)) * 100 / count(*))::int
                  end
             from public.path_courses pc where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)
         ),
         exists (select 1 from public.enrollments e
                  where e.profile_id = me.id and e.path_id = p.id),
         coalesce(public.is_path_complete(me.id, p.id), false),
         case
           when coalesce(public.is_path_complete(me.id, p.id), false) then 'completed'
           when exists (
             select 1
               from public.path_courses pc
               join public.modules m  on m.course_id = pc.course_id
               join public.lessons l  on l.module_id = m.id and l.status in ('published', 'planned')
               join public.lesson_progress lp
                 on lp.lesson_id = l.id and lp.profile_id = me.id
              where pc.path_id = p.id and public.course_counts_in_path(pc.course_id) and lp.status <> 'available'
           ) then 'in_progress'
           else 'not_started'
         end,
         -- the range the path covers, read off its own courses
         (select min(c.level) from public.path_courses pc
            join public.courses c on c.id = pc.course_id where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)),
         (select max(c.level) from public.path_courses pc
            join public.courses c on c.id = pc.course_id where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)),
         greatest(
           (select max(lp.updated_at)
              from public.path_courses pc
              join public.modules m on m.course_id = pc.course_id
              join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
              join public.lesson_progress lp
                on lp.lesson_id = l.id and lp.profile_id = me.id
             where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)),
           (select e.enrolled_at from public.enrollments e
             where e.profile_id = me.id and e.path_id = p.id)
         )
    from public.learning_paths p
    left join public.schools s on s.id = p.school_id
    cross join me
   where p.status = 'published'
   order by p.sort_order;
$$;

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
      join public.lessons l  on l.id = lp.lesson_id and l.status in ('published', 'planned')
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
      join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
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
            where pc.path_id = ch.path_id and public.course_counts_in_path(pc.course_id)
         ),
         -- a course's progress is its lessons that are complete
         (
           select case when count(l.id) = 0 then 0
                  else (count(lp.lesson_id) filter (where lp.status = 'completed') * 100 / count(l.id))::int
                  end
             from public.modules m
             join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
             left join public.lesson_progress lp
               on lp.lesson_id = l.id and lp.profile_id = (select auth.uid())
            where m.course_id = ch.course_id
         ),
         ch.updated_at
    from chosen ch
    left join next_lesson nl on true;
$$;

create or replace function public.profile_learning(p_profile uuid)
returns table (
  path_slug     text,
  title_ar      text,
  title_en      text,
  school_name   text,
  courses_total integer,
  courses_done  integer,
  percent       integer,
  is_complete   boolean,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug,
         p.title_ar,
         p.title_en,
         s.name_ar,
         (select count(*) from public.path_courses pc where pc.path_id = p.id and public.course_counts_in_path(pc.course_id))::int,
         (select count(*) from public.path_courses pc
           where pc.path_id = p.id and public.course_counts_in_path(pc.course_id) and public.is_course_complete(p_profile, pc.course_id))::int,
         (
           select case when count(*) = 0 then 0
                  else (count(*) filter (where public.is_course_complete(p_profile, pc.course_id)) * 100 / count(*))::int
                  end
             from public.path_courses pc where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)
         ),
         coalesce(public.is_path_complete(p_profile, p.id), false),
         greatest(
           (select max(lp.updated_at)
              from public.path_courses pc
              join public.modules m on m.course_id = pc.course_id
              join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
              join public.lesson_progress lp
                on lp.lesson_id = l.id and lp.profile_id = p_profile
             where pc.path_id = p.id and public.course_counts_in_path(pc.course_id)),
           e.enrolled_at
         )
    from public.enrollments e
    join public.learning_paths p on p.id = e.path_id
    left join public.schools s on s.id = p.school_id
   where e.profile_id = p_profile
     and p.status = 'published'
     and public.can_see_profile_section(p_profile, 'learning')
   order by coalesce(public.is_path_complete(p_profile, p.id), false), p.sort_order;
$$;

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
               join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
               left join public.lesson_progress lp
                 on lp.lesson_id = l.id and lp.profile_id = me.id
              where m.course_id = gs.course_id)
           when 'path' then (
             select case when count(*) = 0 then 0
                    else (count(*) filter (where public.is_course_complete(me.id, pc.course_id)) * 100 / count(*))::int end
               from public.path_courses pc where pc.path_id = gs.path_id and public.course_counts_in_path(pc.course_id))
           else null
         end
    from public.career_goal_steps gs
    join public.career_goals g on g.id = gs.goal_id
    cross join me
   where g.slug = p_goal and g.status = 'published'
   order by gs.sort_order;
$$;

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
    join public.lessons l on l.module_id = m.id and l.status in ('published', 'planned')
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

create or replace function public.profile_focus(p_profile uuid)
returns table (
  path_slug    text,
  path_title   text,
  course_slug  text,
  course_title text,
  lesson_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  with recent as (
    select l.title_ar as lesson_title, c.id as course_id, c.slug as course_slug,
           c.title_ar as course_title, lp.updated_at
      from public.lesson_progress lp
      join public.lessons l on l.id = lp.lesson_id and l.status in ('published', 'planned')
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
     where lp.profile_id = p_profile
       and public.can_see_profile_section(p_profile, 'learning')
     order by lp.updated_at desc
     limit 1
  )
  select p.slug, p.title_ar, r.course_slug, r.course_title, r.lesson_title
    from recent r
    join public.path_courses pc on pc.course_id = r.course_id
    join public.learning_paths p on p.id = pc.path_id
    join public.enrollments e on e.path_id = p.id and e.profile_id = p_profile
   order by e.enrolled_at desc
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- A path is open with one ready course, «قريباً» with none
-- ---------------------------------------------------------------------------
create or replace function public.sync_path_status(p_path uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- draft (held back) and archived (switched off) are the admin's to set; the
  -- rule only moves a path between open and coming soon
  update public.learning_paths p
     set status = case
           when exists (select 1 from public.path_courses pc
                          join public.courses c on c.id = pc.course_id
                         where pc.path_id = p.id and c.status = 'published')
           then 'published'::public.content_status
           else 'planned'::public.content_status
         end
   where p.id = p_path
     and p.status in ('planned', 'published');
end;
$$;

create or replace function public.guard_path_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and not exists (select 1 from public.path_courses pc
                       join public.courses c on c.id = pc.course_id
                      where pc.path_id = new.id and c.status = 'published') then
    raise exception 'لا يُفتح مسار ليس فيه دورة واحدة جاهزة على الأقل';
  end if;
  return new;
end;
$$;

create or replace function public.path_status_after_course()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path uuid;
begin
  if tg_table_name = 'path_courses' then
    perform public.sync_path_status(coalesce(new.path_id, old.path_id));
    if tg_op = 'UPDATE' and new.path_id is distinct from old.path_id then
      perform public.sync_path_status(old.path_id);
    end if;
  else
    for v_path in select pc.path_id from public.path_courses pc where pc.course_id = new.id
    loop
      perform public.sync_path_status(v_path);
    end loop;
  end if;
  return null;
end;
$$;

create trigger courses_sync_paths
  after update of status on public.courses
  for each row execute function public.path_status_after_course();

create trigger path_courses_sync_paths
  after insert or update or delete on public.path_courses
  for each row execute function public.path_status_after_course();

-- The rule applies to what exists today, not only to what changes tomorrow.
select public.sync_path_status(p.id) from public.learning_paths p;

-- ---------------------------------------------------------------------------
-- The Claude Code course is a course of the AI path
--
-- It joins «مسار الذكاء الاصطناعي التوليدي» as a required course. While it is a
-- draft it does not count — nobody's path is held up by a course they cannot
-- see — and the moment an admin announces it or publishes it, it does.
-- ---------------------------------------------------------------------------
insert into public.path_courses (path_id, course_id, is_required, sort_order)
select p.id, c.id, true,
       coalesce((select max(pc.sort_order) + 1 from public.path_courses pc where pc.path_id = p.id), 1)
  from public.learning_paths p, public.courses c
 where p.slug = 'genai' and c.slug = 'claude-code'
on conflict (path_id, course_id) do nothing;

-- ---------------------------------------------------------------------------
-- What a course or path teaches, and what finishing its work proves
-- ---------------------------------------------------------------------------
-- Two gaps this migration opens unless they are closed here:
--
--  * A draft or archived lesson, or a draft course inside a path, would still
--    be advertised as something the course/path teaches.
--  * A course task or a path project would hand out the skills of a credential
--    lesson (0073) inside it — the Claude Code course now sits in the AI path,
--    so approving the AI path project would have written "Claude Code" onto a
--    profile that never showed the credential. Credential lessons grant their
--    skills only through grant_credential_lesson_skills, never through a
--    rollup.
create or replace function public.course_skills(p_course uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
set search_path = ''
as $$
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from public.skills s
   where s.status = 'approved'
     and (
       exists (
         select 1 from public.lesson_skills ls
           join public.lessons l on l.id = ls.lesson_id
           join public.modules m on m.id = l.module_id
          where m.course_id = p_course and ls.skill_id = s.id
            and l.status in ('published', 'planned'))
       or exists (
         select 1 from public.assignment_skills asg
           join public.assignments a on a.id = asg.assignment_id
           left join public.lessons l on l.id = a.lesson_id
           left join public.modules m on m.id = l.module_id
          where asg.skill_id = s.id
            and a.status in ('published', 'planned')
            and (a.course_id = p_course or m.course_id = p_course))
     )
   order by s.name_ar;
$$;

create or replace function public.path_skills(p_path uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
set search_path = ''
as $$
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from public.skills s
   where s.status = 'approved'
     and (
       exists (
         select 1 from public.path_courses pc
           cross join lateral public.course_skills(pc.course_id) cs
          where pc.path_id = p_path and cs.id = s.id
            and public.course_counts_in_path(pc.course_id))
       or exists (
         select 1 from public.assignment_skills asg
           join public.assignments a on a.id = asg.assignment_id
          where a.path_id = p_path and asg.skill_id = s.id)
     )
   order by s.name_ar;
$$;

-- What approving a course's own work proves: its lessons' skills except those
-- of credential lessons, plus everything its assignments demand.
create or replace function public.course_earned_skills(p_course uuid)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select ls.skill_id
    from public.lesson_skills ls
    join public.lessons l on l.id = ls.lesson_id
    join public.modules m on m.id = l.module_id
   where m.course_id = p_course
     and l.status in ('published', 'planned')
     and not public.is_credential_lesson(l.id)
  union
  select asg.skill_id
    from public.assignment_skills asg
    join public.assignments a on a.id = asg.assignment_id
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
   where a.status in ('published', 'planned')
     and (a.course_id = p_course or m.course_id = p_course);
$$;

revoke execute on function public.course_earned_skills(uuid) from public, anon;
grant execute on function public.course_earned_skills(uuid) to authenticated;

create or replace function public.submission_skills(p_submission uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select a.id as assignment_id, a.kind, a.lesson_id, a.course_id, a.path_id
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
     where s.id = p_submission
  )
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from target t
    join public.skills s on s.status = 'approved'
   where
     exists (select 1 from public.assignment_skills asg
              where asg.assignment_id = t.assignment_id and asg.skill_id = s.id)
     or (t.kind = 'lesson_assignment' and exists (
           select 1 from public.lesson_skills ls
            where ls.lesson_id = t.lesson_id and ls.skill_id = s.id))
     or (t.kind in ('course_task', 'course_project') and exists (
           select 1 from public.course_earned_skills(t.course_id) ce where ce.id = s.id))
     or (t.kind = 'path_project' and (
           exists (select 1 from public.path_courses pc
                    cross join lateral public.course_earned_skills(pc.course_id) ce
                    where pc.path_id = t.path_id and ce.id = s.id
                      and public.course_counts_in_path(pc.course_id))
           or exists (select 1 from public.assignment_skills asg
                        join public.assignments a on a.id = asg.assignment_id
                       where a.path_id = t.path_id and asg.skill_id = s.id)))
   order by s.name_ar;
$$;

grant execute on function public.course_skills(uuid)     to anon, authenticated;
grant execute on function public.path_skills(uuid)       to anon, authenticated;
grant execute on function public.submission_skills(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The admin's switch for a path
--
-- Open and «قريباً» follow the rule above, so the admin does not pick between
-- them; what the admin picks is whether the rule applies at all:
--   auto     — open with a ready course, «قريباً» without one
--   draft    — held back: not shown on the map
--   archived — switched off: not shown, and no course change reopens it
-- ---------------------------------------------------------------------------
create or replace function public.set_path_mode(p_path uuid, p_mode text)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.content_status;
begin
  if not public.is_admin() then
    raise exception 'إدارة المسارات للإدارة فقط';
  end if;

  if p_mode not in ('auto', 'draft', 'archived') then
    raise exception 'وضع غير معروف: %', p_mode;
  end if;

  if p_mode = 'auto' then
    update public.learning_paths set status = 'planned' where id = p_path;
    perform public.sync_path_status(p_path);
  else
    update public.learning_paths set status = p_mode::public.content_status where id = p_path;
  end if;

  select status into v_status from public.learning_paths where id = p_path;
  if v_status is null then
    raise exception 'المسار غير موجود';
  end if;
  return v_status;
end;
$$;

grant execute on function public.set_path_mode(uuid, text) to authenticated;
