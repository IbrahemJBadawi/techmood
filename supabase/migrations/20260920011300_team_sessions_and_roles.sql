-- =============================================================================
-- 0113 — A team's free sessions are the leader's to book, and every role in a
--        team can do exactly what it is meant to
--
-- The founder's rule: from the team page, the leader books up to two free
-- sessions a week for the team's own members, with at least three days
-- between one session and the next. 0044/0079 had the room and a two-a-week
-- count, but any member could book, and nothing kept two sessions apart.
--
-- The days are counted in Palestine's calendar (Asia/Jerusalem), the clock the
-- team lives by: a session on Sunday evening and one on Wednesday morning are
-- three days apart even though fewer than 72 hours separate them.
--
-- Checking every role on the way turned up four rules that were only in the
-- interface, or nowhere:
--
--   * A leader could write any person into team_members directly — adding
--     somebody to a team without an invitation or their consent — and could
--     change anyone's role, including making a second leader. A member now
--     arrives only through an invitation or an accepted request (both
--     functions), the leader writes only their own row when founding the
--     team, and a role changes only through the leadership handover.
--   * The leader could delete their own membership (the "leave" policy), which
--     left a team whose leader was not a member. The leader hands the team
--     over first.
--   * "Members may create tasks" and "members may assign tasks" were settings
--     nobody enforced: every member could do both. They are now enforced, a
--     member may always take a task for themselves, a task is only ever
--     assigned to someone in the team, and a task is deleted by its author or
--     the leader.
--   * The handover accepted a team's mentor as the new leader; it takes a
--     member.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Free team sessions: the leader books, two a week, three days apart
-- ---------------------------------------------------------------------------
create or replace function public.schedule_internal_session(
  p_team    uuid,
  p_start   timestamptz,
  p_end     timestamptz,
  p_members uuid[] default null
)
returns public.video_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_session public.video_sessions;
  v_used    integer;
  v_day     date := (p_start at time zone 'Asia/Jerusalem')::date;
  v_near    timestamptz;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.is_team_leader(p_team) then
    raise exception 'قائد الفريق فقط من يحجز جلسات الفريق';
  end if;

  if p_end <= p_start then
    raise exception 'وقت النهاية يجب أن يكون بعد البداية';
  end if;

  if p_end - p_start > interval '3 hours' then
    raise exception 'جلسة الفريق ثلاث ساعات على الأكثر';
  end if;

  if p_start < now() then
    raise exception 'لا يُحجز اجتماع في وقت مضى';
  end if;

  -- Two a week, counted in the week the session falls in.
  select count(*) into v_used
    from public.video_sessions s
   where s.team_id = p_team
     and s.session_type = 'team_internal'
     and s.status <> 'cancelled'
     and s.start_at >= date_trunc('week', p_start)
     and s.start_at <  date_trunc('week', p_start) + interval '7 days';

  if v_used >= 2 then
    raise exception 'بلغ فريقك حدّ جلستين في الأسبوع';
  end if;

  -- Three days between one session and the next, on either side.
  select s.start_at into v_near
    from public.video_sessions s
   where s.team_id = p_team
     and s.session_type = 'team_internal'
     and s.status <> 'cancelled'
     and abs((s.start_at at time zone 'Asia/Jerusalem')::date - v_day) < 3
   limit 1;

  if v_near is not null then
    raise exception 'بين جلسة وأخرى ثلاثة أيام على الأقل — لدى الفريق جلسة يوم %',
      to_char(v_near at time zone 'Asia/Jerusalem', 'YYYY-MM-DD');
  end if;

  -- Named members must be members; nobody from outside is ever seated.
  if p_members is not null and exists (
    select 1 from unnest(p_members) m(id)
     where not exists (select 1 from public.team_members tm
                        where tm.team_id = p_team and tm.profile_id = m.id and tm.is_active)
  ) then
    raise exception 'الجلسة لأعضاء الفريق فقط';
  end if;

  insert into public.video_sessions (team_id, session_type, start_at, end_at)
  values (p_team, 'team_internal', p_start, p_end)
  returning * into v_session;

  insert into public.video_session_participants (session_id, profile_id, role)
  select v_session.id, tm.profile_id,
         case when tm.role = 'leader' then 'leader' else 'member' end::public.session_role
    from public.team_members tm
   where tm.team_id = p_team
     and tm.is_active
     and tm.role <> 'mentor'
     and (p_members is null or tm.profile_id = any (p_members) or tm.profile_id = v_me)
  on conflict do nothing;

  return v_session;
end;
$$;

grant execute on function public.schedule_internal_session(uuid, timestamptz, timestamptz, uuid[]) to authenticated;

-- What the team page shows the leader: this week's and next week's sessions,
-- and how many are left in each.
create or replace function public.team_session_allowance(p_team uuid)
returns table (week_start date, used integer, remaining integer, sessions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week_start::date,
         count(s.id)::integer,
         greatest(0, 2 - count(s.id))::integer,
         coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at, 'status', s.status)
                            order by s.start_at) filter (where s.id is not null), '[]'::jsonb)
    from (select date_trunc('week', now()) + (n * interval '7 days') as week_start
            from generate_series(0, 1) n) w
    left join public.video_sessions s
      on s.team_id = p_team
     and s.session_type = 'team_internal'
     and s.status <> 'cancelled'
     and s.start_at >= w.week_start
     and s.start_at <  w.week_start + interval '7 days'
   where public.is_team_member(p_team) or public.is_admin()
   group by w.week_start
   order by w.week_start;
