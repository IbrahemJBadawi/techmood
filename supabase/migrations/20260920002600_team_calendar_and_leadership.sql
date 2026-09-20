-- =============================================================================
-- TechMood — 0026 Team calendar and leadership transfer
--
-- The calendar is derived, like the mentor's slots: a team's dates already
-- exist on its tasks, sprints, milestones and booked sessions. Storing them a
-- second time would only create something to drift.
-- =============================================================================

create or replace function public.team_calendar(
  p_team uuid,
  p_from date,
  p_to   date
)
returns table (
  entry_kind text,
  entry_id   uuid,
  title_ar   text,
  on_date    date,
  detail_ar  text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Only a member sees a team's dates; everything below inherits that check.
  select * from (
    select 'task'::text,
           t.id,
           t.title_ar,
           t.due_on,
           case t.column_key
             when 'done'    then 'مكتملة'
             when 'blocked' then 'متوقفة'
             else 'موعد تسليم'
           end
    from public.team_tasks t
    where t.team_id = p_team and t.due_on between p_from and p_to

    union all
    select 'sprint_start', s.id, 'بداية السبرنت ' || s.number, s.starts_on, s.goal_ar
    from public.sprints s
    where s.team_id = p_team and s.starts_on between p_from and p_to

    union all
    select 'sprint_end', s.id, 'نهاية السبرنت ' || s.number, s.ends_on, s.goal_ar
    from public.sprints s
    where s.team_id = p_team and s.ends_on between p_from and p_to

    union all
    select 'milestone', m.id, m.title_ar, m.due_on, p.title_ar
    from public.project_milestones m
    join public.projects p on p.id = m.project_id
    where p.team_id = p_team and m.due_on between p_from and p_to

    union all
    select 'mentor_session',
           b.id,
           coalesce(b.topic_ar, 'جلسة إرشاد'),
           b.scheduled_start::date,
           to_char(b.scheduled_start, 'HH24:MI')
    from public.bookings b
    where b.team_id = p_team
      and b.status in ('confirmed', 'completed')
      and b.scheduled_start::date between p_from and p_to
  ) as entries(entry_kind, entry_id, title_ar, on_date, detail_ar)
  where public.is_team_member(p_team) or public.is_admin()
  order by on_date, entry_kind;
$$;

-- ---------------------------------------------------------------------------
-- Handing over a team. One transaction, so a team is never left with two
-- leaders or none.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_team_leadership(p_team uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_team_leader(p_team) or public.is_admin()) then
    raise exception 'only the current leader may hand the team over';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = p_team and profile_id = p_to
  ) then
    raise exception 'the new leader must already be a member of the team';
  end if;

  update public.team_members set role = 'member'
   where team_id = p_team and role = 'leader';

  update public.team_members set role = 'leader'
   where team_id = p_team and profile_id = p_to;

  update public.teams set leader_id = p_to where id = p_team;

  insert into public.team_activity (team_id, actor_id, verb, subject_ar)
  values (p_team, (select auth.uid()), 'leadership_transferred', null);
end;
$$;

grant execute on function public.team_calendar(uuid, date, date)        to authenticated;
grant execute on function public.transfer_team_leadership(uuid, uuid)   to authenticated;
