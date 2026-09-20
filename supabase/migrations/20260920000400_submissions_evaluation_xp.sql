-- =============================================================================
-- TechMood — 0004 Submissions, evaluation history, XP and Stars
--
-- Two rules this file exists to enforce:
--   1. Every evaluation is traceable. A re-evaluation NEVER overwrites the
--      previous one: each resubmission is a new version and each review is a
--      new row, so the first score, the feedback, the original submission, the
--      edited submission and the new score all survive.
--   2. XP (quantity/progress) and Stars (quality) are different systems and are
--      never derived from each other. XP is an append-only ledger driven by a
--      data-driven rule table, not by a magic multiplier.
-- =============================================================================

create table public.submissions (
  id              uuid primary key default extensions.gen_random_uuid(),
  assignment_id   uuid not null references public.assignments (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  -- group work is owned by a team but still submitted by a profile
  team_id         uuid,
  status          public.submission_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (assignment_id, profile_id)
);

create index submissions_profile_idx on public.submissions (profile_id);
create index submissions_review_idx  on public.submissions (status)
  where status in ('submitted', 'under_review');

create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

-- Each submit/resubmit creates an immutable version.
create table public.submission_versions (
  id            uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version       integer not null check (version > 0),
  note_ar       text,
  submitted_at  timestamptz not null default now(),

  unique (submission_id, version)
);

create table public.submission_evidence (
  id         uuid primary key default extensions.gen_random_uuid(),
  version_id uuid not null references public.submission_versions (id) on delete cascade,
  kind       public.evidence_kind not null,
  url        text not null,
  label      text,

  constraint submission_evidence_url_is_http check (url ~* '^https?://')
);

create index submission_evidence_version_idx on public.submission_evidence (version_id);

-- ---------------------------------------------------------------------------
-- Evaluations — append-only. One row per review of one version.
-- ---------------------------------------------------------------------------
create table public.evaluations (
  id           uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version_id   uuid not null references public.submission_versions (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete restrict,
  decision     public.evaluation_decision not null,
  -- Stars are the quality signal, on their own 1..5 scale.
  stars        smallint check (stars between 1 and 5),
  -- Optional rubric score, kept for mentor bookkeeping only. It never becomes XP.
  score        smallint check (score between 0 and 100),
  feedback_ar  text,
  created_at   timestamptz not null default now(),

  -- an approval must carry a quality rating
  constraint evaluations_approved_needs_stars check (decision <> 'approved' or stars is not null)
);

create index evaluations_submission_idx on public.evaluations (submission_id, created_at);
create index evaluations_evaluator_idx  on public.evaluations (evaluator_id);

comment on table public.evaluations is
  'Append-only evaluation history. Editing a past evaluation is not supported by '
  'design: a re-review adds a row against the new submission version.';

-- ---------------------------------------------------------------------------
-- Re-evaluation requests (spec: the student may contest an evaluation)
-- ---------------------------------------------------------------------------
create table public.reevaluation_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  -- the evaluation being contested
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  requested_by  uuid not null references public.profiles (id) on delete cascade,
  reason_ar     text not null,
  status        public.reevaluation_status not null default 'open',
  -- a re-evaluation may be resolved through another mentor session
  booking_id    uuid,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index reevaluation_requests_open_idx on public.reevaluation_requests (status)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- Submitting: creates the next version and moves the submission to 'submitted'
-- ---------------------------------------------------------------------------
create or replace function public.submit_work(
  p_assignment_id uuid,
  p_evidence      jsonb,               -- [{"kind":"github","url":"https://...","label":"repo"}]
  p_note          text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile   uuid := (select auth.uid());
  v_submission public.submissions%rowtype;
  v_version_id uuid;
  v_next      integer;
  v_required  public.evidence_kind[];
  v_given     public.evidence_kind[];
  v_missing   public.evidence_kind[];
  v_item      jsonb;
begin
  if v_profile is null then
    raise exception 'not authenticated';
  end if;

  select required_evidence into v_required
  from public.assignments where id = p_assignment_id;

  if not found then
    raise exception 'assignment % not found', p_assignment_id;
  end if;

  -- every required evidence kind must be present
  select coalesce(array_agg(distinct (e ->> 'kind')::public.evidence_kind), '{}')
    into v_given
  from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) as e;

  select coalesce(array_agg(r), '{}') into v_missing
  from unnest(v_required) as r
  where not (r = any (v_given));

  if array_length(v_missing, 1) is not null then
    raise exception 'missing required evidence: %', v_missing;
  end if;

  insert into public.submissions (assignment_id, profile_id, status, current_version)
  values (p_assignment_id, v_profile, 'submitted', 1)
  on conflict (assignment_id, profile_id) do update
    set status          = 'submitted',
        current_version = public.submissions.current_version + 1,
        updated_at      = now()
  returning * into v_submission;

  v_next := v_submission.current_version;

  insert into public.submission_versions (submission_id, version, note_ar)
  values (v_submission.id, v_next, p_note)
  returning id into v_version_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb))
  loop
    insert into public.submission_evidence (version_id, kind, url, label)
    values (
      v_version_id,
      (v_item ->> 'kind')::public.evidence_kind,
      v_item ->> 'url',
      v_item ->> 'label'
    );
  end loop;

  return v_submission.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewing: only a mentor or an admin, and only against the current version
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_submission(
  p_submission_id uuid,
  p_decision      public.evaluation_decision,
  p_stars         smallint default null,
  p_feedback      text default null,
  p_score         smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluator uuid := (select auth.uid());
  v_version   uuid;
  v_eval_id   uuid;
begin
  if v_evaluator is null then
    raise exception 'not authenticated';
  end if;

  if not (public.is_mentor() or public.is_admin()) then
    raise exception 'only a mentor or an admin may evaluate a submission';
  end if;

  select sv.id into v_version
  from public.submission_versions sv
  join public.submissions s on s.id = sv.submission_id
  where sv.submission_id = p_submission_id
    and sv.version = s.current_version;

  if v_version is null then
    raise exception 'submission % has no submitted version to evaluate', p_submission_id;
  end if;

  insert into public.evaluations
    (submission_id, version_id, evaluator_id, decision, stars, feedback_ar, score)
  values
    (p_submission_id, v_version, v_evaluator, p_decision, p_stars, p_feedback, p_score)
  returning id into v_eval_id;

  update public.submissions
     set status = case p_decision
                    when 'approved'          then 'approved'::public.submission_status
                    when 'changes_requested' then 'changes_requested'::public.submission_status
                    else 'rejected'::public.submission_status
                  end,
         updated_at = now()
   where id = p_submission_id;

  return v_eval_id;
end;
$$;

-- =============================================================================
-- XP — data-driven, append-only, idempotent
-- =============================================================================

create table public.xp_rules (
  source      public.xp_source primary key,
  base_xp     integer not null default 0 check (base_xp between 0 and 500),
  per_star_xp integer not null default 0 check (per_star_xp between 0 and 100),
  description_ar text
);

comment on table public.xp_rules is
  'The whole XP economy lives here. Numbers are deliberately small so the scale '
  'stays readable; changing the economy is a data change, not a code change.';

create table public.xp_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source     public.xp_source not null references public.xp_rules (source),
  xp         integer not null check (xp > 0),
  -- what earned it, so an event can never be granted twice for the same thing
  ref_table  text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),

  unique (profile_id, source, ref_table, ref_id)
);

