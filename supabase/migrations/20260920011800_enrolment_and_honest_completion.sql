-- =============================================================================
-- 0118 — Joining a path is kept, and «complete» means something was done
--
-- Reported by the founder with a new student account:
--
--   1. «I choose a path and it keeps asking me to choose one.» Joining a path
--      never saved. The app wrote the enrolment with an upsert on
--      (profile_id, path_id), but the only unique index there is partial
--      (… WHERE path_id IS NOT NULL), which ON CONFLICT cannot use without the
--      same WHERE — so every join failed, and the action did not show the
--      error. Joining now goes through enrol_in_path(), which names the index
--      properly and refuses a hidden or switched-off path.
--      Starting a course's first lesson also joins its path, so a learner who
--      went straight to a course is not asked to «choose a path» afterwards.
--
--   2. «A brand-new student has three certificates ready.» Completion was
--      worked out as «nothing required is left undone», which is true of a
--      course with no lessons and of a path whose required courses are not
--      open yet. Now a course is complete only when it has lessons and every
--      one is done (with its required work approved and tests passed), and a
--      path only when it requires something — a course or a project — and all
--      of it is done. The certificates issued on that mistake are revoked.
--
-- The learners already caught by (1) are joined to the path of the lessons
-- they have been doing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Joining a path
-- ---------------------------------------------------------------------------
create or replace function public.enrol_in_path(p_path uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if not exists (select 1 from public.learning_paths
                  where id = p_path and status in ('published', 'planned')) then
    raise exception 'هذا المسار غير متاح للالتحاق';
  end if;

  insert into public.enrollments (profile_id, path_id)
  values (v_me, p_path)
  on conflict (profile_id, path_id) where path_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.enrollments where profile_id = v_me and path_id = p_path;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.enrol_in_path(uuid) from public, anon;
grant execute on function public.enrol_in_path(uuid) to authenticated;

-- Starting a lesson joins its path, when the learner is on none of the paths
-- that carry the course: the first open path in the catalogue's order.
create or replace function public.enrol_on_first_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_path   uuid;
begin
  select m.course_id into v_course
    from public.lessons l join public.modules m on m.id = l.module_id
   where l.id = new.lesson_id;
  if v_course is null then
    return new;
  end if;

  if exists (select 1 from public.enrollments e
               join public.path_courses pc on pc.path_id = e.path_id
              where e.profile_id = new.profile_id and pc.course_id = v_course) then
    return new;
  end if;

  select lp.id into v_path
    from public.path_courses pc join public.learning_paths lp on lp.id = pc.path_id
   where pc.course_id = v_course and lp.status = 'published'
   order by lp.sort_order, lp.slug
   limit 1;

  if v_path is not null then
    -- dated when the learning started, so joining is not a second «activity»
    insert into public.enrollments (profile_id, path_id, enrolled_at)
    values (new.profile_id, v_path, least(now(), coalesce(new.updated_at, now())))
    on conflict (profile_id, path_id) where path_id is not null do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.enrol_on_first_lesson() from public, anon, authenticated;

drop trigger if exists lesson_progress_enrols on public.lesson_progress;
create trigger lesson_progress_enrols
  after insert on public.lesson_progress
  for each row execute function public.enrol_on_first_lesson();

-- ---------------------------------------------------------------------------
-- 2. Complete means done, never «nothing to do»
-- ---------------------------------------------------------------------------
create or replace function public.is_course_complete(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- a course with no lesson (yet) has nothing to complete
  select exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
                  where m.course_id = p_course and l.status in ('published', 'planned'))
     and public.course_lessons_completed(p_profile, p_course)
     and public.course_work_approved(p_profile, p_course)
     and public.course_assessments_passed(p_profile, p_course);
$$;

create or replace function public.is_path_complete(p_profile uuid, p_path uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- the path requires something that exists: a course that is open or
    -- announced, or a project …
    (exists (select 1 from public.path_courses pc
              where pc.path_id = p_path and pc.is_required and public.course_counts_in_path(pc.course_id))
     or exists (select 1 from public.assignments a
                 where a.path_id = p_path and a.kind = 'path_project' and a.is_required
                   and a.status in ('published', 'planned')))
    -- … and every required course is complete …
    and not exists (
      select 1
      from public.path_courses pc
      where pc.path_id = p_path
        and pc.is_required
        and public.course_counts_in_path(pc.course_id)
        and not public.is_course_complete(p_profile, pc.course_id)
    )
    -- … and every required project approved.
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

-- ---------------------------------------------------------------------------
-- 3. Repair what the two mistakes left behind
-- ---------------------------------------------------------------------------
-- The points those certificates gave (issue_certificate awards course_completed
-- / path_completed), for work that was never there.
delete from public.xp_events x
 where (x.source = 'path_completed' and x.ref_table = 'learning_paths'
        and not public.is_path_complete(x.profile_id, x.ref_id))
    or (x.source = 'course_completed' and x.ref_table = 'courses'
        and not public.is_course_complete(x.profile_id, x.ref_id));

-- Certificates issued for work that was never there.
update public.certificates c
   set status = 'revoked', revoked_at = now(),
       revoked_reason = 'أُصدرت بخطأ في حساب الاكتمال (مسار أو دورة بلا متطلبات جاهزة) — 0118'
 where c.status = 'active'
   and ((c.kind = 'path' and not public.is_path_complete(c.profile_id, c.path_id))
     or (c.kind = 'course' and not public.is_course_complete(c.profile_id, c.course_id)));

-- Learners who studied without the join ever saving: the path of their lessons.
insert into public.enrollments (profile_id, path_id, enrolled_at)
select distinct on (lp.profile_id, m.course_id) lp.profile_id, first_path.id, lp.updated_at
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.modules m on m.id = l.module_id
  cross join lateral (
    select p.id from public.path_courses pc join public.learning_paths p on p.id = pc.path_id
     where pc.course_id = m.course_id and p.status = 'published'
     order by p.sort_order, p.slug limit 1
  ) first_path
 where not exists (select 1 from public.enrollments e
                     join public.path_courses pc on pc.path_id = e.path_id
                    where e.profile_id = lp.profile_id and pc.course_id = m.course_id)
 order by lp.profile_id, m.course_id, lp.updated_at
on conflict (profile_id, path_id) where path_id is not null do nothing;
