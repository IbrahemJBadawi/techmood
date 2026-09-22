-- =============================================================================
-- 0071 — Meetings inside the work, and files that are actually files
--
-- Two things I flagged as "not built without a decision from you". Both turned
-- out to need less invention than the flag implied.
--
-- 1. A client↔freelancer meeting needs no booking kind and no pricing model.
--    A booking is somebody buying somebody else's time. Two parties to a
--    contract that already exists are not buying anything from each other.
--    `team_internal` is already that shape — a room, a window, a participant
--    list, no money — so a project meeting is a fourth *session type*.
--
-- 2. Attachments were links because `project_evidence` is links. But the
--    platform does upload: payment proofs and avatars have lived in Supabase
--    Storage since 0012. So the honest answer was not "links are the pattern",
--    it was "nobody had put a bucket behind work files yet". Two buckets, the
--    same folder-per-owner policy shape as the proofs, and the existing
--    `kind = 'file'` rows now point at a stored object instead of somebody
--    else's Google Drive.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The meeting
-- ---------------------------------------------------------------------------
alter table public.video_sessions
  add column project_id uuid references public.projects (id) on delete cascade,
  -- team meetings never had a subject either; a room with a name is a better
  -- room than a room with a date
  add column topic_ar text;

create index video_sessions_project_idx on public.video_sessions (project_id, start_at);

alter table public.video_sessions drop constraint video_sessions_source;

alter table public.video_sessions
  add constraint video_sessions_source check (
    (session_type in ('student_mentor', 'team_mentor', 'company_mentor') and booking_id is not null) or
    (session_type = 'team_internal'   and booking_id is null and team_id is not null) or
    (session_type = 'project_meeting' and booking_id is null and project_id is not null)
  );

-- Who belongs in a project's room: the two sides of the contract, plus the
-- team doing the work when there is one. Nobody else, however public the
-- project page is.
create or replace function public.is_project_party(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project
       and (
         p.owner_id = (select auth.uid())
         or p.client_id = (select auth.uid())
         or (p.team_id is not null and public.is_team_member(p.team_id))
       )
  );
$$;

grant execute on function public.is_project_party(uuid) to authenticated;

create or replace function public.schedule_project_meeting(
  p_project uuid,
  p_start   timestamptz,
  p_end     timestamptz,
  p_topic   text default null
)
returns public.video_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_session public.video_sessions;
  v_used    integer;
  v_other   uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.is_project_party(p_project) then
    raise exception 'طرفا المشروع فقط من يحجزان اجتماعاته';
  end if;

  select * into v_project from public.projects where id = p_project;

  if v_project.client_id is null then
    raise exception 'هذا المشروع بلا عميل — اجتماعات المشروع بين طرفين';
  end if;

  if p_end <= p_start then
    raise exception 'وقت النهاية يجب أن يكون بعد البداية';
  end if;

  if p_start < now() then
    raise exception 'لا يمكن حجز اجتماع في الماضي';
  end if;

  -- A cap for the same reason the team has one: a room costs the platform
  -- something, and an interface that can book unlimited rooms will.
  select count(*) into v_used
    from public.video_sessions s
   where s.project_id = p_project
     and s.session_type = 'project_meeting'
     and s.status <> 'cancelled'
     and s.start_at >= date_trunc('week', now())
     and s.start_at <  date_trunc('week', now()) + interval '7 days';

  if v_used >= 5 then
    raise exception 'بلغ هذا المشروع حدّ خمسة اجتماعات في الأسبوع';
  end if;

  insert into public.video_sessions (project_id, session_type, start_at, end_at, topic_ar)
  values (p_project, 'project_meeting', p_start, p_end,
          nullif(btrim(coalesce(p_topic, '')), ''))
  returning * into v_session;

  -- The client, whoever owns the work, and the team doing it.
  insert into public.video_session_participants (session_id, profile_id, role)
  values (v_session.id, v_project.client_id, 'client'),
         (v_session.id, v_project.owner_id, 'contractor')
  on conflict do nothing;

  if v_project.team_id is not null then
    insert into public.video_session_participants (session_id, profile_id, role)
    select v_session.id, tm.profile_id, 'member'::public.session_role
      from public.team_members tm
     where tm.team_id = v_project.team_id and tm.is_active
    on conflict do nothing;
  end if;

  -- Tell the other side, whichever side asked.
  v_other := case when v_me = v_project.client_id then v_project.owner_id else v_project.client_id end;

  perform public.notify(
    v_other, 'work', 'اجتماع جديد على مشروع',
    coalesce(v_session.topic_ar, v_project.title_ar),
    '/projects/' || p_project::text, 'project', p_project, 'important');

  return v_session;
end;
$$;

grant execute on function public.schedule_project_meeting(uuid, timestamptz, timestamptz, text) to authenticated;

