-- =============================================================================
-- 0036 — Nothing empty gets published
--
-- 0033 drew the line between announced and written and leaned on one fact: a
-- planned path has no lessons, so it cannot be started. That fact has to hold
-- when an author starts filling the outline in. The moment somebody can flip a
-- status in an admin screen, the academy can acquire a published course with
-- nothing in it — and every promise the discovery page makes ("what is open
-- you can open") stops being true.
--
-- So publishing is a transition with conditions, enforced where the status
-- actually changes rather than in the page that asks for it:
--
--   * a course cannot be published with no lessons;
--   * a path cannot be published with no courses, or while a course it
--     requires is still an outline.
--
-- The guards run on UPDATE only. Publishing in the product is always a move
-- from draft or planned to published, one row at a time. seed.sql is the other
-- case: it loads a finished catalogue in one transaction and inserts each
-- course already published, before the lessons it will carry exist. Guarding
-- that INSERT would mean ordering the seed around the guard, which buys
-- nothing — an INSERT of a published-but-empty course is admin-only, and an
-- admin who wants an empty catalogue has simpler ways to get one.
-- =============================================================================

create or replace function public.guard_course_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1 from public.modules m
        join public.lessons l on l.module_id = m.id
       where m.course_id = new.id
    ) then
      raise exception 'لا يمكن نشر دورة بلا دروس: اكتب دروسها أولاً';
    end if;
  end if;
  return new;
end;
$$;

create trigger courses_guard_publish before update of status on public.courses
  for each row execute function public.guard_course_publish();

create or replace function public.guard_path_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unwritten text;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (select 1 from public.path_courses pc where pc.path_id = new.id) then
      raise exception 'لا يمكن نشر مسار بلا دورات';
    end if;

    select string_agg(c.title_ar, '، ')
      into v_unwritten
      from public.path_courses pc
      join public.courses c on c.id = pc.course_id
     where pc.path_id = new.id and pc.is_required and c.status <> 'published';

    if v_unwritten is not null then
      raise exception 'لا يمكن نشر المسار قبل نشر دوراته الأساسية: %', v_unwritten;
    end if;
  end if;
  return new;
end;
$$;

create trigger learning_paths_guard_publish before update of status on public.learning_paths
  for each row execute function public.guard_path_publish();

-- A published course whose level was never computed would sit at the default,
-- so publishing recomputes the ladder. It is one small UPDATE over a table of
-- courses, and it runs only when a status actually changes.
create or replace function public.relevel_after_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.backfill_course_levels();
  return null;
end;
$$;

create trigger courses_relevel after update of status on public.courses
  for each statement execute function public.relevel_after_publish();

create trigger learning_paths_relevel after update of status on public.learning_paths
  for each statement execute function public.relevel_after_publish();
