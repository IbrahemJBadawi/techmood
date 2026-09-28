-- =============================================================================
-- 0110 — The students' league
--
-- The home page's league is between students only — mentors, teams and
-- organisations are not ranked against learners. It is read three ways, each
-- kept separate as everywhere else on TechMood (points are quantity, stars
-- are quality, and neither buys the other):
--
--   * points  — XP earned in the window;
--   * streak  — days in a row, up to today, on which something was finished
--               (the same rule as the student's own streak: logging in is not
--               work, and an empty today does not break it yet);
--   * rating  — the average of the stars mentors gave approved work in the
--               window, for students with at least one rated piece.
--
-- The window is today, this week, this month, this year or all time (the
-- streak is always "up to today"). The scope is everybody, or the students
-- enrolled in one path. Only public profiles are listed; the person asking
-- always sees their own row, with their rank, even outside the top.
-- =============================================================================

-- The days a given member finished something on (the rule of activity_days).
create or replace function public.activity_dates_of(p_profile uuid, p_from date)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select distinct d from (
    select lp.completed_at::date as d from public.lesson_progress lp
     where lp.profile_id = p_profile and lp.completed_at >= p_from
    union all
    select s.created_at::date from public.submissions s
     where s.profile_id = p_profile and s.created_at >= p_from
    union all
    select aa.created_at::date from public.assessment_attempts aa
     where aa.profile_id = p_profile and aa.created_at >= p_from
    union all
    select b.completed_at::date from public.bookings b
     where b.student_id = p_profile and b.completed_at >= p_from
    union all
    select t.completed_at::date from public.team_tasks t
     where t.assignee_id = p_profile and t.completed_at >= p_from
    union all
    select e.enrolled_at::date from public.enrollments e
     where e.profile_id = p_profile and e.enrolled_at >= p_from
  ) acts;
$$;

create or replace function public.streak_of(p_profile uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days date[];
  v_cursor date := current_date;
  v_streak integer := 0;
begin
  select array_agg(d) into v_days from public.activity_dates_of(p_profile, current_date - 400) d;
  if v_days is null then
    return 0;
  end if;
  if not (current_date = any (v_days)) then
    v_cursor := current_date - 1;
  end if;
  while v_cursor = any (v_days) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;
  return v_streak;
end;
$$;

revoke execute on function public.activity_dates_of(uuid, date) from public, anon, authenticated;
revoke execute on function public.streak_of(uuid) from public, anon, authenticated;

create or replace function public.student_league(
  p_metric text default 'points',
  p_window text default 'week',
  p_path   uuid default null,
  p_limit  integer default 10
)
returns table (
  rank integer, profile_id uuid, techmood_id text, name text, avatar_url text,
  score numeric, points integer, stars numeric, rated integer, streak integer, is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_since timestamptz;
begin
  if p_metric not in ('points', 'streak', 'rating') then
    raise exception 'ترتيب غير معروف';
  end if;
  if p_window not in ('today', 'week', 'month', 'year', 'all') then
    raise exception 'فترة غير معروفة';
  end if;

  v_since := case p_window
    when 'today' then date_trunc('day', now())
    when 'week'  then date_trunc('week', now())
    when 'month' then date_trunc('month', now())
    when 'year'  then date_trunc('year', now())
    else null end;

  return query
  with students as (
    select p.id, p.techmood_id, coalesce(p.display_name, p.full_name) as name, p.avatar_url
      from public.profiles p
      join public.profile_roles pr
        on pr.profile_id = p.id and pr.role = 'student' and pr.status = 'approved'
     where (p.is_public or p.id = v_me)
       and (p_path is null or exists (
             select 1 from public.enrollments e where e.profile_id = p.id and e.path_id = p_path))
  ),
  measured as (
    select s.*,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = s.id and (v_since is null or x.created_at >= v_since)), 0)::integer as pts,
           r.avg_stars, coalesce(r.n, 0)::integer as n_rated,
           case when p_metric = 'streak' then public.streak_of(s.id) else 0 end as stk
      from students s
      left join lateral (
        select round(avg(ev.stars)::numeric, 2) as avg_stars, count(*) as n
          from public.evaluations ev
          join public.submissions sb on sb.id = ev.submission_id
         where sb.profile_id = s.id and ev.decision = 'approved' and ev.stars is not null
           and (v_since is null or ev.created_at >= v_since)
      ) r on true
  ),
  scored as (
    select m.*,
           case p_metric
             when 'points' then m.pts::numeric
             when 'streak' then m.stk::numeric
             else coalesce(m.avg_stars, 0) end as sc
      from measured m
     where case p_metric
             when 'points' then m.pts > 0
             when 'streak' then m.stk > 0
             else m.n_rated > 0 end
        or m.id = v_me
  ),
  ranked as (
    select (rank() over (order by sc.sc desc, sc.pts desc, sc.n_rated desc, sc.name))::integer as rk, sc.*
      from scored sc
  )
  select rk.rk, rk.id, rk.techmood_id, rk.name, rk.avatar_url,
         rk.sc, rk.pts, rk.avg_stars, rk.n_rated, rk.stk, rk.id = v_me
    from ranked rk
   where rk.rk <= greatest(p_limit, 1) or rk.id = v_me
   order by rk.rk, rk.name;
end;
$$;

revoke execute on function public.student_league(text, text, uuid, integer) from public, anon;
grant execute on function public.student_league(text, text, uuid, integer) to authenticated;
