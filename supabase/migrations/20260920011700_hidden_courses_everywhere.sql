-- =============================================================================
-- 0117 — Hidden courses stay hidden everywhere a link is made
--
-- Found by crawling every link as each role before launch: a course the admin
-- switched to draft (hidden) still showed up, with a link that ends in «not
-- found», in
--   * the home page's «continue learning» card and the academy's resume
--     button (continue_learning), when your last lesson was in that course;
--   * the home page's «today» list (student_agenda);
-- opportunity_learning counted skills from unpublished lessons.
--
-- (academy_roadmap keeps listing draft course titles on purpose: a «coming
-- soon» path is outlined with draft courses, shown as titles, never links.)
--
-- Each now reads only published courses (and, where a path is involved, a
-- path that is not hidden or switched off). The agenda's «your work» entries
-- now open the work itself (/submissions/<id>, which leads to its lesson)
-- instead of the academy's front page.
--
-- Bodies are unchanged apart from those conditions; grants carry over.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.continue_learning()
 RETURNS TABLE(path_id uuid, path_slug text, path_title text, course_id uuid, course_slug text, course_title text, lesson_id uuid, lesson_title text, path_percent integer, course_percent integer, last_activity timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select (select auth.uid()) as id),
  -- the lesson touched most recently, and the course and path it belongs to
  recent as (
    select lp.lesson_id, lp.updated_at, l.title_ar as lesson_title, l.sort_order,
           c.id as course_id, c.slug as course_slug, c.title_ar as course_title
      from public.lesson_progress lp
      join public.lessons l  on l.id = lp.lesson_id and l.status in ('published', 'planned')
      join public.modules m  on m.id = l.module_id
      join public.courses c  on c.id = m.course_id and c.status = 'published'
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
      join public.learning_paths lp2 on lp2.id = pc.path_id and lp2.status not in ('draft', 'archived')
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
$function$;

CREATE OR REPLACE FUNCTION public.student_agenda(p_horizon_days integer DEFAULT 14)
 RETURNS TABLE(entry_kind text, entry_id uuid, title_ar text, detail_ar text, bucket agenda_column, due_on date, link text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    join public.learning_paths path on path.id = e.path_id and path.status not in ('draft', 'archived')
    join public.path_courses pc on pc.path_id = path.id
    join public.courses c on c.id = pc.course_id and c.status = 'published'
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
         '/submissions/' || s.id
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
    join public.learning_paths path on path.id = e.path_id and path.status not in ('draft', 'archived')
    join public.path_courses pc on pc.path_id = path.id
    join public.courses c on c.id = pc.course_id and c.status = 'published'
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
$function$;

CREATE OR REPLACE FUNCTION public.opportunity_learning(p_opportunity uuid)
 RETURNS TABLE(path_id uuid, slug text, title_ar text, teaches text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with wanted as (
    select unnest(o.required_skills) as skill_name
      from public.opportunities o where o.id = p_opportunity
  ),
  mine as (
    select s.name_en, s.name_ar
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
     where ps.profile_id = (select auth.uid())
  ),
  missing as (
    select w.skill_name from wanted w
     where not exists (select 1 from mine m where m.name_en = w.skill_name or m.name_ar = w.skill_name)
  )
  select lp.id, lp.slug, lp.title_ar,
         array_agg(distinct sk.name_ar)
    from public.learning_paths lp
    join public.path_courses pc on pc.path_id = lp.id
    join public.courses c on c.id = pc.course_id and c.status = 'published'
    join public.modules m on m.course_id = c.id
    join public.lessons l on l.module_id = m.id and l.status = 'published'
    join public.lesson_skills ls on ls.lesson_id = l.id
    join public.skills sk on sk.id = ls.skill_id
   where lp.status = 'published'
     and (sk.name_en in (select skill_name from missing)
          or sk.name_ar in (select skill_name from missing))
   group by lp.id, lp.slug, lp.title_ar
   order by count(distinct sk.id) desc
   limit 4;
$function$;
