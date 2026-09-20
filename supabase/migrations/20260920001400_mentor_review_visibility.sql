-- =============================================================================
-- TechMood — 0014 Mentor review visibility
--
-- The original evaluations_read policy let a mentor read only their OWN
-- evaluations. That breaks the re-evaluation workflow: when a student contests
-- a score and a second mentor picks the work up, that mentor could not see what
-- the first one asked for, and would review the resubmission blind.
--
-- The rule the product needs is: if you are allowed to review the submission,
-- you are allowed to read its full evaluation history. Draft work stays private
-- to its owner either way, because the submission itself is unreadable.
-- =============================================================================

drop policy evaluations_read on public.evaluations;

create policy evaluations_read on public.evaluations
  for select to authenticated
  using (
    evaluator_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (
          -- the student the evaluation is about
          s.profile_id = (select auth.uid())
          -- a mentor who may review this submission
          or (s.status <> 'draft' and public.is_mentor())
          -- teammates on group work see the feedback their team received
          or (s.team_id is not null and public.is_team_member(s.team_id))
        )
    )
  );

-- The review queue is read on every mentor page load; index what it filters on.
create index if not exists submissions_awaiting_review_idx
  on public.submissions (updated_at)
  where status in ('submitted', 'under_review');

create index if not exists evaluations_version_idx
  on public.evaluations (version_id);
