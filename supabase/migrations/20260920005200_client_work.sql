-- =============================================================================
-- 0052 — The client can see the work they are paying for
--
-- 0050 made an accepted application open a project: private, owned by the
-- person doing the work, with the client recorded on it. And then the client
-- could not read it. `projects_read` predates client work entirely — it knows
-- an owner, a team and the public, and a private project owned by somebody
-- else is invisible to everyone but an admin.
--
-- That is not a small gap: the whole point of opening the workspace is that
-- both sides can see the work. So the client joins the people a project is
-- readable by — reading only, since the work belongs to whoever is doing it.
-- =============================================================================

drop policy projects_read on public.projects;

create policy projects_read on public.projects
  for select to anon, authenticated
  using (
    is_public
    or owner_id = (select auth.uid())
    or client_id = (select auth.uid())
    or (team_id is not null and public.is_team_member(team_id))
    or public.is_admin()
  );

-- The dates and the evidence come with it: a client who can see the work can
-- see when it is due and what has been handed over, and change neither.
create policy project_milestones_client_read on public.project_milestones
  for select to authenticated
  using (exists (
    select 1 from public.projects p
     where p.id = project_id and p.client_id = (select auth.uid())
  ));

create policy project_evidence_client_read on public.project_evidence
  for select to authenticated
  using (exists (
    select 1 from public.projects p
     where p.id = project_id and p.client_id = (select auth.uid())
  ));
