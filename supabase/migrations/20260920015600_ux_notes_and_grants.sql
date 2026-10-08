-- ============================================================================
-- 0156 — a review's notes, and the grants it turned up
--
-- 1. Closing direct writes that only the platform's own functions should make.
--    Supabase grants every table to `authenticated` by default, and row
--    security only says *whose* rows — not *which columns*. So a member could,
--    through the API, change their own permanent TechMood ID, approve their
--    own submission, mark a course enrolment complete, publish their own
--    exhibition entry, accept themselves into an opportunity or a team, or
--    accept their own incubator application. Every one of those already has a
--    function that checks the rules; the app writes through them only. The
--    direct writes go.
-- 2. The front page's numbers, measured (`platform_stats`).
-- 3. What each path gives: its hours, its projects, its skills
--    (`academy_path_facts`).
-- 4. «شو هدفك؟» — the goal asked at onboarding (`profiles.learning_goal`).
-- 5. Asking to join a team from its project page, and the leader's answer.
-- 6. A profile's activity, day by day, like a contribution graph.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Grants
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists learning_goal text
    check (learning_goal is null or learning_goal in
      ('web', 'mobile', 'data', 'ai', 'design', 'security', 'cloud', 'freelance', 'basics', 'marketing'));

revoke update on public.profiles from anon, authenticated;
grant update (full_name, headline, bio, avatar_url, country, city, github_url, linkedin_url, website_url,
              is_public, phone, username, display_name, language, primary_role,
              onboarding_completed_at, welcomed_at, learning_goal)
  on public.profiles to authenticated;

-- A member may still create these rows (several flows do), but only with the
-- columns that are theirs to fill; the status, the reviewer and the dates
-- stay with the functions that decide them, and no row is edited directly.
revoke insert, update on public.submissions              from anon, authenticated;
revoke insert, update on public.enrollments              from anon, authenticated;
revoke insert, update on public.exhibition_entries       from anon, authenticated;
revoke insert, update on public.incubator_applications   from anon, authenticated;
revoke insert, update on public.opportunity_applications from anon, authenticated;
revoke insert, update on public.team_applications        from anon, authenticated;

grant insert (assignment_id, profile_id, team_id) on public.submissions to authenticated;
grant insert (profile_id, path_id, course_id) on public.enrollments to authenticated;
grant insert (project_id, team_id, submitted_by, summary_ar, technologies, demo_url, documentation_ar,
              problem_ar, solution_ar, outcomes_ar, cover_url) on public.exhibition_entries to authenticated;
grant insert (startup_id, pitch_ar) on public.incubator_applications to authenticated;
grant insert (opportunity_id, profile_id, cover_note_ar, proposed_amount_usd, proposed_days, shared_sections)
  on public.opportunity_applications to authenticated;
grant insert (team_id, profile_id, role_wanted, message_ar) on public.team_applications to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The front page's numbers — counted, never typed
-- ---------------------------------------------------------------------------
create or replace function public.platform_stats()
returns table (paths integer, courses integer, lessons integer, members integer, projects integer, mentors integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.learning_paths where status = 'published')::int,
         (select count(*) from public.courses where status = 'published')::int,
         (select count(*) from public.lessons where status = 'published')::int,
         (select count(*) from public.profiles where onboarding_completed_at is not null)::int,
         (select count(*) from public.projects where in_gallery and gallery_hidden_at is null)::int,
         (select count(*) from public.profile_roles where role = 'mentor' and status = 'approved')::int;
$$;

revoke execute on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. What a path gives
-- ---------------------------------------------------------------------------
create or replace function public.academy_path_facts()
returns table (path_id uuid, hours integer, projects integer, skills text[])
language sql
stable
security definer
set search_path = ''
as $$
  select lp.id,
         coalesce(lp.estimated_hours,
                  nullif((select sum(coalesce(c.estimated_hours, 0))
                            from public.path_courses pc
                            join public.courses c on c.id = pc.course_id and c.status = 'published'
                           where pc.path_id = lp.id), 0))::int,
         ((select count(*) from public.path_courses pc
             join public.assignments a on a.course_id = pc.course_id
            where pc.path_id = lp.id and a.kind::text = 'course_project' and a.status::text = 'published')
          + (select count(*) from public.assignments a
              where a.path_id = lp.id and a.kind::text = 'path_project' and a.status::text = 'published'))::int,
         coalesce(lp.tags, '{}')
    from public.learning_paths lp
   where lp.status = 'published';
$$;

