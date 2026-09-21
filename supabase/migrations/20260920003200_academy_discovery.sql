-- =============================================================================
-- TechMood — 0032 The academy as a discovery surface
--
-- The academy page stops being a catalogue listing and becomes the place a
-- learner decides from: discover → choose → continue. That needs three things
-- the schema did not have.
--
-- 1. A course level. Neither learning_paths nor courses carried one, so "Level"
--    on a card and a level filter had nothing to read. It is added here as a
--    real column and backfilled from the catalogue's own shape: every path is
--    three courses that escalate, so a course's position in its path IS its
--    level. Nothing is invented — the ordering was already there.
--
--    A PATH deliberately gets no level of its own. All six paths start from
--    scratch and end well past it, so a path spans a range; the range is
--    derived from its courses rather than stored as a point that would be
--    wrong for one end or the other.
--
-- 2. One round trip per section. The path page asks is_course_complete() once
--    per course, which is right for one path and quadratic for a page showing
--    every path. academy_paths() and academy_courses() do that work in the
--    database and hand back a row per card.
--
-- 3. The same definition of "complete" everywhere. Both functions call
--    is_course_complete() and is_path_complete(), so a card, the path page and
--    the certificate rule can never disagree about what finished means.
--
-- Both functions read as the caller through auth.uid() and take no profile
-- argument, like the rest of 0030: a learner's progress cannot be fetched by
-- putting somebody else's id in a request.
-- =============================================================================

create type public.course_level as enum ('beginner', 'intermediate', 'advanced');

alter table public.courses
  add column level public.course_level not null default 'beginner';

comment on column public.courses.level is
  'Where the course sits on the ladder. Backfilled from its position in its path, which is how the catalogue was built.';

-- Position 1 starts from nothing, 2 builds on it, 3 and beyond apply it. A
-- course in several paths takes the earliest position it holds in any of them,
-- because that is the earliest point a learner could legitimately meet it.
--
-- This lives in a function rather than as a bare UPDATE because it has two
-- callers: this migration, for a database that already holds a catalogue, and
-- seed.sql, which loads the catalogue after every migration has run. One copy
-- of the rule, so the two can never drift.
create or replace function public.backfill_course_levels()
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.courses c
       set level = case least(pos.first_position, 3)
                     when 1 then 'beginner'
                     when 2 then 'intermediate'
                     else 'advanced'
                   end::public.course_level
      from (
        select pc.course_id, min(pc.sort_order) as first_position
          from public.path_courses pc
         group by pc.course_id
      ) pos
     where pos.course_id = c.id
    returning 1
  )
  select count(*)::int from updated;
$$;

comment on function public.backfill_course_levels is
  'Sets every course level from its earliest position in a path. Safe to re-run; run it after loading or changing the catalogue.';

revoke execute on function public.backfill_course_levels() from public, anon, authenticated;

select public.backfill_course_levels();

-- ---------------------------------------------------------------------------
-- One row per path, ready to render
-- ---------------------------------------------------------------------------
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
         (select count(*) from public.path_courses pc where pc.path_id = p.id)::int,
         (select count(*) from public.path_courses pc
           where pc.path_id = p.id and public.is_course_complete(me.id, pc.course_id))::int,
         (
           select case when count(*) = 0 then 0
                  else (count(*) filter (where public.is_course_complete(me.id, pc.course_id)) * 100 / count(*))::int
                  end
             from public.path_courses pc where pc.path_id = p.id
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
               join public.lessons l  on l.module_id = m.id
               join public.lesson_progress lp
                 on lp.lesson_id = l.id and lp.profile_id = me.id
              where pc.path_id = p.id and lp.status <> 'available'
           ) then 'in_progress'
           else 'not_started'
         end,
         -- the range the path covers, read off its own courses
         (select min(c.level) from public.path_courses pc
            join public.courses c on c.id = pc.course_id where pc.path_id = p.id),
         (select max(c.level) from public.path_courses pc
            join public.courses c on c.id = pc.course_id where pc.path_id = p.id),
         greatest(
           (select max(lp.updated_at)
              from public.path_courses pc
              join public.modules m on m.course_id = pc.course_id
              join public.lessons l on l.module_id = m.id
              join public.lesson_progress lp
                on lp.lesson_id = l.id and lp.profile_id = me.id
             where pc.path_id = p.id),
           (select e.enrolled_at from public.enrollments e
             where e.profile_id = me.id and e.path_id = p.id)
         )
    from public.learning_paths p
    left join public.schools s on s.id = p.school_id
    cross join me
   where p.status = 'published'
   order by p.sort_order;
$$;

comment on function public.academy_paths is
  'A card per published path, with this caller''s standing on it. Completion comes from is_path_complete(), never from a local average.';

-- ---------------------------------------------------------------------------
-- One row per course, ready to render
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
      left join public.lessons l on l.module_id = m.id
     group by m.course_id
  ),
  done_counts as (
    select m.course_id, count(*)::int as done
      from public.modules m
      join public.lessons l on l.module_id = m.id
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

comment on function public.academy_courses is
  'A card per published course. A course belongs to no school of its own — its domains are the paths that carry it, which is why they come back as arrays.';

grant execute on function public.academy_paths()   to authenticated;
grant execute on function public.academy_courses() to authenticated;
