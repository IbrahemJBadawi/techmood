-- =============================================================================
-- TechMood — 0145 How far each achievement is
--
-- The founder chose «كل وسام مع تقدّمه» for achievements: each one shows how
-- far along it is — 6 of 10 lessons, 4 of 7 days — not only earned or not.
-- The counts are read from the same facts that award them (0128), so a bar
-- can never say full while the achievement is still missing, or the reverse.
-- One-off achievements are simply 0 or 1 of 1.
-- =============================================================================

create or replace function public.my_achievement_progress()
returns table (slug text, current integer, goal integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_lessons integer;
  v_streak  integer;
  v_done    integer;
  v_all     integer;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_lessons from public.lesson_progress
   where profile_id = v_me and status = 'completed';
  v_streak := public.streak_of(v_me);
  select count(*) filter (where c.progress >= c.goal), count(*) into v_done, v_all
    from public.challenges_of(v_me) c;

  return query
  select a.slug,
         case a.slug
           when 'first_lesson'  then least(v_lessons, 1)
           when 'lessons_10'    then least(v_lessons, 10)
           when 'lessons_50'    then least(v_lessons, 50)
           when 'streak_7'      then least(v_streak, 7)
           when 'streak_30'     then least(v_streak, 30)
           when 'week_champion' then v_done
           else case when pa.profile_id is null then 0 else 1 end
         end::integer,
         case a.slug
           when 'lessons_10'    then 10
           when 'lessons_50'    then 50
           when 'streak_7'      then 7
           when 'streak_30'     then 30
           when 'week_champion' then greatest(v_all, 1)
           else 1
         end::integer
    from public.achievements a
    left join public.profile_achievements pa on pa.achievement_id = a.id and pa.profile_id = v_me;
end;
$$;
revoke execute on function public.my_achievement_progress() from public, anon;
grant execute on function public.my_achievement_progress() to authenticated;

comment on function public.my_achievement_progress() is
  'For the signed-in member: how far each achievement is, from the same facts that award it (0145).';
