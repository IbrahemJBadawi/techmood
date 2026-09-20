-- =============================================================================
-- TechMood — 0021 Exhibition
--
-- The last link in the chain the product describes:
--   Team -> Project -> Mentor -> Evaluation -> EXHIBITION -> Portfolio -> Work
--
-- Without it a finished project stays locked inside a private workspace and
-- never reaches the member's professional record. Approving an entry is what
-- turns team work into evidence.
--
-- Two decisions worth stating:
--
--   * Contributions are DERIVED from completed tasks, never self-reported. Who
--     did what on a project is already recorded on the board; asking people to
--     restate it would invite a nicer story than the one the work tells.
--
--   * An approved entry carries a SNAPSHOT, like a certificate. The gallery is
--     public while most teams are private, so publishing copies what was
--     approved rather than opening a window into live workspace data.
-- =============================================================================

alter table public.projects
  add column completed_at timestamptz;

create or replace function public.stamp_project_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_stamp_completion
  before update of status on public.projects
  for each row execute function public.stamp_project_completion();

alter table public.exhibition_entries
  add column entry_code   text unique default ('TMX-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6))),
  add column documentation_ar text,
  add column published_at timestamptz,
  -- frozen at approval: what the public gallery renders
  add column snapshot     jsonb;

update public.exhibition_entries
   set entry_code = 'TMX-' || upper(substr(replace(id::text, '-', ''), 1, 6))
 where entry_code is null;

alter table public.exhibition_entries alter column entry_code set not null;

create index exhibition_entries_published_idx on public.exhibition_entries (published_at desc)
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- Who actually built it: derived from the board, not from a form.
-- ---------------------------------------------------------------------------
create or replace function public.project_contributions(p_project uuid)
returns table (profile_id uuid, full_name text, techmood_id text, responsibility_ar text, tasks_done integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.full_name,
         p.techmood_id,
         tm.responsibility_ar,
         count(t.id)::integer as tasks_done
  from public.team_tasks t
  join public.profiles p on p.id = t.assignee_id
  left join public.teams tt on tt.id = t.team_id
  left join public.team_members tm on tm.team_id = t.team_id and tm.profile_id = p.id
  where t.project_id = p_project
    and t.column_key = 'done'
  group by p.id, p.full_name, p.techmood_id, tm.responsibility_ar
  order by count(t.id) desc;
$$;

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
create or replace function public.submit_to_exhibition(
  p_project      uuid,
  p_summary      text,
  p_technologies text[] default '{}',
  p_demo_url     text default null,
  p_documentation text default null
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
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'project % not found', p_project;
  end if;

  if v_project.owner_id <> v_me
     and not (v_project.team_id is not null and public.is_team_leader(v_project.team_id))
     and not public.is_admin() then
    raise exception 'only the project owner or the team leader may submit it';
  end if;

  if v_project.status <> 'completed' then
    raise exception 'only a completed project can be submitted to the exhibition';
  end if;

  if coalesce(trim(p_summary), '') = '' then
    raise exception 'the exhibition entry needs a summary of the work';
  end if;

  insert into public.exhibition_entries
    (project_id, team_id, submitted_by, summary_ar, technologies, demo_url, documentation_ar, status)
  values
    (p_project, v_project.team_id, v_me, p_summary, coalesce(p_technologies, '{}'), p_demo_url, p_documentation, 'submitted')
  on conflict (project_id) do update
    set summary_ar       = excluded.summary_ar,
        technologies     = excluded.technologies,
        demo_url         = excluded.demo_url,
        documentation_ar = excluded.documentation_ar,
        status           = 'submitted',
        review_note_ar   = null
  returning * into v_entry;

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewing. Approval freezes the snapshot the gallery will show.
-- ---------------------------------------------------------------------------
create or replace function public.review_exhibition_entry(
  p_entry   uuid,
  p_approve boolean,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry   public.exhibition_entries%rowtype;
  v_project public.projects%rowtype;
  v_team    public.teams%rowtype;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'only an admin may review an exhibition entry';
  end if;

  select * into v_entry from public.exhibition_entries where id = p_entry;
  if not found then
    raise exception 'entry % not found', p_entry;
  end if;

  if not p_approve then
    update public.exhibition_entries
       set status = 'rejected', reviewed_by = (select auth.uid()),
           reviewed_at = now(), review_note_ar = p_note
     where id = p_entry;
    return;
  end if;

  select * into v_project from public.projects where id = v_entry.project_id;
  select * into v_team    from public.teams    where id = v_entry.team_id;

  -- Everything the public page needs, copied once, so a private workspace stays
  -- private after its project is published.
  v_snapshot := jsonb_build_object(
    'project_code',  v_project.code,
    'project_title', v_project.title_ar,
    'description',   v_project.description_ar,
    'summary',       v_entry.summary_ar,
    'documentation', v_entry.documentation_ar,
    'technologies',  to_jsonb(v_entry.technologies),
    'demo_url',      v_entry.demo_url,
    'completed_on',  to_char(coalesce(v_project.completed_at, now()), 'YYYY-MM-DD'),
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
    'mentors', coalesce((
      select jsonb_agg(distinct jsonb_build_object('full_name', p.full_name, 'stars', r.stars))
      from public.team_reviews r
      join public.profiles p on p.id = r.mentor_id
      where r.team_id = v_entry.team_id
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'url', e.url, 'label', e.label))
      from public.project_evidence e
      where e.project_id = v_entry.project_id
    ), '[]'::jsonb)
  );

  update public.exhibition_entries
     set status = 'approved',
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         review_note_ar = p_note,
         published_at = now(),
         snapshot = v_snapshot
   where id = p_entry;

  -- The team earns its project XP when the work is published, not before.
  if v_entry.team_id is not null then
    perform public.award_team_xp(v_entry.team_id, 'project_completed', 'projects', v_entry.project_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The public gallery reads snapshots only — never live project or team rows.
-- ---------------------------------------------------------------------------
create or replace view public.exhibition_gallery
with (security_invoker = true) as
  select e.entry_code,
         e.published_at,
         e.snapshot
  from public.exhibition_entries e
  where e.status = 'approved' and e.snapshot is not null;

-- What a member can show on their passport: the published work they built.
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
  where e.status = 'approved'
    and e.snapshot is not null
    and (member ->> 'profile_id')::uuid = p_profile
  order by e.published_at desc;
$$;

grant execute on function public.project_contributions(uuid)                    to authenticated;
grant execute on function public.submit_to_exhibition(uuid, text, text[], text, text) to authenticated;
grant execute on function public.review_exhibition_entry(uuid, boolean, text)   to authenticated;
grant execute on function public.profile_exhibition_entries(uuid)               to anon, authenticated;

-- Add exhibition submissions to the one queue admins already work from.
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
      where e.status = 'submitted';

-- Projects are created and driven from inside a team, so the team's own
-- permission model decides who may do it.
drop policy projects_write on public.projects;

create policy projects_write on public.projects
  for all to authenticated
  using (
    owner_id = (select auth.uid())
    or (team_id is not null and public.team_permission(team_id, 'members_edit_project'))
    or public.is_admin()
  )
  with check (
    owner_id = (select auth.uid())
    or (team_id is not null and public.team_permission(team_id, 'members_edit_project'))
    or public.is_admin()
  );

grant select on all tables in schema public to anon, authenticated;
