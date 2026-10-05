-- =============================================================================
-- 0127 — Who evaluated a showcased project
--
-- A project page already shows a mentor's rating of the work (0121). The
-- founder wants the mentor named too: the evaluator of the linked hand-in,
-- or the mentor who reviewed its exhibition entry. Only for a project that is
-- on show, and only the mentor's public face (name, TechMood ID, photo).
-- =============================================================================

create or replace function public.showcase_evaluator(p_project uuid)
returns table (full_name text, techmood_id text, avatar_url text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with by_handin as (
    select pr.full_name, pr.techmood_id, pr.avatar_url, ev.created_at
      from public.projects p
      join public.evaluations ev on ev.submission_id = p.submission_id and ev.decision = 'approved'
      join public.profiles pr on pr.id = ev.evaluator_id
     where p.id = p_project
     order by ev.created_at desc
     limit 1
  ),
  by_exhibition as (
    select pr.full_name, pr.techmood_id, pr.avatar_url,
           (e.snapshot #>> '{evaluation,reviewed_on}')::date::timestamptz
      from public.exhibition_entries e
      join public.profiles pr on pr.techmood_id = e.snapshot #>> '{evaluation,mentor_id}'
     where e.project_id = p_project and e.status in ('approved', 'exhibited') and e.snapshot is not null
     limit 1
  )
  select * from (
    select * from by_handin
    union all
    select * from by_exhibition where not exists (select 1 from by_handin)
  ) found
  where public.showcase_visible(p_project) or public.can_edit_showcase(p_project)
  limit 1;
$$;

revoke execute on function public.showcase_evaluator(uuid) from public;
grant execute on function public.showcase_evaluator(uuid) to anon, authenticated;
