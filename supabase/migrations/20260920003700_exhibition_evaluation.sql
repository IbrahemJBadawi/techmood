-- =============================================================================
-- 0037 — The exhibition becomes verified evidence
--
-- 0021 built the chain Team → Project → Exhibition → Portfolio, and it works:
-- an entry is submitted, an admin approves it, and approval freezes a snapshot
-- the public gallery renders. What it cannot say is the thing the exhibition
-- document is entirely about — *what a mentor judged, criterion by criterion*.
--
-- So this migration adds the judgement and the ladder around it, and changes
-- three things that were decided differently before. Each one is a change, not
-- an addition, so each one is stated here:
--
-- 1. **A mentor reviews, not only an admin.** 0021 required is_admin(). Work is
--    judged by mentors everywhere else on this platform — evaluate_submission()
--    has allowed "a mentor or an admin" since 0004 — and an exhibition entry is
--    the same kind of object: somebody's work, judged against criteria. The
--    admin route stays, so nothing that worked stops working.
--
-- 2. **Approving and exhibiting are separate.** They used to be one step. They
--    are not the same decision: approval is the mentor's judgement, exhibiting
--    is the builder's choice to make the work public. The academy already
--    refuses to make anyone publish their work to be graded, and the gallery
--    should not be the exception. Entries already published are migrated to
--    'exhibited' so nothing disappears from the gallery.
--
-- 3. **Rejection becomes revision.** The document's ladder ends "revision
--    required → new version → re-review", not a closed door. 'rejected' stays
--    in the enum for the entries that carry it, but review now asks for a
--    revision instead.
--
-- What is NOT added, because it exists:
--   * contributions — still derived from completed tasks (project_contributions)
--   * the snapshot — still frozen, still the only thing the public page reads
--   * stars and XP — still two different things: the rubric average is quality,
--     the XP event is progress, and neither is computed from the other.
-- =============================================================================

alter type public.exhibition_status add value if not exists 'under_review' after 'submitted';
alter type public.exhibition_status add value if not exists 'revision_required' after 'under_review';
alter type public.exhibition_status add value if not exists 'exhibited' after 'approved';

-- What the exhibition document asks a mentor to judge.
create type public.review_criterion as enum (
  'requirements', 'technical_quality', 'ui_ux',
  'problem_solving', 'documentation', 'completeness'
);

create type public.exhibition_decision as enum ('approved', 'revision_required');

-- The kinds of project the gallery distinguishes.
create type public.project_kind as enum (
  'course', 'path', 'capstone', 'team', 'startup', 'personal'
);

alter table public.projects
  add column kind public.project_kind not null default 'personal';

-- Backfilled from what the row already says: a project attached to a path is a
-- path project, one attached to a team is a team project, and the rest are
-- personal until somebody says otherwise.
update public.projects
   set kind = case
                when path_id is not null then 'path'
                when team_id is not null then 'team'
                else 'personal'
              end::public.project_kind;

-- ---------------------------------------------------------------------------
-- What an entry says about the work
-- ---------------------------------------------------------------------------
-- The document asks for problem, solution and outcome as separate things,
-- because "what it does" and "why it exists" are different questions and a
-- single summary answers neither well.
alter table public.exhibition_entries
  add column problem_ar   text,
  add column solution_ar  text,
  add column outcomes_ar  text[] not null default '{}',
  add column cover_url    text,
  add column version      integer not null default 1,

  add constraint exhibition_entries_cover_is_http
    check (cover_url is null or cover_url ~* '^https?://');

-- ---------------------------------------------------------------------------
-- The judgement itself
-- ---------------------------------------------------------------------------
-- Append-only, like every other evaluation on this platform: a second review
-- of a second version is a second row, never an edit of the first. That is
-- what makes "Project History" possible without keeping a parallel log.
create table public.exhibition_reviews (
  id          uuid primary key default extensions.gen_random_uuid(),
  entry_id    uuid not null references public.exhibition_entries (id) on delete cascade,
  version     integer not null,
  mentor_id   uuid not null references public.profiles (id) on delete cascade,
  decision    public.exhibition_decision not null,
  feedback_ar text,
  created_at  timestamptz not null default now()
);

create index exhibition_reviews_entry_idx on public.exhibition_reviews (entry_id, created_at desc);

