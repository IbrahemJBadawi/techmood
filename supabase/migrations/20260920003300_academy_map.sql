-- =============================================================================
-- 0033 — The academy's map: eight schools, fifty paths
--
-- The catalogue so far was the prototype's: six paths across schools that were
-- named before the academy document existed. The document names eight schools
-- and fifty paths, and the six live paths are six of those fifty — not a
-- separate catalogue beside them.
--
-- Three changes, no new parallel structure:
--
-- 1. The schools become the document's eight. Six of them are the existing
--    rows renamed, so every path, conversation and certificate that points at
--    a school keeps pointing at it. Two are new. Two that the document folds
--    into others are merged away after their paths are moved.
--
-- 2. content_status gains 'planned'. A path the academy has committed to but
--    has not written yet is not a draft (a draft is private, unfinished work)
--    and it is certainly not published. It is announced. Saying so in the
--    status is what lets the academy show its whole map without inventing a
--    single lesson: a planned path has no lessons, so it cannot be started,
--    and academy_paths() — which filters on 'published' — never sees it.
--
-- 3. Depth and Breadth need no column. The document's deep courses are the
--    ones a path requires; its exposure courses are the ones it carries
--    without gating completion. That is exactly what path_courses.is_required
--    has always meant, so the philosophy is stored, not restated.
-- =============================================================================

alter type public.content_status add value if not exists 'planned' after 'draft';

-- ---------------------------------------------------------------------------
-- The eight schools
-- ---------------------------------------------------------------------------
-- Renames, by id, so nothing that references a school has to move.
update public.schools set slug = 'software-engineering', name_ar = 'هندسة البرمجيات',
       name_en = 'Software Engineering', sort_order = 1 where slug = 'software';
update public.schools set slug = 'ai-data', name_ar = 'الذكاء الاصطناعي والبيانات',
       name_en = 'AI & Data', sort_order = 2 where slug = 'ai-data';
update public.schools set slug = 'cyber-infrastructure', name_ar = 'الأمن السيبراني والبنية التحتية',
       name_en = 'Cybersecurity & Infrastructure', sort_order = 3 where slug = 'cloud-security';
update public.schools set slug = 'design-creative', name_ar = 'التصميم والإبداع',
       name_en = 'Design & Creative', sort_order = 4 where slug = 'product-design';
update public.schools set slug = 'business-management', name_ar = 'الأعمال والإدارة',
       name_en = 'Business & Management', sort_order = 5 where slug = 'entrepreneurship';
update public.schools set slug = 'career-human', name_ar = 'المهارات المهنية والإنسانية',
       name_en = 'Career & Human Skills', sort_order = 6 where slug = 'leadership';

insert into public.schools (slug, name_ar, name_en, sort_order) values
  ('digital-admin', 'المهارات الرقمية والإدارية', 'Digital & Administrative Skills', 7),
  ('foundations',   'الأسس الأكاديمية والمهنية',  'Academic & Professional Foundations', 8)
on conflict (slug) do nothing;

-- Project management is a path inside Business & Management in the document,
-- not a school; technical languages are part of Career & Human Skills. Move
-- anything that points at them before they go, so nothing is orphaned.
update public.learning_paths lp
   set school_id = (select id from public.schools where slug = 'business-management')
 where lp.school_id = (select id from public.schools where slug = 'project-mgmt');

update public.learning_paths lp
   set school_id = (select id from public.schools where slug = 'career-human')
 where lp.school_id = (select id from public.schools where slug = 'tech-languages');

delete from public.schools where slug in ('project-mgmt', 'tech-languages');

-- ---------------------------------------------------------------------------
-- The map a learner can read
-- ---------------------------------------------------------------------------
-- A planned path has no progress to report, so this is not academy_paths()
-- with a different filter: it returns the outline instead — what the path will
-- teach in depth, and what it will cover by exposure. The catalogue is
-- readable by everyone (0011), so the function reads as its caller.
create or replace function public.academy_roadmap()
returns table (
  id                 uuid,
  slug               text,
  title_ar           text,
  title_en           text,
  description_ar     text,
  tags               text[],
  sort_order         integer,
  school_slug        text,
  school_name_ar     text,
  school_name_en     text,
  deep_titles_ar     text[],
  deep_titles_en     text[],
  exposure_titles_ar text[],
  exposure_titles_en text[]
)
language sql
stable
set search_path = ''
as $$
  select p.id,
         p.slug,
         p.title_ar,
         p.title_en,
         p.description_ar,
         p.tags,
         p.sort_order,
         s.slug,
         s.name_ar,
         s.name_en,
         coalesce((select array_agg(c.title_ar order by pc.sort_order)
                     from public.path_courses pc
                     join public.courses c on c.id = pc.course_id
                    where pc.path_id = p.id and pc.is_required), '{}'),
         coalesce((select array_agg(coalesce(c.title_en, c.title_ar) order by pc.sort_order)
                     from public.path_courses pc
                     join public.courses c on c.id = pc.course_id
                    where pc.path_id = p.id and pc.is_required), '{}'),
         coalesce((select array_agg(c.title_ar order by pc.sort_order)
                     from public.path_courses pc
                     join public.courses c on c.id = pc.course_id
                    where pc.path_id = p.id and not pc.is_required), '{}'),
         coalesce((select array_agg(coalesce(c.title_en, c.title_ar) order by pc.sort_order)
                     from public.path_courses pc
                     join public.courses c on c.id = pc.course_id
                    where pc.path_id = p.id and not pc.is_required), '{}')
    from public.learning_paths p
    left join public.schools s on s.id = p.school_id
   where p.status = 'planned'
   order by p.sort_order;
$$;

comment on function public.academy_roadmap is
  'The paths the academy has announced but not written yet, with the outline each one will cover: required courses are its depth, the rest its breadth.';

grant execute on function public.academy_roadmap() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Levels are read off the live curriculum only
-- ---------------------------------------------------------------------------
-- 0032 read a course's level from its earliest position in any path. With a
-- planned path now able to carry a published course — React is the third
-- course of the web path and the third of Full-Stack, but a shared course can
-- sit anywhere — an outline that has not been written yet could quietly
-- demote a course a learner is already taking. A level describes where a
-- course sits in what is actually being taught, so only published paths count.
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
          join public.learning_paths p on p.id = pc.path_id
         where p.status = 'published'
         group by pc.course_id
      ) pos
     where pos.course_id = c.id
    returning 1
  )
  select count(*)::int from updated;
$$;

revoke execute on function public.backfill_course_levels() from public, anon, authenticated;