create or replace function public.cancel_project_meeting(p_session uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.video_sessions%rowtype;
begin
  select * into v_session from public.video_sessions where id = p_session;

  if not found or v_session.session_type <> 'project_meeting' then
    raise exception 'الاجتماع غير موجود';
  end if;

  if not public.is_project_party(v_session.project_id) then
    raise exception 'طرفا المشروع فقط من يلغيان اجتماعاته';
  end if;

  if v_session.status not in ('scheduled', 'live') then
    raise exception 'هذا الاجتماع انتهى';
  end if;

  update public.video_sessions
     set status = 'cancelled', ended_at = now()
   where id = p_session;

  perform public.notify(
    vp.profile_id, 'work', 'أُلغي اجتماع المشروع', p_reason,
    '/projects/' || v_session.project_id::text, 'project', v_session.project_id)
    from public.video_session_participants vp
   where vp.session_id = p_session and vp.profile_id <> (select auth.uid());
end;
$$;

grant execute on function public.cancel_project_meeting(uuid, text) to authenticated;

create or replace function public.project_meetings(p_project uuid)
returns table (
  id        uuid,
  session_code text,
  topic_ar  text,
  start_at  timestamptz,
  end_at    timestamptz,
  status    public.video_session_status,
  attended  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.session_code, s.topic_ar, s.start_at, s.end_at, s.status,
         (select count(distinct e.profile_id)::int
            from public.video_presence_events e where e.session_id = s.id)
    from public.video_sessions s
   where s.project_id = p_project
     and s.session_type = 'project_meeting'
     and public.is_project_party(p_project)
   order by s.start_at desc;
$$;

grant execute on function public.project_meetings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- And the calendar shows them, because the hub gathers everything with a time
-- on it. Re-stated in full rather than patched, so the whole query stays
-- readable in one place.
-- ---------------------------------------------------------------------------
create or replace function public.my_calendar(p_from date, p_to date)
returns table (
  entry_kind text,
  entry_id   uuid,
  title_ar   text,
  detail_ar  text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  on_date    date,
  state      text,
  tone       text,
  link       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (select team_id from public.team_members tm, me
            where tm.profile_id = me.id and tm.is_active)

  -- mentor sessions: mine as a student, mine as the mentor, my team's
  select case when b.kind = 'team_mentor' then 'team_session' else 'mentor_session' end,
         b.id,
         coalesce(b.topic_ar, 'جلسة إرشاد'),
         to_char(b.scheduled_start, 'HH24:MI'),
         b.scheduled_start,
         b.scheduled_end,
         b.scheduled_start::date,
         b.status::text,
         case
           when b.status in ('cancelled', 'rejected', 'refunded', 'expired') then 'cancelled'
           when b.status = 'completed' then 'done'
           when b.status = 'confirmed' then (case when b.kind = 'team_mentor' then 'team' else 'mentor' end)
           else 'pending'
         end,
         '/bookings/' || b.id::text
    from public.bookings b, me
   where b.scheduled_start::date between p_from and p_to
     and (
       b.student_id = me.id
       or b.mentor_id = me.id
       or (b.team_id is not null and b.team_id in (select team_id from mine))
     )

  union all

  -- rooms that are not bookings: a team's own hours, and the meetings the two
  -- sides of a project hold about the work they are already contracted for
  select case when s.session_type = 'project_meeting' then 'project_meeting' else 'team_meeting' end,
         s.id,
         coalesce(s.topic_ar,
                  case when s.session_type = 'project_meeting' then 'اجتماع مشروع' else 'اجتماع فريق' end),
         to_char(s.start_at, 'HH24:MI'),
         s.start_at,
         s.end_at,
         s.start_at::date,
         s.status::text,
         case when s.status in ('cancelled', 'no_show') then 'cancelled'
              when s.status = 'completed' then 'done'
              else 'internal' end,
         '/sessions/' || s.id::text
    from public.video_sessions s
    join public.video_session_participants vp on vp.session_id = s.id
    cross join me
   where s.session_type in ('team_internal', 'project_meeting')
     and vp.profile_id = me.id
     and s.start_at::date between p_from and p_to

  union all

  -- what is due from me on a team board
  select 'task',
         t.id,
         t.title_ar,
         tm.title_ar,
         null::timestamptz,
         null::timestamptz,
         t.due_on,
         t.column_key::text,
         case when t.column_key = 'done' then 'done'
              when t.due_on < current_date then 'late'
              else 'task' end,
         '/teams/' || tm.id::text || '/tasks/' || t.id::text
    from public.team_tasks t
    join public.teams tm on tm.id = t.team_id
    cross join me
   where t.assignee_id = me.id
     and t.due_on between p_from and p_to

  union all

  -- the dates my teams work to
  select 'milestone',
         m.id,
         m.title_ar,
         p.title_ar,
         null::timestamptz,
         null::timestamptz,
         m.due_on,
         case when m.is_done then 'done' else 'open' end,
         case when m.is_done then 'done' else 'milestone' end,
         '/teams/' || p.team_id::text || '/projects'
    from public.project_milestones m
    join public.projects p on p.id = m.project_id
   where p.team_id in (select team_id from mine)
     and m.due_on between p_from and p_to

  union all

  select 'sprint',
         sp.id,
         'نهاية السبرنت ' || sp.number,
         sp.goal_ar,
         null::timestamptz,
         null::timestamptz,
         sp.ends_on,
         'sprint',
         'sprint',
         '/teams/' || sp.team_id::text || '/sprints'
    from public.sprints sp
   where sp.team_id in (select team_id from mine)
     and sp.ends_on between p_from and p_to

  order by 7, 5 nulls last;
$$;

grant execute on function public.my_calendar(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Files that are files
--
-- The folder-per-owner shape is the one the payment proofs have used since
-- 0012: the first segment of the object name is the id that decides access,
-- and a `security definer` helper answers the question the policy cannot ask
-- inline. Nothing here is public — a brief's attachments follow the brief's
-- own visibility, and a project's files stay between its parties.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('brief-files', 'brief-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

-- Whoever may read the brief may read what came with it. One rule, asked once.
create or replace function public.can_read_brief(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
     where o.id = p_opportunity
       and (
         o.posted_by = (select auth.uid())
         or public.is_admin()
         or (o.status = 'published'
             and (o.visibility = 'public' or public.can_see_private_brief(o.id)))
       )
  );
$$;

create or replace function public.can_write_brief(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
     where o.id = p_opportunity
       and (o.posted_by = (select auth.uid()) or public.is_admin())
  );
$$;

grant execute on function public.can_read_brief(uuid)  to authenticated;
grant execute on function public.can_write_brief(uuid) to authenticated;

create policy brief_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brief-files'
    and public.can_read_brief(((storage.foldername(name))[1])::uuid)
  );

create policy brief_files_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brief-files'
    and public.can_write_brief(((storage.foldername(name))[1])::uuid)
  );

create policy brief_files_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brief-files'
    and public.can_write_brief(((storage.foldername(name))[1])::uuid)
  );

-- A project's files are between its parties. Not "public if the project is
-- public": a public project page shows finished work, not the client's brief,
-- their invoices or the half-finished drafts in between.
create policy project_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and public.is_project_party(((storage.foldername(name))[1])::uuid)
  );

