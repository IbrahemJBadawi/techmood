-- =============================================================================
-- 0043 — What somebody is learning, on their public profile
--
-- The academy's own functions read as the caller — academy_paths() and
-- continue_learning() resolve auth.uid() and take no profile argument, which
-- is exactly what closes them to tampering. That also means they cannot answer
-- "what is this other person learning", which is what a profile needs.
--
-- So this is the read-only, someone-else's-view version, and it is written
-- once rather than inlined into the page: it asks can_see_profile_section()
-- like every other part of a profile, so the owner can narrow it to the
-- professional layer or hide it, and a profile that is switched off answers
-- with nothing. Everything it reports is already public elsewhere — a path is
-- catalogue, a percentage is counted from approved work — but it is reported
-- here because a learning record is the part of an identity that says where
-- somebody is going, not only where they have been.
-- =============================================================================

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
         (select count(*) from public.path_courses pc where pc.path_id = p.id)::int,
         (select count(*) from public.path_courses pc
           where pc.path_id = p.id and public.is_course_complete(p_profile, pc.course_id))::int,
         (
           select case when count(*) = 0 then 0
                  else (count(*) filter (where public.is_course_complete(p_profile, pc.course_id)) * 100 / count(*))::int
                  end
             from public.path_courses pc where pc.path_id = p.id
         ),
         coalesce(public.is_path_complete(p_profile, p.id), false),
         greatest(
           (select max(lp.updated_at)
              from public.path_courses pc
              join public.modules m on m.course_id = pc.course_id
              join public.lessons l on l.module_id = m.id
              join public.lesson_progress lp
                on lp.lesson_id = l.id and lp.profile_id = p_profile
             where pc.path_id = p.id),
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

comment on function public.profile_learning is
  'The paths somebody has joined and how far along each one is, for their profile. It takes a profile because it answers about somebody else — and asks can_see_profile_section() before it answers at all.';

-- Where they are right now: the course and lesson they last opened, named but
-- not linked to their progress in detail. It is the one line that makes a
-- profile read as somebody who is still going rather than a finished résumé.
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
      join public.lessons l on l.id = lp.lesson_id
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

grant execute on function public.profile_learning(uuid) to anon, authenticated;
grant execute on function public.profile_focus(uuid)    to anon, authenticated;
