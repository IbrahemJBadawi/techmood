-- =============================================================================
-- 0041 — Some skills belong to the work, not to the lesson
--
-- 0040 hung every skill on a lesson, which is right for what a lesson teaches
-- and wrong for what a piece of work demands. A path's capstone is built by a
-- team, documented in a repository, written up and walked through on video —
-- and none of that is taught by any single lesson in the path. Under 0040 the
-- only way to record it was to pretend some lesson taught it.
--
-- So an assignment can carry skills of its own, and every rollup unions them
-- in. The direction of travel does not change: a skill is still attached once,
-- to the smallest thing that demands it, and everything above is derived.
--
--     lesson_skills  ┐
--                    ├→ lesson_skills_all() → course_skills() → path_skills()
--     assignment_skills ┘
--
-- What an approval grants widens with it, because submission_skills() reads
-- the same union: finishing a group capstone now proves the teamwork the
-- capstone actually required, not only the topics its courses covered.
-- =============================================================================

create table public.assignment_skills (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  skill_id      uuid not null references public.skills (id) on delete cascade,

  primary key (assignment_id, skill_id)
);

create index assignment_skills_skill_idx on public.assignment_skills (skill_id);

alter table public.assignment_skills enable row level security;

create policy assignment_skills_read_all on public.assignment_skills
  for select to anon, authenticated using (true);

create policy assignment_skills_admin_write on public.assignment_skills
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.assignment_skills to anon, authenticated;
grant insert, update, delete on public.assignment_skills to authenticated;

comment on table public.assignment_skills is
  'A skill the work itself demands rather than the lesson teaching it: teamwork on a group capstone, documentation on a project. Unioned into every rollup.';

-- ---------------------------------------------------------------------------
-- One lesson: what it teaches, plus what its own assignment demands
-- ---------------------------------------------------------------------------
create or replace function public.lesson_skills_all(p_lesson uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
set search_path = ''
as $$
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from public.skills s
   where s.status = 'approved'
     and (
       exists (select 1 from public.lesson_skills ls
                where ls.lesson_id = p_lesson and ls.skill_id = s.id)
       or exists (select 1 from public.assignment_skills asg
                    join public.assignments a on a.id = asg.assignment_id
                   where a.lesson_id = p_lesson and asg.skill_id = s.id)
     )
   order by s.name_ar;
$$;

-- ---------------------------------------------------------------------------
-- The rollups, widened
-- ---------------------------------------------------------------------------
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
       -- what its lessons teach
       exists (
         select 1 from public.lesson_skills ls
           join public.lessons l on l.id = ls.lesson_id
           join public.modules m on m.id = l.module_id
          where m.course_id = p_course and ls.skill_id = s.id)
       -- what its own work demands: the course task, the course project,
       -- and anything a lesson assignment inside it asks for
       or exists (
         select 1 from public.assignment_skills asg
           join public.assignments a on a.id = asg.assignment_id
           left join public.lessons l on l.id = a.lesson_id
           left join public.modules m on m.id = l.module_id
          where asg.skill_id = s.id
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
       -- everything its courses teach or demand
       exists (
         select 1 from public.path_courses pc
           cross join lateral public.course_skills(pc.course_id) cs
          where pc.path_id = p_path and cs.id = s.id)
       -- and what the path's own project demands — the capstone is a team's
       -- work, and no course in the path teaches that
       or exists (
         select 1 from public.assignment_skills asg
           join public.assignments a on a.id = asg.assignment_id
          where a.path_id = p_path and asg.skill_id = s.id)
     )
   order by s.name_ar;
$$;

-- ---------------------------------------------------------------------------
-- And what an approval proves widens with it
-- ---------------------------------------------------------------------------
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
     -- the skills the work itself demands, whatever kind it is
     exists (select 1 from public.assignment_skills asg
              where asg.assignment_id = t.assignment_id and asg.skill_id = s.id)
     -- plus what the thing it belongs to teaches
     or (t.kind = 'lesson_assignment' and exists (
           select 1 from public.lesson_skills ls
            where ls.lesson_id = t.lesson_id and ls.skill_id = s.id))
     or (t.kind in ('course_task', 'course_project') and exists (
           select 1 from public.course_skills(t.course_id) cs where cs.id = s.id))
     or (t.kind = 'path_project' and exists (
           select 1 from public.path_skills(t.path_id) ps where ps.id = s.id))
   order by s.name_ar;
$$;

grant execute on function public.lesson_skills_all(uuid) to anon, authenticated;
grant execute on function public.course_skills(uuid)     to anon, authenticated;
grant execute on function public.path_skills(uuid)       to anon, authenticated;
grant execute on function public.submission_skills(uuid) to authenticated;