create index xp_events_profile_idx on public.xp_events (profile_id, created_at desc);

create table public.xp_levels (
  min_xp  integer primary key check (min_xp >= 0),
  title_ar text not null,
  sort_order integer not null
);

-- Grant XP without ever double-granting it.
create or replace function public.award_xp(
  p_profile_id uuid,
  p_source     public.xp_source,
  p_ref_table  text,
  p_ref_id     uuid,
  p_stars      smallint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.xp_rules%rowtype;
  v_xp   integer;
begin
  select * into v_rule from public.xp_rules where source = p_source;
  if not found then
    return 0;
  end if;

  v_xp := v_rule.base_xp + (coalesce(p_stars, 0) * v_rule.per_star_xp);
  if v_xp <= 0 then
    return 0;
  end if;

  insert into public.xp_events (profile_id, source, xp, ref_table, ref_id)
  values (p_profile_id, p_source, v_xp, p_ref_table, p_ref_id)
  on conflict (profile_id, source, ref_table, ref_id) do nothing;

  return v_xp;
end;
$$;

-- An approved evaluation is the only thing that turns work into XP.
create or replace function public.on_evaluation_award_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    public.submission_kind;
  v_owner   uuid;
  v_source  public.xp_source;
begin
  if new.decision <> 'approved' then
    return new;
  end if;

  select a.kind, s.profile_id
    into v_kind, v_owner
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;

  v_source := case v_kind
    when 'lesson_assignment' then 'assignment_evaluated'
    when 'course_project'    then 'course_project_evaluated'
    when 'course_task'       then 'assignment_evaluated'
    when 'path_project'      then 'path_project_evaluated'
    else null
  end::public.xp_source;

  if v_source is null then
    return new;
  end if;

  perform public.award_xp(v_owner, v_source, 'submissions', new.submission_id, new.stars);
  return new;
end;
$$;

create trigger evaluations_award_xp
  after insert on public.evaluations
  for each row execute function public.on_evaluation_award_xp();

-- Completing a lesson earns a small, fixed amount.
create or replace function public.on_lesson_completed_award_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
    perform public.award_xp(new.profile_id, 'lesson_completed', 'lessons', new.lesson_id, null);
  end if;
  return new;
end;
$$;

create trigger lesson_progress_award_xp
  before insert or update on public.lesson_progress
  for each row execute function public.on_lesson_completed_award_xp();

-- ---------------------------------------------------------------------------
-- Rollups
-- ---------------------------------------------------------------------------
create or replace view public.profile_xp
with (security_invoker = true) as
  select p.id as profile_id,
         coalesce(sum(e.xp), 0)::integer as total_xp
  from public.profiles p
  left join public.xp_events e on e.profile_id = p.id
  group by p.id;

-- Stars are an average of approved quality ratings — never a function of XP.
create or replace view public.profile_stars
with (security_invoker = true) as
  select s.profile_id,
         round(avg(ev.stars)::numeric, 2) as stars_avg,
         count(*)::integer as rated_count
  from public.evaluations ev
  join public.submissions s on s.id = ev.submission_id
  where ev.decision = 'approved' and ev.stars is not null
  group by s.profile_id;
