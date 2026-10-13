-- ============================================================================
-- 0169 — How many members learn each path and each course
--
-- Counts only, never who: a path's learners are the members enrolled in it
-- (joining happens on the first lesson, 0118); a course's are everyone who
-- enrolled in it, bought it, or opened one of its lessons. Every page of the
-- catalogue shows them, so the function is open to visitors too.
-- ============================================================================

create or replace function public.catalog_learners()
returns table (kind text, id uuid, learners integer)
language sql
stable
security definer
set search_path = ''
as $$
  select 'path', e.path_id, count(distinct e.profile_id)::integer
    from public.enrollments e
   where e.path_id is not null
   group by e.path_id
  union all
  select 'course', x.course_id, count(distinct x.profile_id)::integer
    from (
      select e.course_id, e.profile_id from public.enrollments e where e.course_id is not null
      union
      select cp.course_id, cp.profile_id from public.course_purchases cp
      union
      select m.course_id, lp.profile_id
        from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id
        join public.modules m on m.id = l.module_id
    ) x
   group by x.course_id;
$$;

revoke execute on function public.catalog_learners() from public;
grant execute on function public.catalog_learners() to anon, authenticated;
