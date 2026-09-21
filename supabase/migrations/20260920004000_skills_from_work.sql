-- =============================================================================
-- 0040 — Skills come from approved work
--
-- profile_skills has carried this comment since 0002:
--
--     -- evidence-backed skills are the ones proven by an approved submission
--
-- and nothing has ever set is_verified. A learner could tick skills in
-- onboarding and the platform had no way to tell a claim from a fact — which
-- is the opposite of what the rest of it does. And the skills table itself was
-- empty: fields and interests were seeded in 0029, skills never were.
--
-- This closes both. A skill is attached to the smallest thing that can teach
-- it — a lesson — and everything above that is derived:
--
--     lesson_skills → course_skills() → path_skills()
--
-- A course's skills are the union of its lessons'; a path's are the union of
-- its courses'. Nothing is stored twice, so a lesson that gains a skill gains
-- it for every course and path that carries it, with no second table to update.
--
-- Granting is the mentor's approval and nothing else. When an evaluation lands
-- with decision 'approved', the skills of what was approved are written onto
-- the learner's profile as verified: a lesson assignment grants that lesson's
-- skills, a course task or project grants the course's, a path project grants
-- the path's. A skill the learner had already claimed becomes verified; one
-- they never claimed is added. Nothing is ever taken away by this trigger —
-- approval is a fact about a moment, and un-approving later does not unlearn.
-- =============================================================================

create table public.lesson_skills (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  skill_id  uuid not null references public.skills (id) on delete cascade,

  primary key (lesson_id, skill_id)
);

create index lesson_skills_skill_idx on public.lesson_skills (skill_id);

alter table public.lesson_skills enable row level security;

create policy lesson_skills_read_all on public.lesson_skills
  for select to anon, authenticated using (true);

create policy lesson_skills_admin_write on public.lesson_skills
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.lesson_skills to anon, authenticated;
grant insert, update, delete on public.lesson_skills to authenticated;

comment on table public.lesson_skills is
  'The one place a skill is attached to content. Course and path skills are derived from it, never stored again.';

-- ---------------------------------------------------------------------------
-- The rollups
-- ---------------------------------------------------------------------------
create or replace function public.course_skills(p_course uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
set search_path = ''
as $$
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from public.lesson_skills ls
    join public.lessons l on l.id = ls.lesson_id
    join public.modules m on m.id = l.module_id
    join public.skills s  on s.id = ls.skill_id
   where m.course_id = p_course and s.status = 'approved'
   order by s.name_ar;
$$;

create or replace function public.path_skills(p_path uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
set search_path = ''
as $$
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from public.path_courses pc
    join public.modules m on m.course_id = pc.course_id
    join public.lessons l on l.module_id = m.id
    join public.lesson_skills ls on ls.lesson_id = l.id
    join public.skills s on s.id = ls.skill_id
   where pc.path_id = p_path and s.status = 'approved'
   order by s.name_ar;
$$;

comment on function public.course_skills is
  'What a course teaches: the union of its lessons'' skills. Derived, so it cannot drift from them.';

grant execute on function public.course_skills(uuid) to anon, authenticated;
grant execute on function public.path_skills(uuid)   to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Approval is what writes a skill onto a profile
-- ---------------------------------------------------------------------------
-- The skills of whatever was approved, for one submission. Kept separate from
-- the trigger so the same answer can be shown to a learner before they submit:
-- "this is what finishing it proves".
create or replace function public.submission_skills(p_submission uuid)
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select a.kind, a.lesson_id, a.course_id, a.path_id,
           (select m.course_id from public.modules m
              join public.lessons l on l.module_id = m.id
             where l.id = a.lesson_id) as lesson_course
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
     where s.id = p_submission
  )
  select distinct s.id, s.slug, s.name_ar, s.name_en
    from target t
    join public.lesson_skills ls
      on (t.kind = 'lesson_assignment' and ls.lesson_id = t.lesson_id)
      or (t.kind in ('course_task', 'course_project') and ls.lesson_id in (
            select l.id from public.lessons l
              join public.modules m on m.id = l.module_id
             where m.course_id = t.course_id))
      or (t.kind = 'path_project' and ls.lesson_id in (
            select l.id from public.lessons l
              join public.modules m on m.id = l.module_id
              join public.path_courses pc on pc.course_id = m.course_id
             where pc.path_id = t.path_id))
    join public.skills s on s.id = ls.skill_id
   where s.status = 'approved'
   order by s.name_ar;
$$;

grant execute on function public.submission_skills(uuid) to authenticated;

create or replace function public.on_evaluation_grant_skills()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.decision <> 'approved' then
    return new;
  end if;

  select s.profile_id into v_owner
    from public.submissions s where s.id = new.submission_id;

  -- The owner of the submission, the same person the XP goes to. Group work is
  -- submitted by one member on the team's behalf; crediting every member with
  -- every skill from one approval would make the record say more than the work
  -- does, so it follows the XP rule rather than inventing a second one.
  insert into public.profile_skills (profile_id, skill_id, is_verified)
  select v_owner, sk.id, true
    from public.submission_skills(new.submission_id) sk
  on conflict (profile_id, skill_id) do update set is_verified = true;

  return new;
end;
$$;

create trigger evaluations_grant_skills
  after insert on public.evaluations
  for each row execute function public.on_evaluation_grant_skills();

-- Work approved before this migration has already been judged; the record
-- should say so rather than starting the count from today.
do $$
declare
  r record;
begin
  for r in
    select distinct s.id as submission_id, s.profile_id
      from public.submissions s
     where s.status = 'approved'
  loop
    insert into public.profile_skills (profile_id, skill_id, is_verified)
    select r.profile_id, sk.id from public.submission_skills(r.submission_id) sk
    on conflict (profile_id, skill_id) do update set is_verified = true;
  end loop;
end
$$;

-- What a learner can show: the skills an approved piece of work proved.
create or replace function public.profile_verified_skills(p_profile uuid)
returns table (slug text, name_ar text, name_en text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.slug, s.name_ar, s.name_en
    from public.profile_skills ps
    join public.skills s on s.id = ps.skill_id
    join public.profiles p on p.id = ps.profile_id
   where ps.profile_id = p_profile
     and ps.is_verified
     and s.status = 'approved'
     and (p.is_public or p.id = (select auth.uid()) or public.is_admin())
   order by s.name_ar;
$$;

comment on function public.profile_verified_skills is
  'The skills somebody has proven, for their public record. It respects the profile''s own privacy flag, so a private profile answers with nothing.';

grant execute on function public.profile_verified_skills(uuid) to anon, authenticated;
