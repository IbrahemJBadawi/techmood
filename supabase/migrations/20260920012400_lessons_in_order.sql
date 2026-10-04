-- =============================================================================
-- 0124 — Lessons open in order
--
-- The founder's rule: inside a course, a lesson opens once the one before it
-- is finished. Courses themselves stay open in any order — only lessons are
-- sequenced. "The one before" is the previous open (published) lesson in the
-- course's order (module, then lesson); lessons not yet published are skipped,
-- so an announced lesson never blocks the ones after it.
--
-- Completing a locked lesson is refused here, whatever the client does; the
-- pages ask lesson_unlocked() / course_lesson_locks() to show the lock.
-- Admins and the course's own mentor (its author) are never locked out.
-- =============================================================================

-- The previous open lesson of the same course, or null for the first.
create or replace function public.previous_lesson(p_lesson uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id, m.course_id, m.sort_order as m_sort, l.sort_order as l_sort, l.created_at
      from public.lessons l join public.modules m on m.id = l.module_id
     where l.id = p_lesson
  )
  select l.id
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join mine on mine.course_id = m.course_id
   where l.status = 'published' and l.id <> mine.id
     and (m.sort_order, l.sort_order, l.created_at) < (mine.m_sort, mine.l_sort, mine.created_at)
   order by m.sort_order desc, l.sort_order desc, l.created_at desc
   limit 1;
$$;

revoke execute on function public.previous_lesson(uuid) from public, anon, authenticated;

-- Whether this member may open the lesson now.
create or replace function public.lesson_unlocked(p_lesson uuid, p_profile uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
                   join public.courses c on c.id = m.course_id
                  where l.id = p_lesson and c.author_id = coalesce(p_profile, (select auth.uid())))
      or public.previous_lesson(p_lesson) is null
      or exists (select 1 from public.lesson_progress lp
                  where lp.lesson_id = public.previous_lesson(p_lesson)
                    and lp.profile_id = coalesce(p_profile, (select auth.uid()))
                    and lp.status = 'completed');
$$;

revoke execute on function public.lesson_unlocked(uuid, uuid) from public, anon;
grant execute on function public.lesson_unlocked(uuid, uuid) to authenticated;

-- Every lesson of a course, with whether it is open for this member.
create or replace function public.course_lesson_locks(p_course uuid)
returns table (lesson_id uuid, unlocked boolean, previous_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, public.lesson_unlocked(l.id), public.previous_lesson(l.id)
    from public.lessons l join public.modules m on m.id = l.module_id
   where m.course_id = p_course and l.status = 'published';
$$;

revoke execute on function public.course_lesson_locks(uuid) from public, anon;
grant execute on function public.course_lesson_locks(uuid) to authenticated;

-- A locked lesson is not completed by a member, however it is written.
create or replace function public.enforce_lesson_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and not public.lesson_unlocked(new.lesson_id, new.profile_id) then
    raise exception 'أكمل الدرس السابق أولاً — الدروس تُفتح بالترتيب';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_lesson_order() from public, anon, authenticated;

-- named to run after lesson_progress_open_lesson (triggers fire in name order):
-- a lesson that is not open says so before anything about order.
create trigger lesson_progress_sequence
  before insert or update of status on public.lesson_progress
  for each row execute function public.enforce_lesson_order();
