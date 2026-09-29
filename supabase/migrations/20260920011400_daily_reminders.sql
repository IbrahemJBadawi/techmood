-- =============================================================================
-- 0114 — Daily reminders: the day ahead in the morning, the streak at night
--
-- The founder asked for daily reminders on the device — for the streak
-- (الحماسة), for what is happening (الأحداث) and for the league (الدوري).
-- 0100 sent one nudge an evening, and only about the path. Now, for everyone
-- who has turned notifications on for a device:
--
--   * Morning (09:00 in Palestine): the day ahead — the sessions they are
--     seated in, the bookings they have, the team tasks due — and where they
--     stand in this week's league of students, by points.
--   * Evening (19:00): if nothing was finished today, the streak they are
--     about to lose (or, with no streak yet, one small step in their path).
--
-- Each is at most one notification a day, and both belong to a category of
-- their own, «التذكيرات اليومية», so a person can keep every other kind of
-- notification and silence these — or the other way round.
--
-- The league here is the league on the home page (0110): students only,
-- points earned since the start of the week.
-- =============================================================================

alter type public.notification_kind add value if not exists 'reminder';

insert into public.notification_categories
  (kind, title_ar, detail_ar, in_app_default, email_default, push_default, is_mandatory, sort_order)
values ('reminder', 'التذكيرات اليومية',
        'صباحاً: جلسات يومك ومهامك وترتيبك في دوري الأسبوع. مساءً: حماستك إن لم تُنجز شيئاً اليوم.',
        true, false, true, false, 13)
on conflict (kind) do nothing;

-- A student's place in this week's league, by points (the home page's rule).
create or replace function public.week_league_rank(p_profile uuid)
returns table (rank integer, points integer, students integer, gap_to_next integer)
language sql
stable
security definer
set search_path = ''
as $$
  with pts as (
    select pr.profile_id,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = pr.profile_id
                        and x.created_at >= date_trunc('week', now())), 0)::integer as p
      from public.profile_roles pr
     where pr.role = 'student' and pr.status = 'approved'
  ),
  ranked as (
    select profile_id, p, (rank() over (order by p desc))::integer as rk from pts
  )
  select r.rk, r.p, (select count(*)::integer from pts),
         (select min(o.p) - r.p from ranked o where o.p > r.p)::integer
    from ranked r
   where r.profile_id = p_profile;
$$;

