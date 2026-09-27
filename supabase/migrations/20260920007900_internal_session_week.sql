-- ===========================================================================
-- The team meeting limit counts the week being booked
-- ===========================================================================
-- 0044 limited a team to two internal meetings a week, but counted the meetings
-- of the CURRENT week whatever week the new one was booked into. A team could
-- therefore book any number of meetings next week, and on a Sunday the test of
-- the limit itself passed straight through it. The count now uses the week
-- of the meeting being booked, and a meeting cannot be booked in the past.
-- ===========================================================================

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
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.is_team_member(p_team) then
    raise exception 'أعضاء الفريق فقط من يحجزون اجتماعاته';
  end if;

  if p_end <= p_start then
    raise exception 'وقت النهاية يجب أن يكون بعد البداية';
  end if;

  if p_start < now() then
    raise exception 'لا يُحجز اجتماع في وقت مضى';
  end if;

  -- Two a week, for the team, counted in the week the meeting falls in.
  select count(*) into v_used
    from public.video_sessions s
   where s.team_id = p_team
     and s.session_type = 'team_internal'
     and s.status <> 'cancelled'
     and s.start_at >= date_trunc('week', p_start)
     and s.start_at <  date_trunc('week', p_start) + interval '7 days';

  if v_used >= 2 then
    raise exception 'بلغ فريقك حدّ اجتماعين داخليين في الأسبوع';
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
     and (p_members is null or tm.profile_id = any (p_members))
  on conflict do nothing;

  return v_session;
end;
$$;

grant execute on function public.schedule_internal_session(uuid, timestamptz, timestamptz, uuid[]) to authenticated;
