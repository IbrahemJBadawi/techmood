-- =============================================================================
-- 0069 — Giving the two roles what they were missing, and nothing they had
--
-- The rule that shaped this migration: **almost none of it is new behaviour.**
-- The client's whole journey — brief, proposals, terms, escrow, milestones,
-- delivery, review — was built across 0025, 0050, 0051, 0054, 0055 and 0056.
-- The mentee's whole journey — find, book, pay, attend, and a blind two-way
-- rating — was built across 0014, 0044 and 0045. Building either again would
-- have been the easy way to look busy and the fastest way to split the data.
--
-- So what lands here is only what was genuinely absent:
--
--   * the two roles themselves, self-serve rather than reviewed;
--   * a brief that can be invite-only, and that can carry files;
--   * comparing candidates side by side, out of the matching that already
--     existed per candidate;
--   * the review the freelancer writes about the client, which never existed —
--     only the client's judgement of the work did;
--   * a client's own numbers, and a public client profile;
--   * mentorship goals, so a mentee's sessions add up to a journey instead of
--     a list of receipts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles you choose, rather than roles somebody grants you
-- ---------------------------------------------------------------------------
create or replace function public.enforce_student_role_autoapproval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Student is automatic. Mentee and client are self-serve: they open a
  -- workspace, they do not make a claim about the person, so there is nothing
  -- for a reviewer to verify and no reason to make anybody wait.
  if new.role in ('student', 'mentee', 'client') then
    new.status := 'approved';
  end if;

  if new.role = 'admin' and new.status = 'approved'
     and (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'admin role cannot be self-granted';
  end if;

  return new;
end;
$$;

create or replace function public.apply_for_role(
  p_role         public.user_role,
  p_note         text default null,
  p_evidence_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := (select auth.uid());
  v_id       uuid;
  v_status   public.role_status;
  v_instant  boolean := p_role in ('mentee', 'client');
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_role = 'admin' then
    raise exception 'دور الإدارة لا يُطلب — يُمنح من إدارة أخرى';
  end if;
  if p_role = 'student' then
    raise exception 'دور الطالب مفعّل تلقائياً لكل حساب';
  end if;

  select pr.id, pr.status into v_id, v_status
    from public.profile_roles pr
   where pr.profile_id = v_me and pr.role = p_role;

  if v_id is not null then
    if v_status = 'approved' then
      raise exception 'هذا الدور مفعّل لديك بالفعل';
    end if;
    if v_status = 'suspended' then
      raise exception 'هذا الدور موقوف — تواصل مع الإدارة';
    end if;
    if v_status = 'pending_review' and not v_instant then
      raise exception 'طلبك قيد المراجعة بالفعل';
    end if;

    update public.profile_roles
       set status           = (case when v_instant then 'approved' else 'pending_review' end)::public.role_status,
           application_note = coalesce(p_note, application_note),
           evidence_url     = coalesce(p_evidence_url, evidence_url),
           reviewed_by      = null,
           reviewed_at      = null,
           review_note      = null
     where id = v_id;
  else
    insert into public.profile_roles (profile_id, role, status, application_note, evidence_url)
    values (v_me, p_role,
            (case when v_instant then 'approved' else 'pending_review' end)::public.role_status,
            p_note, p_evidence_url)
    returning id into v_id;
  end if;

  -- The trail is written either way: a role that opened instantly still says
  -- when it opened and who opened it.
  insert into public.role_request_events (role_request_id, actor_id, event, note)
  values (v_id, v_me,
          (case when v_instant then 'approved' else 'submitted' end)::public.role_request_event,
          p_note);

  return v_id;
end;
$$;

-- A client is somebody with work to hand out. That is the whole qualification.
create or replace function public.can_post_opportunity(
  p_kind public.opportunity_kind,
  p_team uuid default null,
  p_startup uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_startup is not null then public.can_manage_startup(p_startup)
    when p_kind = 'team_seat' then p_team is not null and public.is_team_leader(p_team)
    when p_kind = 'cofounder' then public.has_role('founder') or public.has_role('company')
    else public.has_role('company')
      or public.has_role('founder')
      or public.has_role('team_leader')
      or public.has_role('freelancer')
      or public.has_role('client')
  end or public.is_admin();
$$;

-- Two conflicts found while adding the client, worth fixing here rather than
-- documenting as quirks:
--
--   1. `can_post_opportunity` has existed twice since 0059 — the two-argument
--      version from 0025 and the three-argument one that was meant to replace
--      it. Both answer a one-argument call, so `can_post_opportunity('freelance')`
--      is ambiguous and errors. The old one goes.
--   2. `opportunities_create` checked `(kind, team_id)` and never looked at
--      `startup_id`, which 0059 added. That let anybody publish a brief stamped
--      with a company they have no part in. The policy now asks the same
--      question the rest of the platform asks: may you manage that company?
drop policy opportunities_create on public.opportunities;

drop function public.can_post_opportunity(public.opportunity_kind, uuid);

create policy opportunities_create on public.opportunities
  for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and public.can_post_opportunity(kind, team_id, startup_id)
  );

-- ---------------------------------------------------------------------------
-- The brief: who may see it, and what it carries
-- ---------------------------------------------------------------------------
alter table public.opportunities
  add column visibility public.opportunity_visibility not null default 'public';

comment on column public.opportunities.visibility is
  'invite_only shows the brief to the people invited to it and to nobody else. Invites already existed; nothing had ever said the brief itself was private.';

-- Who may see a private brief. It is `security definer` on purpose: asking the
-- invites and the applications from inside the opportunities policy, with their
-- own policies pointing back at opportunities, is a recursion the planner
-- rightly refuses. The function reads only this caller's own rows, so nothing
-- is widened by stepping around RLS here.
create or replace function public.can_see_private_brief(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunity_invites oi
     where oi.opportunity_id = p_opportunity
       and (oi.invited_profile = (select auth.uid())
            or (oi.invited_team is not null and public.is_team_member(oi.invited_team)))
  )
  -- somebody who already applied keeps their view: a brief cannot vanish from
  -- under an application that is still open
  or exists (
    select 1 from public.opportunity_applications oa
     where oa.opportunity_id = p_opportunity and oa.profile_id = (select auth.uid())
  );
$$;

grant execute on function public.can_see_private_brief(uuid) to anon, authenticated;

drop policy opportunities_read on public.opportunities;

create policy opportunities_read on public.opportunities
  for select to anon, authenticated
  using (
    posted_by = (select auth.uid())
    or public.is_admin()
    or (
      status = 'published'
      and (visibility = 'public' or public.can_see_private_brief(id))
    )
  );

-- A brief is often a document, a screenshot, or a link to what exists already.
create table public.opportunity_attachments (
  id             uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  label          text not null check (char_length(label) between 1 and 120),
  url            text not null,
  kind           public.evidence_kind not null default 'file',
  added_by       uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index opportunity_attachments_idx on public.opportunity_attachments (opportunity_id);

alter table public.opportunity_attachments enable row level security;

-- Whoever may read the brief may read what is attached to it. One rule, stated
-- once, rather than a second copy of the visibility logic that can drift.
create policy opportunity_attachments_read on public.opportunity_attachments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.opportunities o
       where o.id = opportunity_id
         and (o.posted_by = (select auth.uid())
              or public.is_admin()
              or (o.status = 'published'
                  and (o.visibility = 'public' or public.can_see_private_brief(o.id))))
    )
  );

create policy opportunity_attachments_write on public.opportunity_attachments
  for all to authenticated
  using (exists (select 1 from public.opportunities o
                  where o.id = opportunity_id and o.posted_by = (select auth.uid())))
  with check (exists (select 1 from public.opportunities o
                       where o.id = opportunity_id and o.posted_by = (select auth.uid())));

grant select, insert, delete on public.opportunity_attachments to authenticated;
grant select on public.opportunity_attachments to anon;

-- ---------------------------------------------------------------------------
-- Comparing, without ranking
--
-- `opportunity_match()` has answered "how does this one person line up against
-- this brief" since 0025. Comparing is that answer for everybody who applied,
-- in one table — deliberately without a score, a winner or a sort order. The
-- client decides; the platform lays out the evidence.
-- ---------------------------------------------------------------------------
create or replace function public.compare_candidates(p_opportunity uuid)
returns table (
  application_id  uuid,
  profile_id      uuid,
  full_name       text,
  techmood_id     text,
  invited_team    uuid,
  team_title      text,
  stage           public.application_stage,
  proposed_amount numeric,
  proposed_days   integer,
  stars           numeric,
  rated_count     integer,
  projects_done   integer,
  work_approved   integer,
  xp              integer,
  matched_skills  text[],
  missing_skills  text[],
  meets_stars     boolean,
  meets_path      boolean,
  applied_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.opportunities o
     where o.id = p_opportunity
       and (o.posted_by = (select auth.uid()) or public.is_admin())
  ) then
    raise exception 'المقارنة لصاحب الفرصة وحده';
  end if;

  return query
  select a.id,
         a.profile_id,
         coalesce(p.display_name, p.full_name),
         p.techmood_id,
         inv.invited_team,
         tm.title_ar,
         a.stage,
         a.proposed_amount_usd,
         a.proposed_days,
         ps.stars_avg,
         coalesce(ps.rated_count, 0),
         (select count(*)::int from public.projects pr
           where pr.owner_id = a.profile_id and pr.status = 'completed'),
         (select count(*)::int from public.submissions s
            join public.evaluations e on e.submission_id = s.id
           where s.profile_id = a.profile_id and e.decision = 'approved'),
         (select coalesce(sum(x.xp), 0)::int from public.xp_events x
           where x.profile_id = a.profile_id),
         m.matched_skills,
         m.missing_skills,
         m.meets_stars,
         m.meets_path,
         a.created_at
    from public.opportunity_applications a
    join public.profiles p on p.id = a.profile_id
    -- A team never applies as a team: a client invites one, and its leader
    -- answers. Saying which team the invitation went to is the honest way to
    -- show a team in a comparison.
    left join lateral (
      select oi.invited_team
        from public.opportunity_invites oi
        join public.teams t2 on t2.id = oi.invited_team
       where oi.opportunity_id = a.opportunity_id
         and oi.status = 'accepted'
         and t2.leader_id = a.profile_id
       limit 1
    ) inv on true
    left join public.teams tm on tm.id = inv.invited_team
    left join public.profile_stars ps on ps.profile_id = a.profile_id
    cross join lateral public.opportunity_match(p_opportunity, a.profile_id) m
   where a.opportunity_id = p_opportunity
   order by a.created_at;
end;
$$;

grant execute on function public.compare_candidates(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The half of the review that never existed
--
-- 0056 gave the client a judgement of the work. Nobody had ever asked the
-- person who did the work what the client was like to work for — which is the
-- half that decides whether a good freelancer takes the next brief.
-- ---------------------------------------------------------------------------
create table public.worker_reviews (
  id         uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  escrow_id  uuid references public.escrows (id) on delete set null,
  worker_id  uuid not null references public.profiles (id) on delete cascade,
  client_id  uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  comment_ar text,
  created_at timestamptz not null default now(),

  unique (project_id, worker_id)
);

create index worker_reviews_client_idx on public.worker_reviews (client_id);

create table public.worker_review_scores (
  review_id uuid not null references public.worker_reviews (id) on delete cascade,
  criterion public.worker_criterion not null,
  stars     smallint not null check (stars between 1 and 5),

  primary key (review_id, criterion)
);

alter table public.worker_reviews enable row level security;
alter table public.worker_review_scores enable row level security;

-- A client's record is public for the same reason a freelancer's is: somebody
-- is about to decide whether to work with them.
create policy worker_reviews_read on public.worker_reviews
  for select to anon, authenticated using (true);

create policy worker_review_scores_read on public.worker_review_scores
  for select to anon, authenticated using (true);

grant select on public.worker_reviews, public.worker_review_scores to anon, authenticated;

create or replace function public.review_client(
  p_project uuid,
  p_scores  jsonb,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_escrow  public.escrows%rowtype;
  v_id      uuid;
  v_key     text;
  v_count   integer := 0;
  v_sum     integer := 0;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if v_project.owner_id is distinct from v_me then
    raise exception 'من نفّذ العمل فقط من يقيّم صاحبه';
  end if;

  if v_project.client_id is null then
    raise exception 'هذا المشروع بلا عميل';
  end if;

  if v_project.status not in ('completed', 'sold') then
    raise exception 'التقييم بعد اكتمال العمل فقط';
  end if;

  -- Same rule as the other direction: a review follows money that moved.
  select * into v_escrow from public.escrows
   where project_id = p_project and payee_id = v_me and status = 'released'
   order by released_at desc limit 1;

  if not found then
    raise exception 'التقييم بعد الإفراج عن المستحقات فقط';
  end if;

  if exists (select 1 from public.worker_reviews wr
              where wr.project_id = p_project and wr.worker_id = v_me) then
    raise exception 'قيّمت هذا العميل بالفعل';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.worker_criterion)) c) then
      v_count := v_count + 1;
      v_sum := v_sum + least(5, greatest(1, (p_scores ->> v_key)::int));
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'التقييم يحتاج درجة واحدة على الأقل';
  end if;

  insert into public.worker_reviews (project_id, escrow_id, worker_id, client_id, stars, comment_ar)
  values (p_project, v_escrow.id, v_me, v_project.client_id,
          round(v_sum::numeric / v_count, 0)::smallint,
          nullif(trim(coalesce(p_comment, '')), ''))
  returning id into v_id;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.worker_criterion)) c) then
      insert into public.worker_review_scores (review_id, criterion, stars)
      values (v_id, v_key::public.worker_criterion, least(5, greatest(1, (p_scores ->> v_key)::int)));
    end if;
  end loop;

  perform public.notify(
    v_project.client_id, 'work', 'وصل تقييم لك كعميل',
    p_comment, '/projects/' || p_project::text, 'project', p_project);

  return v_id;