create table public.exhibition_review_scores (
  review_id uuid not null references public.exhibition_reviews (id) on delete cascade,
  criterion public.review_criterion not null,
  stars     smallint not null check (stars between 1 and 5),

  primary key (review_id, criterion)
);

alter table public.exhibition_reviews       enable row level security;
alter table public.exhibition_review_scores enable row level security;

-- A review is readable by the people it is about, the mentor who wrote it, and
-- admins. The public never needs it: the snapshot carries what was published.
create policy exhibition_reviews_read on public.exhibition_reviews
  for select to authenticated
  using (
    public.is_admin()
    or mentor_id = (select auth.uid())
    or exists (
      select 1 from public.exhibition_entries e
        join public.projects p on p.id = e.project_id
       where e.id = entry_id
         and (p.owner_id = (select auth.uid())
              or (p.team_id is not null and public.is_team_member(p.team_id)))
    )
  );

create policy exhibition_review_scores_read on public.exhibition_review_scores
  for select to authenticated
  using (exists (select 1 from public.exhibition_reviews r where r.id = review_id));

-- Writes go through review_exhibition_entry() only: a score nobody can insert
-- by hand is a score that always comes with its decision and its feedback.
grant select on public.exhibition_reviews, public.exhibition_review_scores to authenticated;