revoke execute on function public.week_league_rank(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Morning: the day ahead, and the week's league
-- ---------------------------------------------------------------------------
create or replace function public.morning_digest()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today    date := (now() at time zone 'Asia/Jerusalem')::date;
  v_count    integer := 0;
  v_lines    text[];
  v_first    timestamptz;
  v_sessions integer;
  v_tasks    integer;
  v_rank     record;
  r          record;
begin
  for r in
    select p.id
      from public.profiles p
     where exists (select 1 from public.push_subscriptions s where s.profile_id = p.id)
       and not exists (select 1 from public.notifications n
                        where n.profile_id = p.id and n.metadata ->> 'reminder' = 'morning'
                          and n.created_at > now() - interval '20 hours')
  loop
    v_lines := '{}';

    -- Sessions today: rooms they are seated in, and confirmed bookings.
    select count(*), min(t.start_at) into v_sessions, v_first
      from (
        select s.start_at
          from public.video_sessions s
          join public.video_session_participants vp on vp.session_id = s.id and vp.profile_id = r.id
         where s.status = 'scheduled'
           and (s.start_at at time zone 'Asia/Jerusalem')::date = v_today
        union
        select b.scheduled_start
          from public.bookings b
         where (b.student_id = r.id or b.mentor_id = r.id)
           and b.status = 'confirmed'
           and (b.scheduled_start at time zone 'Asia/Jerusalem')::date = v_today
      ) t;

    if v_sessions > 0 then
      v_lines := v_lines || ('📅 ' || case when v_sessions = 1 then 'جلسة اليوم' else v_sessions || ' جلسات اليوم' end
                             || '، الأولى ' || to_char(v_first at time zone 'Asia/Jerusalem', 'HH24:MI'));
    end if;

    select count(*) into v_tasks
      from public.team_tasks t
     where t.assignee_id = r.id and t.column_key <> 'done' and t.due_on = v_today;
    if v_tasks > 0 then
      v_lines := v_lines || ('✅ ' || case when v_tasks = 1 then 'مهمة مستحقة اليوم' else v_tasks || ' مهام مستحقة اليوم' end);
    end if;

    select * into v_rank from public.week_league_rank(r.id);
    if found then
      if v_rank.points > 0 then
        v_lines := v_lines || ('🏆 ترتيبك في دوري الأسبوع: ' || v_rank.rank || ' من ' || v_rank.students
                               || ' (' || v_rank.points || ' نقطة)'
                               || case when v_rank.gap_to_next is not null
                                       then '، وتفصلك ' || v_rank.gap_to_next || ' نقطة عن المرتبة التالية' else '' end);
      else
        v_lines := v_lines || '🏆 دوري الأسبوع مفتوح — درس واحد اليوم يُدخلك الترتيب'::text;
      end if;
    end if;

    continue when cardinality(v_lines) = 0;

    perform public.notify(r.id, 'reminder', 'يومك في TechMood',
      array_to_string(v_lines, E'\n'),
      case when v_sessions > 0 then '/bookings' else '/home' end,
      null, null, 'normal', '{"reminder":"morning"}'::jsonb);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.morning_digest() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evening: keep the streak (0100's daily nudge, grown up)
-- ---------------------------------------------------------------------------
create or replace function public.daily_learning_reminder()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone 'Asia/Jerusalem')::date;
  v_count  integer := 0;
  v_streak integer;
  v_path   record;
  r        record;
begin
  for r in
    select p.id
      from public.profiles p
      join public.profile_roles pr on pr.profile_id = p.id and pr.role = 'student' and pr.status = 'approved'
     where exists (select 1 from public.push_subscriptions s where s.profile_id = p.id)
       and not exists (select 1 from public.notifications n
                        where n.profile_id = p.id and n.metadata ->> 'reminder' in ('daily', 'evening')
                          and n.created_at > now() - interval '20 hours')
       -- something finished today means there is nothing to remind
       and not exists (select 1 from public.activity_dates_of(p.id, v_today) d where d = v_today)
  loop
    v_streak := public.streak_of(r.id);

    if v_streak > 0 then
      perform public.notify(r.id, 'reminder',
        '🔥 حماستك ' || v_streak || ' ' || case when v_streak = 1 then 'يوم' when v_streak <= 10 then 'أيام' else 'يوماً' end,
        'لم تُنجز شيئاً اليوم بعد — درس واحد أو تكليف صغير يحافظ عليها.',
        '/home', null, null, 'normal', '{"reminder":"evening"}'::jsonb);
      v_count := v_count + 1;
      continue;
    end if;

    select lp.title_ar, lp.slug into v_path
      from public.enrollments e join public.learning_paths lp on lp.id = e.path_id
     where e.profile_id = r.id and e.completed_at is null
     order by e.enrolled_at desc limit 1;

    if found then
      perform public.notify(r.id, 'reminder', 'خطوة صغيرة اليوم؟',
        'درس واحد في «' || v_path.title_ar || '» يبدأ حماستك من جديد.',
        '/academy/' || v_path.slug, null, null, 'normal', '{"reminder":"evening"}'::jsonb);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.daily_learning_reminder() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-morning-digest', '0 6 * * *', $$select public.morning_digest()$$);
    -- 0100's evening job keeps its name and its hour (19:00 in Palestine).
    perform cron.schedule('techmood-daily-reminder', '0 16 * * *', $$select public.daily_learning_reminder()$$);
  end if;
end
$migration$;
