-- =============================================================================
-- 0140 — A first look at submitted work, at once
--
-- Right after a learner submits, the model reads what it can of the work — a
-- GitHub repository's README and list of files — against the assignment's
-- brief, and writes a checklist: each thing the brief asks for, found,
-- missing or unclear, with a line of advice. The learner sees it in seconds
-- instead of waiting days to learn they forgot the README; the mentor sees the
-- same list beside the work.
--
-- It never grades. It has no part in the evaluation, gives no stars and
-- decides nothing; the mentor's review is untouched. A link it cannot open (a
-- Drive folder, a private repository) is marked unclear, for the mentor.
--
-- One look per submitted version, asked by its owner (claim_submission_precheck),
-- written by the ai-gemini Edge Function with the service role
-- (save_submission_precheck), within a daily limit per member.
-- =============================================================================

create table public.submission_prechecks (
  version_id    uuid primary key references public.submission_versions (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  result        jsonb,
  model         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index submission_prechecks_submission_idx on public.submission_prechecks (submission_id, created_at desc);

alter table public.submission_prechecks enable row level security;
revoke all on public.submission_prechecks from anon, authenticated;
grant select on public.submission_prechecks to authenticated;

-- Whoever may read the submission may read its first look.
create policy submission_prechecks_read on public.submission_prechecks
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
     where s.id = submission_prechecks.submission_id
       and (s.profile_id = (select auth.uid())
            or public.is_admin()
            or (s.status <> 'draft' and public.is_mentor())
            or (s.team_id is not null and public.is_team_member(s.team_id)))));

insert into public.platform_settings (key, value, description_ar) values
  ('precheck_member_daily', '10', 'كم فحصاً أولياً للتسليمات يطلبه عضو يومياً')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The owner asks; returns the version to look at.
-- ---------------------------------------------------------------------------
create or replace function public.claim_submission_precheck(p_submission uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_sub     public.submissions%rowtype;
  v_version uuid;
  v_row     public.submission_prechecks%rowtype;
  v_limit   integer := coalesce(public.setting_int('precheck_member_daily'), 10);
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_sub from public.submissions where id = p_submission;
  if v_sub.id is null or v_sub.profile_id is distinct from v_me then
    raise exception 'هذا التسليم ليس لك';
  end if;

  select id into v_version from public.submission_versions
   where submission_id = p_submission order by version desc limit 1;
  if v_version is null then
    raise exception 'لا نسخة مُسلّمة بعد';
  end if;

  select * into v_row from public.submission_prechecks where version_id = v_version for update;
  if v_row.status = 'done' then
    raise exception 'فُحص هذا التسليم بالفعل';
  end if;
  if v_row.status = 'pending' and v_row.created_at > now() - interval '2 minutes' then
    raise exception 'الفحص جارٍ الآن';
  end if;

  if not public.is_admin()
     and (select count(*) from public.submission_prechecks p
            join public.submissions s on s.id = p.submission_id
           where s.profile_id = v_me and p.created_at > now() - interval '1 day') >= v_limit then
    raise exception 'بلغت حدّ الفحص الأولي لليوم';
  end if;

  insert into public.submission_prechecks (version_id, submission_id, status, created_at)
  values (v_version, p_submission, 'pending', now())
  on conflict (version_id) do update set status = 'pending', created_at = now(), result = null, finished_at = null;

  return v_version;
end;
$$;

revoke execute on function public.claim_submission_precheck(uuid) from public, anon;
grant execute on function public.claim_submission_precheck(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- For the Edge Function only
-- ---------------------------------------------------------------------------
create or replace function public.precheck_material(p_version uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'assignment', a.title_ar,
    'brief', a.brief_ar,
    'required_evidence', to_jsonb(a.required_evidence),
    'lesson', l.title_ar,
    'course', c.title_ar,
    'note', v.note_ar,
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'url', e.url))
                            from public.submission_evidence e where e.version_id = v.id), '[]'::jsonb))
    from public.submission_versions v
    join public.submissions s on s.id = v.submission_id
    join public.assignments a on a.id = s.assignment_id
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
    left join public.courses c on c.id = coalesce(a.course_id, m.course_id)
   where v.id = p_version;
$$;

revoke execute on function public.precheck_material(uuid) from public, anon, authenticated;
grant execute on function public.precheck_material(uuid) to service_role;

-- What the model wrote, if it is the shape the page shows; otherwise "failed".
create or replace function public.precheck_valid(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  it    jsonb;
  items jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object'
     or jsonb_typeof(p -> 'summary') is distinct from 'string'
     or jsonb_typeof(p -> 'items') is distinct from 'array'
     or jsonb_array_length(p -> 'items') not between 1 and 12 then
    return null;
  end if;
  for it in select value from jsonb_array_elements(p -> 'items') loop
    if jsonb_typeof(it -> 'item') is distinct from 'string' or length(btrim(it ->> 'item')) = 0
       or coalesce(it ->> 'status', '') not in ('found', 'missing', 'unclear') then
      return null;
    end if;
    items := items || jsonb_build_array(jsonb_build_object(
      'item', left(btrim(it ->> 'item'), 200),
      'status', it ->> 'status',
      'note', left(btrim(coalesce(it ->> 'note', '')), 300)));
  end loop;
  return jsonb_build_object(
    'summary', left(btrim(p ->> 'summary'), 600),
    'items', items,
    'next', left(btrim(coalesce(p ->> 'next', '')), 400),
    'read', coalesce(p -> 'read', '[]'::jsonb));
end;
$$;

revoke execute on function public.precheck_valid(jsonb) from public, anon, authenticated;

create or replace function public.save_submission_precheck(p_version uuid, p_result jsonb, p_model text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb := public.precheck_valid(p_result);
begin
  update public.submission_prechecks
     set status = case when v_result is null then 'failed' else 'done' end,
         result = v_result, model = p_model, finished_at = now()
   where version_id = p_version and status = 'pending';
  return v_result is not null;
end;
$$;

revoke execute on function public.save_submission_precheck(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_submission_precheck(uuid, jsonb, text) to service_role;