-- ---------------------------------------------------------------------------
-- The overall rating is an average, not a number somebody typed
-- ---------------------------------------------------------------------------
create or replace function public.exhibition_review_rating(p_review uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select round(avg(s.stars)::numeric, 1)
    from public.exhibition_review_scores s
   where s.review_id = p_review;
$$;

comment on function public.exhibition_review_rating is
  'The quality rating of a review: the average of its criteria. Never stored, so it cannot disagree with the criteria it came from.';

-- ---------------------------------------------------------------------------
-- Submitting, again if need be
-- ---------------------------------------------------------------------------
drop function if exists public.submit_to_exhibition(uuid, text, text[], text, text);

create or replace function public.submit_to_exhibition(
  p_project       uuid,
  p_summary       text,
  p_technologies  text[] default '{}',
  p_demo_url      text default null,
  p_documentation text default null,
  p_problem       text default null,
  p_solution      text default null,
  p_outcomes      text[] default '{}',
  p_cover_url     text default null
)
returns public.exhibition_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_entry   public.exhibition_entries%rowtype;
  v_existing public.exhibition_entries%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if v_project.owner_id <> v_me
     and not (v_project.team_id is not null and public.is_team_leader(v_project.team_id))
     and not public.is_admin() then
    raise exception 'صاحب المشروع أو قائد الفريق فقط من يقدّمه للمعرض';
  end if;

  if v_project.status <> 'completed' then
    raise exception 'المشروع المكتمل فقط يمكن تقديمه للمعرض';
  end if;

  if coalesce(trim(p_summary), '') = '' then
    raise exception 'المشاركة في المعرض تحتاج ملخّصاً للعمل';
  end if;

  select * into v_existing from public.exhibition_entries where project_id = p_project;

  if found and v_existing.status = 'exhibited' then
    raise exception 'هذا المشروع معروض بالفعل — اسحبه من المعرض قبل تعديله';
  end if;

  insert into public.exhibition_entries
    (project_id, team_id, submitted_by, summary_ar, technologies, demo_url,
     documentation_ar, problem_ar, solution_ar, outcomes_ar, cover_url, status)
  values
    (p_project, v_project.team_id, v_me, p_summary, coalesce(p_technologies, '{}'), p_demo_url,
     p_documentation, p_problem, p_solution, coalesce(p_outcomes, '{}'), p_cover_url, 'submitted')
  on conflict (project_id) do update
    set summary_ar       = excluded.summary_ar,
        technologies     = excluded.technologies,
        demo_url         = excluded.demo_url,
        documentation_ar = excluded.documentation_ar,
        problem_ar       = excluded.problem_ar,
        solution_ar      = excluded.solution_ar,
        outcomes_ar      = excluded.outcomes_ar,
        cover_url        = excluded.cover_url,
        status           = 'submitted',
        review_note_ar   = null,
        -- a resubmission after a review is a new version to be judged
        version          = public.exhibition_entries.version
                           + case when public.exhibition_entries.status
                                       in ('revision_required', 'approved', 'rejected')
                                  then 1 else 0 end
  returning * into v_entry;

  return v_entry;
end;
$$;

-- A mentor picking an entry up, so two mentors do not review the same work at
-- the same time and the builder can see that somebody is looking.
create or replace function public.start_exhibition_review(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.has_role('mentor') or public.is_admin()) then
    raise exception 'مراجعة المعرض للمنتورين والإدارة فقط';
  end if;

  update public.exhibition_entries
     set status = 'under_review'
   where id = p_entry and status = 'submitted';
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewing: the rubric, the decision, and the snapshot
-- ---------------------------------------------------------------------------
drop function if exists public.review_exhibition_entry(uuid, boolean, text);

create or replace function public.review_exhibition_entry(
  p_entry   uuid,
  p_approve boolean,
  p_note    text default null,
  -- {"requirements": 5, "technical_quality": 4, ...}
  p_scores  jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_entry   public.exhibition_entries%rowtype;
  v_project public.projects%rowtype;
  v_team    public.teams%rowtype;
  v_owner   public.profiles%rowtype;
  v_review  uuid;
  v_criterion text;
  v_missing text;
  v_snapshot jsonb;
begin
  if not (public.has_role('mentor') or public.is_admin()) then
    raise exception 'مراجعة المعرض للمنتورين والإدارة فقط';
  end if;

  select * into v_entry from public.exhibition_entries where id = p_entry;
  if not found then
    raise exception 'المشاركة غير موجودة';
  end if;

  if v_entry.status not in ('submitted', 'under_review') then
    raise exception 'هذه المشاركة ليست بانتظار المراجعة';
  end if;

  -- A judgement without its criteria is a number nobody can argue with.
  if p_approve then
    select string_agg(c::text, '، ')
      into v_missing
      from unnest(enum_range(null::public.review_criterion)) c
     where p_scores ->> c::text is null;

    if v_missing is not null then
      raise exception 'التقييم يحتاج درجة لكل معيار — ينقص: %', v_missing;
    end if;
  end if;

  insert into public.exhibition_reviews (entry_id, version, mentor_id, decision, feedback_ar)
  values (p_entry, v_entry.version, v_me,
          case when p_approve then 'approved' else 'revision_required' end::public.exhibition_decision,
          p_note)
  returning id into v_review;

  for v_criterion in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_criterion = any (select c::text from unnest(enum_range(null::public.review_criterion)) c) then
      insert into public.exhibition_review_scores (review_id, criterion, stars)
      values (v_review, v_criterion::public.review_criterion,
              least(5, greatest(1, (p_scores ->> v_criterion)::smallint)));
    end if;
  end loop;

  if not p_approve then
    update public.exhibition_entries
       set status = 'revision_required', reviewed_by = v_me,
           reviewed_at = now(), review_note_ar = p_note
     where id = p_entry;
    return;
  end if;

  select * into v_project from public.projects  where id = v_entry.project_id;
  select * into v_team    from public.teams     where id = v_entry.team_id;
  select * into v_owner   from public.profiles  where id = v_project.owner_id;

  -- Everything the public page needs, copied once, so a private workspace
  -- stays private after its project is published.
  v_snapshot := jsonb_build_object(
    'project_code',  v_project.code,
    'project_title', v_project.title_ar,
    'description',   v_project.description_ar,
    'summary',       v_entry.summary_ar,
    'documentation', v_entry.documentation_ar,
    'problem',       v_entry.problem_ar,
    'solution',      v_entry.solution_ar,
    'outcomes',      to_jsonb(v_entry.outcomes_ar),
    'technologies',  to_jsonb(v_entry.technologies),
    'demo_url',      v_entry.demo_url,
    'cover_url',     v_entry.cover_url,
    'kind',          v_project.kind,
    'version',       v_entry.version,
    'completed_on',  to_char(coalesce(v_project.completed_at, now()), 'YYYY-MM-DD'),
    'path', (
      select jsonb_build_object('slug', lp.slug, 'title', lp.title_ar)
        from public.learning_paths lp where lp.id = v_project.path_id
    ),
    'school', (
      select jsonb_build_object('slug', s.slug, 'name', s.name_ar)
        from public.learning_paths lp
        join public.schools s on s.id = lp.school_id
       where lp.id = v_project.path_id
    ),
    'creator', case when v_team.id is not null then null else jsonb_build_object(
      'profile_id',  v_owner.id,
      'full_name',   v_owner.full_name,
      'techmood_id', v_owner.techmood_id
    ) end,
    'team', case when v_team.id is null then null else jsonb_build_object(
      'code',  v_team.team_code,
      'title', v_team.title_ar
    ) end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id',     c.profile_id,
        'full_name',      c.full_name,
        'techmood_id',    c.techmood_id,
        'responsibility', c.responsibility_ar,
        'tasks_done',     c.tasks_done
      ) order by c.tasks_done desc)
      from public.project_contributions(v_entry.project_id) c
    ), '[]'::jsonb),
    -- the judgement, frozen with the work it judged
    'evaluation', jsonb_build_object(
      'mentor_name',  (select p.full_name from public.profiles p where p.id = v_me),
      'mentor_id',    (select p.techmood_id from public.profiles p where p.id = v_me),
      'reviewed_on',  to_char(now(), 'YYYY-MM-DD'),
      'feedback',     p_note,
      'rating',       public.exhibition_review_rating(v_review),
      'criteria',     coalesce((
        select jsonb_object_agg(s.criterion::text, s.stars)
          from public.exhibition_review_scores s where s.review_id = v_review
      ), '{}'::jsonb)
    ),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'url', e.url, 'label', e.label))
      from public.project_evidence e
      where e.project_id = v_entry.project_id
    ), '[]'::jsonb)
  );

  update public.exhibition_entries
     set status = 'approved',
         reviewed_by = v_me,
         reviewed_at = now(),
         review_note_ar = p_note,
         snapshot = v_snapshot
   where id = p_entry;

  -- The team earns its project XP when the work survives review, not when the
  -- last task is ticked. XP is progress; the rating above is quality. They are
  -- computed from different things on purpose.
  if v_entry.team_id is not null then
    perform public.award_team_xp(v_entry.team_id, 'project_completed', 'projects', v_entry.project_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exhibiting is the builder's decision
-- ---------------------------------------------------------------------------
create or replace function public.publish_exhibition_entry(p_entry uuid, p_public boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_entry   public.exhibition_entries%rowtype;
  v_project public.projects%rowtype;
begin
  select * into v_entry from public.exhibition_entries where id = p_entry;
  if not found then
    raise exception 'المشاركة غير موجودة';
  end if;

  select * into v_project from public.projects where id = v_entry.project_id;

  if v_project.owner_id <> v_me
     and not (v_project.team_id is not null and public.is_team_leader(v_project.team_id))
     and not public.is_admin() then
    raise exception 'صاحب المشروع أو قائد الفريق فقط من يقرر عرضه';
  end if;

  if p_public then
    if v_entry.status <> 'approved' then
      raise exception 'لا يُعرض إلا عمل اعتمده منتور';
    end if;

    update public.exhibition_entries
       set status = 'exhibited', published_at = coalesce(published_at, now())
     where id = p_entry;
  else
    update public.exhibition_entries
       set status = 'approved', published_at = null
     where id = p_entry and status = 'exhibited';
  end if;
end;
$$;

-- Entries approved before this migration were published by that same act, so
-- they are already in the gallery and stay there.
update public.exhibition_entries
   set status = 'exhibited'
 where status = 'approved' and published_at is not null and snapshot is not null;

-- The read policy has to follow the split, and this is the part that would
-- have leaked: 0019 opened 'approved' to the world, and 'approved' now means
-- "a mentor has judged it" — a private state the builder has not chosen to
-- publish. Only 'exhibited' is public. A mentor is added instead, because a
-- mentor cannot review what they cannot read.
-- A policy that applies `to anon` may only call functions anon can execute.
-- Postgres is not obliged to short-circuit the first branch, so a signed-out
-- visitor reading the gallery would otherwise hit "permission denied for
-- function is_team_member" — the same trap is_admin() fell into in 0028.
grant execute on function public.is_team_member(uuid)             to anon;
grant execute on function public.has_role(public.user_role)       to anon;

drop policy exhibition_read on public.exhibition_entries;

create policy exhibition_read on public.exhibition_entries
  for select to anon, authenticated
  using (
    status = 'exhibited'
    or submitted_by = (select auth.uid())
    or (team_id is not null and public.is_team_member(team_id))
    or exists (select 1 from public.projects p
                where p.id = project_id and p.owner_id = (select auth.uid()))
    or (status in ('submitted', 'under_review', 'approved', 'revision_required')
        and public.has_role('mentor'))
    or public.is_admin()
  );

create or replace view public.exhibition_gallery
with (security_invoker = true) as
  select e.entry_code,
         e.published_at,
         e.snapshot
  from public.exhibition_entries e
  where e.status = 'exhibited' and e.snapshot is not null;

create or replace function public.profile_exhibition_entries(p_profile uuid)
returns table (entry_code text, project_title text, team_title text, published_at timestamptz, tasks_done integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.entry_code,
         e.snapshot ->> 'project_title',
         e.snapshot #>> '{team,title}',
         e.published_at,
         (member ->> 'tasks_done')::integer
  from public.exhibition_entries e
  cross join lateral jsonb_array_elements(e.snapshot -> 'members') as member
  where e.status = 'exhibited'
    and e.snapshot is not null
    and (member ->> 'profile_id')::uuid = p_profile
  union all
  -- a solo project has no board to count tasks from; its builder is its owner
  select e.entry_code,
         e.snapshot ->> 'project_title',
         null,
         e.published_at,
         0
  from public.exhibition_entries e
  where e.status = 'exhibited'
    and e.snapshot is not null
    and (e.snapshot #>> '{creator,profile_id}')::uuid = p_profile
  order by published_at desc;
$$;

-- The review history of one entry, for its own project page.
create or replace function public.exhibition_entry_reviews(p_entry uuid)
returns table (
  version     integer,
  mentor_name text,
  decision    public.exhibition_decision,
  feedback_ar text,
  rating      numeric,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.version, p.full_name, r.decision, r.feedback_ar,
         public.exhibition_review_rating(r.id), r.created_at
    from public.exhibition_reviews r
    join public.profiles p on p.id = r.mentor_id
   where r.entry_id = p_entry
     and (
       public.is_admin()
       or r.mentor_id = (select auth.uid())
       or exists (
         select 1 from public.exhibition_entries e
           join public.projects pr on pr.id = e.project_id
          where e.id = r.entry_id
            and (pr.owner_id = (select auth.uid())
                 or (pr.team_id is not null and public.is_team_member(pr.team_id)))
       )
     )
   order by r.created_at desc;
$$;

grant execute on function public.submit_to_exhibition(uuid, text, text[], text, text, text, text, text[], text) to authenticated;
grant execute on function public.start_exhibition_review(uuid)                  to authenticated;
grant execute on function public.review_exhibition_entry(uuid, boolean, text, jsonb) to authenticated;
grant execute on function public.publish_exhibition_entry(uuid, boolean)        to authenticated;
grant execute on function public.exhibition_entry_reviews(uuid)                 to authenticated;
grant execute on function public.exhibition_review_rating(uuid)                 to authenticated;

-- The admin queue keeps working, and now shows what a mentor is already on.
create or replace view public.admin_review_queue
with (security_invoker = true) as
      select 'role_application' as item_kind, pr.id as item_id,
             p.full_name as subject, pr.role::text as detail, pr.created_at
      from public.profile_roles pr
      join public.profiles p on p.id = pr.profile_id
      where pr.status = 'pending_review'
  union all
      select 'submission', s.id, p.full_name, a.title_ar, s.updated_at
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.profiles p on p.id = s.profile_id
      where s.status in ('submitted', 'under_review')
  union all
      select 'payment', pay.id, coalesce(p.full_name, t.title_ar),
             pm.name_ar || ' · $' || pay.amount_usd::text, pay.submitted_at
      from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      join public.payment_methods pm on pm.key = pay.method_key
      left join public.profiles p on p.id = b.student_id
      left join public.teams t on t.id = b.team_id
      where pay.status = 'under_review'
  union all
      select 'incubator_application', ia.id, s.name_ar, s.stage::text, ia.created_at
      from public.incubator_applications ia
      join public.startups s on s.id = ia.startup_id
      where ia.status = 'pending_review'
  union all
      select 'reevaluation_request', rr.id, p.full_name, rr.reason_ar, rr.created_at
      from public.reevaluation_requests rr
      join public.profiles p on p.id = rr.requested_by
      where rr.status = 'open'
  union all
      select 'exhibition_entry', e.id, pr.title_ar, e.summary_ar, e.created_at
      from public.exhibition_entries e
      join public.projects pr on pr.id = e.project_id
      where e.status in ('submitted', 'under_review');