$$;

revoke execute on function public.team_session_allowance(uuid) from public, anon;
grant execute on function public.team_session_allowance(uuid) to authenticated;

-- The leader may call off a session that has not started; it frees its place.
create or replace function public.cancel_internal_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.video_sessions;
begin
  select * into v_session from public.video_sessions where id = p_session;
  if not found or v_session.session_type <> 'team_internal' then
    raise exception 'الجلسة غير موجودة';
  end if;
  if not (public.is_team_leader(v_session.team_id) or public.is_admin()) then
    raise exception 'قائد الفريق فقط من يلغي جلسات الفريق';
  end if;
  if v_session.status <> 'scheduled' or v_session.start_at <= now() then
    raise exception 'لا تُلغى جلسة بدأت أو انتهت';
  end if;
  update public.video_sessions set status = 'cancelled' where id = p_session;
end;
$$;

revoke execute on function public.cancel_internal_session(uuid) from public, anon;
grant execute on function public.cancel_internal_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Membership is written by invitation, request or handover — not by hand
-- ---------------------------------------------------------------------------
drop policy if exists team_members_leader_write on public.team_members;

-- Founding a team: its leader writes their own row, once.
create policy team_members_founder_insert on public.team_members
  for insert to authenticated
  with check ((profile_id = (select auth.uid()) and role = 'leader' and public.is_team_leader(team_id))
              or public.is_admin());

create policy team_members_leader_update on public.team_members
  for update to authenticated
  using (public.is_team_leader(team_id) or public.is_admin())
  with check (public.is_team_leader(team_id) or public.is_admin());

create policy team_members_leader_remove on public.team_members
  for delete to authenticated
  using (public.is_team_leader(team_id) or public.is_admin());

create or replace function public.guard_team_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader uuid;
begin
  -- The platform itself (jobs, migrations, the service role) is not a person
  -- acting on a team.
  if (select auth.uid()) is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if new.team_id <> old.team_id or new.profile_id <> old.profile_id then
      raise exception 'لا يُنقل عضو من فريق إلى آخر';
    end if;
    if new.role <> old.role and coalesce(current_setting('techmood.leadership_handover', true), '') <> 'on' then
      raise exception 'الأدوار تتغيّر بتسليم القيادة فقط';
    end if;
    return new;
  end if;

  -- DELETE: the leader leaves by handing the team over first.
  select leader_id into v_leader from public.teams where id = old.team_id;
  if v_leader is not null and old.profile_id = v_leader then
    raise exception 'سلّم قيادة الفريق لعضو آخر قبل المغادرة';
  end if;
  return old;
end;
$$;

drop trigger if exists team_members_guard on public.team_members;
create trigger team_members_guard
  before update or delete on public.team_members
  for each row execute function public.guard_team_member_change();

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
    where team_id = p_team and profile_id = p_to and role = 'member' and is_active
  ) then
    raise exception 'the new leader must already be a member of the team';
  end if;

  perform set_config('techmood.leadership_handover', 'on', true);

  update public.team_members set role = 'member'
   where team_id = p_team and role = 'leader';

  update public.team_members set role = 'leader'
   where team_id = p_team and profile_id = p_to;

  update public.teams set leader_id = p_to where id = p_team;

  perform set_config('techmood.leadership_handover', 'off', true);

  insert into public.team_activity (team_id, actor_id, verb, subject_ar)
  values (p_team, (select auth.uid()), 'leadership_transferred', null);
end;
$$;

grant execute on function public.transfer_team_leadership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tasks follow the team's own settings
-- ---------------------------------------------------------------------------
create or replace function public.guard_team_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if not (public.is_team_leader(old.team_id) or old.created_by = v_me) then
      raise exception 'يحذف المهمة كاتبها أو قائد الفريق';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' and not public.team_permission(new.team_id, 'members_create_tasks') then
    raise exception 'إنشاء المهام في هذا الفريق للقائد فقط';
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    if not exists (select 1 from public.team_members tm
                    where tm.team_id = new.team_id and tm.profile_id = new.assignee_id and tm.is_active) then
      raise exception 'تُسند المهمة لعضو في الفريق فقط';
    end if;
    if new.assignee_id <> v_me and not public.team_permission(new.team_id, 'members_assign_tasks') then
      raise exception 'إسناد المهام لغيرك في هذا الفريق للقائد فقط — يمكنك أخذ المهمة لنفسك';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists team_tasks_guard on public.team_tasks;
create trigger team_tasks_guard
  before insert or update or delete on public.team_tasks
  for each row execute function public.guard_team_task();

revoke execute on function public.guard_team_member_change() from public, anon, authenticated;
revoke execute on function public.guard_team_task() from public, anon, authenticated;
