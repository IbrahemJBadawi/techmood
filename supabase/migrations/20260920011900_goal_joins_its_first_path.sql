-- =============================================================================
-- 0119 — Choosing a career goal also joins its first path
--
-- The founder's report, second half: a learner «chooses a path» from the
-- career goals page (/academy/goals) — which saves the goal — and the academy
-- and home page keep asking them to choose a path, because a goal was never an
-- enrolment. Now choosing a goal joins the learner to the first open path on
-- the goal's plan (a path step, or the first open path of a course step), so
-- the plan they picked is the path they are on. Changing goal later adds the
-- new goal's path; nothing already joined is taken away.
--
-- Learners who chose a goal before this are joined the same way.
-- =============================================================================

-- The first open path of a goal's plan, in the plan's order.
create or replace function public.goal_first_path(p_goal uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select lp.id
       from public.career_goal_steps s
       join public.learning_paths lp on lp.id = s.path_id
      where s.goal_id = p_goal and s.kind = 'path' and lp.status = 'published'
      order by s.sort_order limit 1),
    (select lp.id
       from public.career_goal_steps s
       join public.path_courses pc on pc.course_id = s.course_id
       join public.learning_paths lp on lp.id = pc.path_id
      where s.goal_id = p_goal and s.kind = 'course' and lp.status = 'published'
      order by s.sort_order, lp.sort_order limit 1)
  );
$$;

revoke execute on function public.goal_first_path(uuid) from public, anon, authenticated;

create or replace function public.choose_career_goal(p_goal text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_goal uuid;
  v_path uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول لاختيار هدف مهني';
  end if;

  select id into v_goal from public.career_goals
   where slug = p_goal and status = 'published';

  if v_goal is null then
    raise exception 'لا يوجد هدف مهني بهذا المعرّف';
  end if;

  insert into public.profile_career_goals (profile_id, goal_id)
  values (v_me, v_goal)
  on conflict (profile_id) do update set goal_id = excluded.goal_id, chosen_at = now();

  -- The goal's first open path becomes a path the learner is on (0119).
  v_path := public.goal_first_path(v_goal);
  if v_path is not null then
    insert into public.enrollments (profile_id, path_id)
    values (v_me, v_path)
    on conflict (profile_id, path_id) where path_id is not null do nothing;
  end if;
end;
$$;

-- Learners who chose a goal before this.
insert into public.enrollments (profile_id, path_id, enrolled_at)
select g.profile_id, public.goal_first_path(g.goal_id), g.chosen_at
  from public.profile_career_goals g
 where public.goal_first_path(g.goal_id) is not null
on conflict (profile_id, path_id) where path_id is not null do nothing;
