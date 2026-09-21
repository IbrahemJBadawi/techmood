-- =============================================================================
-- 0038 — Proving a project outside TechMood
--
-- A project on the wall is evidence only if somebody who does not have a
-- TechMood account can check it. A certificate already has that: a code, a QR,
-- and verify_certificate() returning what a verifier needs and nothing more.
-- A project gets the same, built the same way.
--
-- Also here, because all three read the same frozen snapshots:
--
--   * Featured projects, chosen by stated conditions and never ranked. "#1"
--     would make the wall a competition; the document asks for a set that
--     meets a bar, so this returns everything that meets it, newest first.
--
--   * Categories with counts, so the wall can be explored by field. The school
--     is copied into the snapshot — it is catalogue data about the project, not
--     a window into the workspace it was built in — and backfilled for the
--     entries that were frozen before this migration.
--
--   * A public history: how many versions the work went through and what each
--     review decided. The mentor's written feedback is NOT in it. Feedback is
--     written to the people who built the thing, and a revision note read by
--     strangers years later is a different document than the one the mentor
--     wrote. exhibition_entry_reviews() still carries it to the people it was
--     written for.
-- =============================================================================

-- The school a project's path belongs to, copied into what is already frozen.
update public.exhibition_entries e
   set snapshot = jsonb_set(
         e.snapshot,
         '{school}',
         jsonb_build_object('slug', s.slug, 'name', s.name_ar)
       )
  from public.projects p
  join public.learning_paths lp on lp.id = p.path_id
  join public.schools s on s.id = lp.school_id
 where p.id = e.project_id
   and e.snapshot is not null
   and e.snapshot -> 'school' is null;

-- ---------------------------------------------------------------------------
-- Verification: what a stranger with the code is allowed to see
-- ---------------------------------------------------------------------------
-- The shape mirrors verify_certificate(): enough to believe the claim, and
-- nothing about the account behind it. Only an exhibited entry answers — work
-- a mentor approved but the builder has not published is nobody else's
-- business, and this function is the one place a code could have leaked it.
create or replace function public.verify_exhibition_entry(p_code text)
returns table (
  entry_code    text,
  project_title text,
  project_code  text,
  built_by      text,
  is_team       boolean,
  kind          public.project_kind,
  path_title    text,
  completed_on  text,
  published_at  timestamptz,
  mentor_name   text,
  reviewed_on   text,
  rating        numeric,
  is_verified   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.entry_code,
         e.snapshot ->> 'project_title',
         e.snapshot ->> 'project_code',
         coalesce(e.snapshot #>> '{team,title}', e.snapshot #>> '{creator,full_name}'),
         (e.snapshot -> 'team') is not null and (e.snapshot -> 'team') <> 'null'::jsonb,
         (e.snapshot ->> 'kind')::public.project_kind,
         e.snapshot #>> '{path,title}',
         e.snapshot ->> 'completed_on',
         e.published_at,
         e.snapshot #>> '{evaluation,mentor_name}',
         e.snapshot #>> '{evaluation,reviewed_on}',
         (e.snapshot #>> '{evaluation,rating}')::numeric,
         true
    from public.exhibition_entries e
   where upper(e.entry_code) = upper(trim(p_code))
     and e.status = 'exhibited'
     and e.snapshot is not null;
$$;

comment on function public.verify_exhibition_entry is
  'What a QR scan answers: the project, who built it, the mentor who judged it and what they gave it. Exhibited entries only, and nothing about the account behind the work.';

-- ---------------------------------------------------------------------------
-- The public road: versions and decisions, never the feedback
-- ---------------------------------------------------------------------------
create or replace function public.exhibition_entry_history(p_code text)
returns table (
  version    integer,
  decision   public.exhibition_decision,
  rating     numeric,
  reviewed_on timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.version, r.decision, public.exhibition_review_rating(r.id), r.created_at
    from public.exhibition_reviews r
    join public.exhibition_entries e on e.id = r.entry_id
   where upper(e.entry_code) = upper(trim(p_code))
     and e.status = 'exhibited'
   order by r.created_at;
$$;

comment on function public.exhibition_entry_history is
  'How many versions the work went through and what each review decided. The written feedback is deliberately not here — it was addressed to the builders.';

-- ---------------------------------------------------------------------------
-- Featured: a bar, not a ranking
-- ---------------------------------------------------------------------------
-- The conditions are the document's own: approved by a mentor, judged on every
-- criterion, rated at least 4.5, documented, and carrying evidence somebody can
-- open. Everything that clears the bar is featured; nothing is numbered.
create or replace function public.exhibition_featured(p_limit integer default 3)
returns table (entry_code text, published_at timestamptz, snapshot jsonb)
language sql
stable
set search_path = ''
as $$
  select e.entry_code, e.published_at, e.snapshot
    from public.exhibition_entries e
   where e.status = 'exhibited'
     and e.snapshot is not null
     and (e.snapshot #>> '{evaluation,rating}')::numeric >= 4.5
     and (select count(*) from jsonb_object_keys(e.snapshot #> '{evaluation,criteria}')) = 6
     and jsonb_array_length(coalesce(e.snapshot -> 'outcomes', '[]'::jsonb)) > 0
     and jsonb_array_length(coalesce(e.snapshot -> 'evidence', '[]'::jsonb)) > 0
   order by e.published_at desc
   limit greatest(1, least(coalesce(p_limit, 3), 12));
$$;

comment on function public.exhibition_featured is
  'Projects that clear a stated bar: a full rubric, 4.5 or better, an outcome list and evidence. Newest first — a wall is not a leaderboard.';

grant execute on function public.verify_exhibition_entry(text)    to anon, authenticated;
grant execute on function public.exhibition_entry_history(text)   to anon, authenticated;
grant execute on function public.exhibition_featured(integer)     to anon, authenticated;
