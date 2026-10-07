-- ============================================================================
-- 0146 — the sign-up funnel on the admin analytics page (design lab 4)
--
-- Of the people who joined in the last N days, how many went one step
-- further: finished onboarding, joined a path or course, finished a lesson,
-- and then either earned a certificate or held a mentoring session. Each step
-- counts people, not rows, and only people from the same sign-up window, so
-- every step is a share of the one above it.
-- ============================================================================

create or replace function public.admin_signup_funnel(p_days integer default 30)
returns table (step text, people integer)
language sql
stable
security definer
set search_path = ''
as $$
  with joined as (
    select p.id, p.onboarding_completed_at
      from public.profiles p
     where p.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
  )
  select s.step, s.people
    from (
      select 1 as n, 'signed_up' as step, (select count(*)::int from joined) as people
      union all
      select 2, 'onboarded', (select count(*)::int from joined j where j.onboarding_completed_at is not null)
      union all
      select 3, 'enrolled', (select count(*)::int from joined j
                              where exists (select 1 from public.enrollments e where e.profile_id = j.id))
      union all
      select 4, 'first_lesson', (select count(*)::int from joined j
                                  where exists (select 1 from public.lesson_progress lp
                                                 where lp.profile_id = j.id and lp.completed_at is not null))
      union all
      select 5, 'certified_or_session', (select count(*)::int from joined j
                                          where exists (select 1 from public.certificates c where c.profile_id = j.id)
                                             or exists (select 1 from public.bookings b
                                                         where b.student_id = j.id and b.completed_at is not null))
    ) s
   where public.is_admin()
   order by s.n;
$$;

revoke execute on function public.admin_signup_funnel(integer) from public, anon;
grant execute on function public.admin_signup_funnel(integer) to authenticated;