end;
$$;

grant execute on function public.review_client(uuid, jsonb, text) to authenticated;

insert into public.reputation_dimensions (slug, name_ar, weight)
values ('client_conduct', 'التعامل كعميل', 1.00)
on conflict (slug) do nothing;

-- The meter that reads it. `communication` is the same person communicating
-- whichever side of the brief they stood on, so it takes both; conduct as a
-- client is its own dimension, because being a good client and being a good
-- freelancer are different skills and blending them would hide both.
create or replace function public.recompute_reputation(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value numeric;
begin
  select round(avg(ev.stars) * 20, 2) into v_value
    from public.evaluations ev
    join public.submissions s on s.id = ev.submission_id
   where s.profile_id = p_profile and ev.decision = 'approved' and ev.stars is not null;
  perform public.set_reputation(p_profile, 'learning', v_value);

  select round(avg(sc.stars) * 20, 2) into v_value
    from public.exhibition_review_scores sc
    join public.exhibition_reviews r on r.id = sc.review_id
    join public.exhibition_entries e on e.id = r.entry_id
   where exists (
     select 1 from jsonb_array_elements(coalesce(e.snapshot -> 'members', '[]'::jsonb)) m
      where (m ->> 'profile_id')::uuid = p_profile
   );
  perform public.set_reputation(p_profile, 'projects', v_value);

  select round(avg(sf.stars) * 20, 2) into v_value
    from public.session_feedback sf where sf.to_profile = p_profile;
  perform public.set_reputation(p_profile, 'mentor_rating', v_value);

  select round(avg(cr.stars) * 20, 2) into v_value
    from public.client_reviews cr where cr.worker_id = p_profile;
  perform public.set_reputation(p_profile, 'client_rating', v_value);

  -- what the people who did the work said about them as a client
  select round(avg(wr.stars) * 20, 2) into v_value
    from public.worker_reviews wr where wr.client_id = p_profile;
  perform public.set_reputation(p_profile, 'client_conduct', v_value);

  select least(100, count(*) * 10)::numeric into v_value
    from public.team_tasks t
   where t.assignee_id = p_profile and t.column_key = 'done';
  perform public.set_reputation(p_profile, 'team', nullif(v_value, 0));

  select round(avg(signal) * 100, 2) into v_value from (
    select case when e.status = 'released' then 1.0 when e.status = 'refunded' then 0.0 else null end as signal
      from public.escrows e where e.payee_id = p_profile
    union all
    select case when exists (
             select 1 from public.video_presence_events ev
              where ev.session_id = vs.id and ev.profile_id = p_profile
           ) then 1.0 else 0.0 end
      from public.video_sessions vs
      join public.video_session_participants vp on vp.session_id = vs.id
     where vp.profile_id = p_profile and vs.status in ('completed', 'no_show')
  ) signals where signal is not null;
  perform public.set_reputation(p_profile, 'reliability', v_value);

  select round(avg(stars) * 20, 2) into v_value from (
    select crs.stars from public.client_review_scores crs
      join public.client_reviews cr on cr.id = crs.review_id
     where cr.worker_id = p_profile and crs.criterion = 'quality'
    union all
    select sfs.stars from public.session_feedback_scores sfs
      join public.session_feedback sf on sf.id = sfs.feedback_id
     where sf.to_profile = p_profile and sfs.criterion = 'quality'
  ) scores;
  perform public.set_reputation(p_profile, 'quality', v_value);

  select round(avg(stars) * 20, 2) into v_value from (
    select crs.stars from public.client_review_scores crs
      join public.client_reviews cr on cr.id = crs.review_id
     where cr.worker_id = p_profile and crs.criterion = 'communication'
    union all
    select sfs.stars from public.session_feedback_scores sfs
      join public.session_feedback sf on sf.id = sfs.feedback_id
     where sf.to_profile = p_profile and sfs.criterion = 'communication'
    union all
    select wrs.stars from public.worker_review_scores wrs
      join public.worker_reviews wr on wr.id = wrs.review_id
     where wr.client_id = p_profile and wrs.criterion = 'communication'
  ) scores;
  perform public.set_reputation(p_profile, 'communication', v_value);
end;
$$;

create or replace function public.reputation_after_worker_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_reputation(new.client_id);
  return new;
end;
$$;

create trigger worker_reviews_reputation
  after insert on public.worker_reviews
  for each row execute function public.reputation_after_worker_review();

-- ---------------------------------------------------------------------------
-- A client's own numbers
-- ---------------------------------------------------------------------------
create or replace function public.client_overview()
returns table (
  open_briefs      integer,
  proposals        integer,
  new_proposals    integer,
  active_projects  integer,
  completed        integer,
  hires            integer,
  in_escrow_usd    numeric,
  released_usd     numeric,
  awaiting_review  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select
    (select count(*)::int from public.opportunities o, me
      where o.posted_by = me.id and o.status = 'published'),
    (select count(*)::int from public.opportunity_applications a
       join public.opportunities o on o.id = a.opportunity_id, me
      where o.posted_by = me.id),
    (select count(*)::int from public.opportunity_applications a
       join public.opportunities o on o.id = a.opportunity_id, me
      where o.posted_by = me.id and a.stage = 'submitted'),
    (select count(*)::int from public.projects p, me
      where p.client_id = me.id and p.status in ('planning', 'in_progress', 'in_review')),
    (select count(*)::int from public.projects p, me
      where p.client_id = me.id and p.status in ('completed', 'sold')),
    -- one hire is one person this client actually paid, however many briefs
    (select count(distinct e.payee_id)::int from public.escrows e, me
      where e.payer_id = me.id and e.status in ('funded', 'released')),
    (select coalesce(sum(e.amount_usd), 0) from public.escrows e, me
      where e.payer_id = me.id and e.status = 'funded'),
    (select coalesce(sum(e.amount_usd), 0) from public.escrows e, me
      where e.payer_id = me.id and e.status = 'released'),
    (select count(*)::int from public.projects p, me
      where p.client_id = me.id and p.status in ('completed', 'sold')
        and not exists (select 1 from public.client_reviews cr
                         where cr.project_id = p.id and cr.client_id = me.id));
$$;

grant execute on function public.client_overview() to authenticated;

-- What a visitor sees before deciding to work for somebody.
create or replace function public.client_profile(p_profile uuid)
returns table (
  briefs_posted    integer,
  projects_done    integer,
  hires            integer,
  stars            numeric,
  reviews          integer,
  paid_on_time     numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.opportunities o
      where o.posted_by = p_profile and o.status = 'published'),
    (select count(*)::int from public.projects p
      where p.client_id = p_profile and p.status in ('completed', 'sold')),
    (select count(distinct e.payee_id)::int from public.escrows e
      where e.payer_id = p_profile and e.status in ('funded', 'released')),
    (select round(avg(wr.stars), 2) from public.worker_reviews wr where wr.client_id = p_profile),
    (select count(*)::int from public.worker_reviews wr where wr.client_id = p_profile),
    -- the payment criterion on its own: the number a freelancer looks for first
    (select round(avg(wrs.stars), 2) from public.worker_review_scores wrs
       join public.worker_reviews wr on wr.id = wrs.review_id
      where wr.client_id = p_profile and wrs.criterion = 'payment');
$$;

grant execute on function public.client_profile(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The mentee's journey, which was a list of receipts
--
-- Everything a mentee does already worked: finding a mentor, booking, paying,
-- attending an internal room, and a two-way rating that stays sealed until
-- both sides have written. What was missing is the thread between sessions —
-- why somebody booked three of them, and whether it worked.
--
-- Deliberately not `smart_goals`: those belong to a company and are measured in
-- revenue and users. A mentorship goal belongs to a person, and the honest
-- measure of it is "did it happen", answered by the person themselves.
-- ---------------------------------------------------------------------------
create table public.mentorship_goals (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title_ar   text not null check (char_length(title_ar) between 2 and 200),
  detail_ar  text,
  -- the mentor this goal is being worked on with, when there is one
  mentor_id  uuid references public.mentor_profiles (profile_id) on delete set null,
  status     public.mentorship_goal_status not null default 'active',
  target_on  date,
  outcome_ar text,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

create index mentorship_goals_owner_idx on public.mentorship_goals (profile_id, status);

alter table public.mentorship_goals enable row level security;

-- A goal is between a person and, at most, their mentor. Nobody else.
create policy mentorship_goals_own on public.mentorship_goals
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy mentorship_goals_mentor_read on public.mentorship_goals
  for select to authenticated
  using (mentor_id = (select auth.uid()));

grant select, insert, update, delete on public.mentorship_goals to authenticated;

-- A session can say which goal it served, so the journey is a chain rather
-- than a pile.
alter table public.bookings
  add column mentorship_goal_id uuid references public.mentorship_goals (id) on delete set null;

create or replace function public.close_mentorship_goal(
  p_goal    uuid,
  p_status  public.mentorship_goal_status,
  p_outcome text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status = 'active' then
    raise exception 'الإغلاق يحتاج نتيجة: تحقّق أم توقّف';
  end if;

  update public.mentorship_goals
     set status     = p_status,
         outcome_ar = coalesce(nullif(btrim(p_outcome), ''), outcome_ar),
         closed_at  = now()
   where id = p_goal and profile_id = (select auth.uid());

  if not found then
    raise exception 'الهدف غير موجود';
  end if;
end;
$$;

grant execute on function public.close_mentorship_goal(uuid, public.mentorship_goal_status, text) to authenticated;

create or replace function public.mentee_overview()
returns table (
  sessions_attended integer,
  mentors           integer,
  hours             numeric,
  upcoming          integer,
  goals_active      integer,
  goals_achieved    integer,
  rating_received   numeric,
  awaiting_rating   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select b.* from public.bookings b, me
     where b.student_id = me.id
  )
  select
    (select count(*)::int from mine where status = 'completed'),
    (select count(distinct mentor_id)::int from mine where status = 'completed'),
    (select round(coalesce(sum(extract(epoch from (scheduled_end - scheduled_start)) / 3600), 0)::numeric, 1)
       from mine where status = 'completed'),
    (select count(*)::int from mine where status = 'confirmed' and scheduled_start > now()),
    (select count(*)::int from public.mentorship_goals g, me
      where g.profile_id = me.id and g.status = 'active'),
    (select count(*)::int from public.mentorship_goals g, me
      where g.profile_id = me.id and g.status = 'achieved'),
    -- what the mentors said about them, which is the mentee's own reputation
    (select round(avg(sf.stars), 2) from public.session_feedback sf, me
      where sf.to_profile = me.id),
    (select count(*)::int from mine b, me
      where b.status = 'completed'
        and not exists (select 1 from public.session_feedback sf
                         where sf.booking_id = b.id and sf.from_profile = me.id));
$$;

grant execute on function public.mentee_overview() to authenticated;

-- The journey itself, oldest first: a goal, the sessions booked against it,
-- and how it ended.
create or replace function public.my_mentorship()
returns table (
  goal_id     uuid,
  title_ar    text,
  detail_ar   text,
  status      public.mentorship_goal_status,
  target_on   date,
  outcome_ar  text,
  mentor_id   uuid,
  mentor_name text,
  sessions    integer,
  last_session timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.title_ar, g.detail_ar, g.status, g.target_on, g.outcome_ar,
         g.mentor_id,
         coalesce(p.display_name, p.full_name),
         (select count(*)::int from public.bookings b where b.mentorship_goal_id = g.id),
         (select max(b.scheduled_start) from public.bookings b
           where b.mentorship_goal_id = g.id and b.status = 'completed')
    from public.mentorship_goals g
    left join public.profiles p on p.id = g.mentor_id
   where g.profile_id = (select auth.uid())
   order by (g.status <> 'active'), g.created_at desc;
$$;

grant execute on function public.my_mentorship() to authenticated;

-- Bookings are written by functions, not by their parties (0027), so saying
-- "this session was for that goal" is a function too — and it checks that both
-- the session and the goal belong to the person asking.
create or replace function public.link_session_to_goal(p_booking uuid, p_goal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.bookings b where b.id = p_booking and b.student_id = v_me
  ) then
    raise exception 'الجلسة ليست لك';
  end if;

  if p_goal is not null and not exists (
    select 1 from public.mentorship_goals g where g.id = p_goal and g.profile_id = v_me
  ) then
    raise exception 'الهدف غير موجود';
  end if;

  update public.bookings set mentorship_goal_id = p_goal where id = p_booking;
end;
$$;

grant execute on function public.link_session_to_goal(uuid, uuid) to authenticated;