create policy project_files_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.is_project_party(((storage.foldername(name))[1])::uuid)
  );

create policy project_files_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and public.is_project_party(((storage.foldername(name))[1])::uuid)
  );

-- A stored file is still a row, so it can carry a label and be listed. Rather
-- than a second table for "uploaded evidence", the existing rows say where the
-- file lives: `is_upload` marks a url that is an object path in the bucket
-- above, not somebody else's link.
alter table public.opportunity_attachments
  add column is_upload boolean not null default false;

alter table public.project_evidence
  add column is_upload boolean not null default false;

comment on column public.project_evidence.is_upload is
  'true when `url` is a path inside the project-files bucket rather than an external link. A signed url is minted for it at read time and never stored.';

-- A project meeting's counterpart is the work, not a person: a room with the
-- client, the freelancer and two team members has no single other side.
create or replace function public.my_sessions(p_past boolean default false)
returns table (
  id           uuid,
  session_code text,
  session_type public.video_session_type,
  start_at     timestamptz,
  end_at       timestamptz,
  status       public.video_session_status,
  phase        text,
  my_role      public.session_role,
  counterpart  text,
  participants integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select s.id,
         s.session_code,
         s.session_type,
         s.start_at,
         s.end_at,
         s.status,
         public.session_phase(s.id),
         vp.role,
         case
           when s.session_type = 'project_meeting' then (select p.title_ar from public.projects p where p.id = s.project_id)
           when s.session_type = 'team_internal' then (select t.title_ar from public.teams t where t.id = s.team_id)
           when s.session_type = 'team_mentor' then (select t.title_ar from public.teams t where t.id = s.team_id)
           else (
             select pr.full_name from public.video_session_participants vp2
               join public.profiles pr on pr.id = vp2.profile_id
              where vp2.session_id = s.id and vp2.profile_id <> me.id
              limit 1)
         end,
         (select count(*)::int from public.video_session_participants vp3 where vp3.session_id = s.id)
    from public.video_sessions s
    join public.video_session_participants vp on vp.session_id = s.id
    cross join me
   where vp.profile_id = me.id
     and (case when p_past then s.end_at < now() else s.end_at >= now() end)
   order by s.start_at;
$$;

grant execute on function public.my_sessions(boolean) to authenticated;