revoke execute on function public.academy_path_facts() from public, anon;
grant execute on function public.academy_path_facts() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Asking to join a team
-- ---------------------------------------------------------------------------
create or replace function public.request_to_join_team(p_team uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_team public.teams%rowtype;
  v_app  public.team_applications%rowtype;
  v_id   uuid;
  v_name text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_team from public.teams where id = p_team;
  if not found then
    raise exception 'الفريق غير موجود';
  end if;
  if not v_team.is_open then
    raise exception 'هذا الفريق لا يستقبل طلبات انضمام الآن';
  end if;
  if exists (select 1 from public.team_members m
              where m.team_id = p_team and m.profile_id = v_me and coalesce(m.is_active, true)) then
    raise exception 'أنت عضو في هذا الفريق بالفعل';
  end if;
  if char_length(coalesce(p_message, '')) > 500 then
    raise exception 'الرسالة طويلة — 500 حرف كحد أقصى';
  end if;

  select * into v_app from public.team_applications where team_id = p_team and profile_id = v_me;
  if found and v_app.status = 'pending' then
    raise exception 'طلبك قيد الانتظار — سيصلك ردّ قائد الفريق';
  end if;
  if found and v_app.status = 'declined' and v_app.decided_at > now() - interval '7 days' then
    raise exception 'رُفض طلبك مؤخراً — يمكنك المحاولة بعد أسبوع';
  end if;

  insert into public.team_applications (team_id, profile_id, message_ar)
  values (p_team, v_me, nullif(btrim(p_message), ''))
  on conflict (team_id, profile_id) do update
    set status = 'pending', message_ar = excluded.message_ar, decided_by = null, decided_at = null, created_at = now()
  returning id into v_id;

  select coalesce(display_name, full_name) into v_name from public.profiles where id = v_me;
  perform public.notify(v_team.leader_id, 'team', '🙋 طلب انضمام إلى «' || v_team.title_ar || '»',
    coalesce(v_name, 'عضو') || coalesce(' — ' || nullif(btrim(p_message), ''), ''),
    '/teams/' || p_team::text || '/members', 'team_application', v_id);
  return v_id;
end;
$$;

revoke execute on function public.request_to_join_team(uuid, text) from public, anon;
grant execute on function public.request_to_join_team(uuid, text) to authenticated;

-- The leader's answer: the member joins as an invitation would make them, and is told either way.
create or replace function public.decide_team_application(p_application_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app  public.team_applications%rowtype;
  v_team public.teams%rowtype;
begin
  select * into v_app from public.team_applications where id = p_application_id for update;
  if not found then
    raise exception 'الطلب غير موجود';
  end if;
  if not (public.is_team_leader(v_app.team_id) or public.is_admin()) then
    raise exception 'قائد الفريق فقط يقرّر طلبات الانضمام';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'قُرّر هذا الطلب بالفعل';
  end if;
  select * into v_team from public.teams where id = v_app.team_id;

  update public.team_applications
     set status = case when p_accept then 'accepted' else 'declined' end::public.team_application_status,
         decided_by = (select auth.uid()),
         decided_at = now()
   where id = p_application_id;

  if p_accept then
    insert into public.team_members (team_id, profile_id, role, title_ar, responsibility_ar)
    values (v_app.team_id, v_app.profile_id, 'member', v_app.role_wanted, v_app.role_wanted)
    on conflict (team_id, profile_id) do nothing;
    insert into public.team_activity (team_id, actor_id, verb, subject_ar)
    values (v_app.team_id, v_app.profile_id, 'member_joined', null);
    perform public.notify(v_app.profile_id, 'team', '🎉 قُبلت في فريق «' || v_team.title_ar || '»',
      'أصبحت عضواً — ابدأ من مساحة الفريق.', '/teams/' || v_app.team_id::text, 'team', v_app.team_id);
  else
    perform public.notify(v_app.profile_id, 'team', 'لم يُقبل طلبك للانضمام إلى «' || v_team.title_ar || '»',
      'يمكنك التقدّم لفرق أخرى، أو المحاولة هنا بعد أسبوع.', '/teams', 'team', v_app.team_id);
  end if;
end;
$$;

-- Pending requests, for the leader.
create or replace function public.team_join_requests(p_team uuid)
returns table (id uuid, profile_id uuid, full_name text, techmood_id text, avatar_url text, headline text,
               message_ar text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.profile_id, coalesce(p.display_name, p.full_name), p.techmood_id, p.avatar_url, p.headline,
         a.message_ar, a.created_at
    from public.team_applications a
    join public.profiles p on p.id = a.profile_id
   where a.team_id = p_team and a.status = 'pending'
     and (public.is_team_leader(p_team) or public.is_admin())
   order by a.created_at;
$$;

revoke execute on function public.team_join_requests(uuid) from public, anon;
grant execute on function public.team_join_requests(uuid) to authenticated;

-- Where I stand with the team behind a project, for its page.
create or replace function public.project_team_join_state(p_project uuid)
returns table (team_id uuid, team_title text, is_open boolean, am_member boolean, my_request text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title_ar, t.is_open,
         exists (select 1 from public.team_members m
                  where m.team_id = t.id and m.profile_id = (select auth.uid()) and coalesce(m.is_active, true)),
         (select a.status::text from public.team_applications a
           where a.team_id = t.id and a.profile_id = (select auth.uid()))
    from public.projects pr
    join public.teams t on t.id = pr.team_id
   where pr.id = p_project;
$$;

revoke execute on function public.project_team_join_state(uuid) from public, anon;
grant execute on function public.project_team_join_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. A profile's activity, day by day (the last 26 weeks)
-- ---------------------------------------------------------------------------
create or replace function public.profile_activity(p_profile uuid)
returns table (day date, events integer, xp integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (x.created_at at time zone 'Asia/Jerusalem')::date, count(*)::int, sum(x.xp)::int
    from public.xp_events x
   where x.profile_id = p_profile
     and x.created_at >= now() - interval '182 days'
     and public.can_see_profile_section(p_profile, 'learning')
   group by 1
   order by 1;
$$;

revoke execute on function public.profile_activity(uuid) from public;
grant execute on function public.profile_activity(uuid) to anon, authenticated;
