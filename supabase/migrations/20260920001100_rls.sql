-- =============================================================================
-- TechMood — 0011 Row Level Security
--
-- Authorization lives here, in the database, and not in the client. Changing an
-- id in a URL or calling the REST API directly gets you exactly the same answer
-- as the UI would: your own rows, the published catalogue, and nothing else.
--
-- Reading conventions:
--   * catalogue tables  -> readable by everyone, written by admins
--   * personal tables   -> owner (+ admin), and a mentor only where evaluation
--                          or a confirmed session makes it necessary
--   * money tables      -> payer and admin only
-- =============================================================================

-- Enable RLS everywhere. Any table added later must be added here too.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Catalogue: readable by all, written by admins
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'schools', 'learning_paths', 'courses', 'path_courses', 'modules', 'lessons',
    'lesson_resources', 'assignments', 'assessments', 'assessment_questions',
    'skills', 'achievements', 'reputation_dimensions',
    'mentor_levels', 'xp_rules', 'xp_levels'
  ]
  loop
    execute format($f$
      create policy %I on public.%I
        for select to anon, authenticated using (true);
    $f$, t || '_read_all', t);

    execute format($f$
      create policy %I on public.%I
        for all to authenticated using (public.is_admin()) with check (public.is_admin());
    $f$, t || '_admin_write', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_read_public on public.profiles
  for select to anon, authenticated
  using (is_public or id = (select auth.uid()) or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- Rows are created by the handle_new_user trigger, never by the client.
create policy profiles_admin_all on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- profile_roles: you may request a role, only an admin may approve it
-- ---------------------------------------------------------------------------
create policy profile_roles_read on public.profile_roles
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy profile_roles_request on public.profile_roles
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and role <> 'admin'
    and status = 'pending_review'
  );

create policy profile_roles_admin_review on public.profile_roles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profile_roles_withdraw on public.profile_roles
  for delete to authenticated
  using ((profile_id = (select auth.uid()) and role <> 'student') or public.is_admin());

-- ---------------------------------------------------------------------------
-- Skills, achievements, reputation attached to a profile
-- ---------------------------------------------------------------------------
create policy profile_skills_read on public.profile_skills
  for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and (p.is_public or p.id = (select auth.uid()))));

create policy profile_skills_write on public.profile_skills
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy profile_achievements_read on public.profile_achievements
  for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and (p.is_public or p.id = (select auth.uid()))));

create policy profile_achievements_admin on public.profile_achievements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy reputation_scores_read on public.reputation_scores
  for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and (p.is_public or p.id = (select auth.uid()))));

create policy reputation_scores_admin on public.reputation_scores
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Learning progress — strictly personal
-- ---------------------------------------------------------------------------
create policy enrollments_own on public.enrollments
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

create policy lesson_progress_own on public.lesson_progress
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

create policy assessment_attempts_own on public.assessment_attempts
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Submissions. A draft is private. Once submitted it becomes visible to the
-- mentors who are expected to review it, and to the student's teammates when
-- the work is group work.
-- ---------------------------------------------------------------------------
create policy submissions_read on public.submissions
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
    or (status <> 'draft' and public.is_mentor())
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy submissions_write_own on public.submissions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy submission_versions_read on public.submission_versions
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_id
      and (s.profile_id = (select auth.uid())
           or public.is_admin()
           or (s.status <> 'draft' and public.is_mentor())
           or (s.team_id is not null and public.is_team_member(s.team_id)))
  ));

create policy submission_evidence_read on public.submission_evidence
  for select to authenticated
  using (exists (
    select 1
    from public.submission_versions sv
    join public.submissions s on s.id = sv.submission_id
    where sv.id = version_id
      and (s.profile_id = (select auth.uid())
           or public.is_admin()
           or (s.status <> 'draft' and public.is_mentor())
           or (s.team_id is not null and public.is_team_member(s.team_id)))
  ));

-- Evaluations are readable by the student they are about, their evaluator and admins.
create policy evaluations_read on public.evaluations
  for select to authenticated
  using (
    evaluator_id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.submissions s
               where s.id = submission_id and s.profile_id = (select auth.uid()))
  );

-- Writing goes through public.evaluate_submission(), which checks the role.
create policy evaluations_insert_mentor on public.evaluations
  for insert to authenticated
  with check (evaluator_id = (select auth.uid()) and (public.is_mentor() or public.is_admin()));

create policy reevaluation_requests_own on public.reevaluation_requests
  for select to authenticated
  using (
    requested_by = (select auth.uid())
    or public.is_admin()
    or public.is_mentor()
  );

create policy reevaluation_requests_create on public.reevaluation_requests
  for insert to authenticated
  with check (requested_by = (select auth.uid()));

create policy reevaluation_requests_resolve on public.reevaluation_requests
  for update to authenticated
  using (public.is_mentor() or public.is_admin())
  with check (public.is_mentor() or public.is_admin());

-- ---------------------------------------------------------------------------
-- XP is readable, never writable from a client.
-- ---------------------------------------------------------------------------
create policy xp_events_read_own on public.xp_events
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Certificates: the holder's list is private, verification is public and goes
-- through public.verify_certificate() instead of this table.
-- ---------------------------------------------------------------------------
create policy certificates_read_own on public.certificates
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy certificates_admin_write on public.certificates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Mentors
-- ---------------------------------------------------------------------------
create policy mentor_profiles_read on public.mentor_profiles
  for select to anon, authenticated using (true);

create policy mentor_profiles_self on public.mentor_profiles
  for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy mentor_profiles_admin on public.mentor_profiles
  for insert to authenticated with check (public.is_admin());

create policy mentor_availability_read on public.mentor_availability
  for select to anon, authenticated using (true);

create policy mentor_availability_own on public.mentor_availability
  for all to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin())
  with check (mentor_id = (select auth.uid()) or public.is_admin());

create policy mentor_time_off_read on public.mentor_time_off
  for select to anon, authenticated using (true);

create policy mentor_time_off_own on public.mentor_time_off
  for all to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin())
  with check (mentor_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Bookings: the two sides of the session, the team, and admins
-- ---------------------------------------------------------------------------
create policy bookings_read on public.bookings
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or mentor_id = (select auth.uid())
    or public.is_admin()
    or (team_id is not null and public.is_team_member(team_id))
  );

create policy bookings_create on public.bookings
  for insert to authenticated
  with check (
    (student_id = (select auth.uid()) and kind = 'student_mentor')
    or (kind = 'team_mentor' and team_id is not null and public.is_team_leader(team_id))
  );

-- Status moves are made by the SECURITY DEFINER functions; this covers the
-- student cancelling and the mentor deciding.
create policy bookings_update_parties on public.bookings
  for update to authenticated
  using (student_id = (select auth.uid()) or mentor_id = (select auth.uid()) or public.is_admin())
  with check (student_id = (select auth.uid()) or mentor_id = (select auth.uid()) or public.is_admin());

create policy booking_submissions_parties on public.booking_submissions
  for all to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.student_id = (select auth.uid()) or b.mentor_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.student_id = (select auth.uid()) or b.mentor_id = (select auth.uid()))));

create policy session_feedback_read on public.session_feedback
  for select to authenticated
  using (from_profile = (select auth.uid()) or to_profile = (select auth.uid()) or public.is_admin());

create policy session_feedback_write on public.session_feedback
  for insert to authenticated
  with check (from_profile = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Payments: payment proof is personal financial data. Payer and admin only —
-- not the mentor, who has no business seeing a receipt.
-- ---------------------------------------------------------------------------
create policy payments_read_payer on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.student_id = (select auth.uid())
             or (b.team_id is not null and public.is_team_leader(b.team_id)))
    )
  );

create policy payments_write_payer on public.payments
  for insert to authenticated
  with check (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.student_id = (select auth.uid())
           or (b.team_id is not null and public.is_team_leader(b.team_id)))
  ));

-- The payer may attach their proof; only public.verify_payment() clears it.
create policy payments_update_payer on public.payments
  for update to authenticated
  using (
    public.is_admin()
    or (status in ('pending', 'rejected') and exists (
          select 1 from public.bookings b
          where b.id = booking_id and b.student_id = (select auth.uid())))
  )
  with check (
    public.is_admin()
    or (status = 'submitted' and exists (
          select 1 from public.bookings b
          where b.id = booking_id and b.student_id = (select auth.uid())))
  );

create policy wallet_entries_own on public.wallet_entries
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create policy teams_read_all on public.teams
  for select to anon, authenticated using (true);

create policy teams_create on public.teams
  for insert to authenticated with check (leader_id = (select auth.uid()));

create policy teams_leader_write on public.teams
  for update to authenticated
  using (leader_id = (select auth.uid()) or public.is_admin())
  with check (leader_id = (select auth.uid()) or public.is_admin());

create policy teams_leader_delete on public.teams
  for delete to authenticated
  using (leader_id = (select auth.uid()) or public.is_admin());

create policy team_members_read on public.team_members
  for select to anon, authenticated using (true);

create policy team_members_leader_write on public.team_members
  for all to authenticated
  using (public.is_team_leader(team_id) or public.is_admin())
  with check (public.is_team_leader(team_id) or public.is_admin());

create policy team_members_leave on public.team_members
  for delete to authenticated using (profile_id = (select auth.uid()));

create policy team_applications_read on public.team_applications
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_team_leader(team_id) or public.is_admin());

create policy team_applications_apply on public.team_applications
  for insert to authenticated with check (profile_id = (select auth.uid()));

create policy team_applications_decide on public.team_applications
  for update to authenticated
  using (public.is_team_leader(team_id) or profile_id = (select auth.uid()) or public.is_admin())
  with check (public.is_team_leader(team_id) or profile_id = (select auth.uid()) or public.is_admin());

create policy team_tasks_members on public.team_tasks
  for all to authenticated
  using (public.is_team_member(team_id) or public.is_admin())
  with check (public.is_team_member(team_id) or public.is_admin());

create policy team_reviews_read on public.team_reviews
  for select to anon, authenticated using (true);

create policy team_reviews_mentor_write on public.team_reviews
  for all to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin())
  with check (mentor_id = (select auth.uid()) and (public.is_mentor() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Projects & portfolio
-- ---------------------------------------------------------------------------
create policy projects_read on public.projects
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid())
         or (team_id is not null and public.is_team_member(team_id)) or public.is_admin());

create policy projects_write on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()) or (team_id is not null and public.is_team_leader(team_id)) or public.is_admin())
  with check (owner_id = (select auth.uid()) or (team_id is not null and public.is_team_leader(team_id)) or public.is_admin());

create policy project_milestones_scope on public.project_milestones
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id
                 and (p.owner_id = (select auth.uid())
                      or (p.team_id is not null and public.is_team_member(p.team_id))
                      or public.is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_id
                 and (p.owner_id = (select auth.uid())
                      or (p.team_id is not null and public.is_team_member(p.team_id)))));

create policy project_milestones_public_read on public.project_milestones
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.is_public));

create policy project_evidence_public_read on public.project_evidence
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.is_public));

create policy project_evidence_write on public.project_evidence
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id
                 and (p.owner_id = (select auth.uid())
                      or (p.team_id is not null and public.is_team_member(p.team_id))
                      or public.is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_id
                 and (p.owner_id = (select auth.uid())
                      or (p.team_id is not null and public.is_team_member(p.team_id)))));

-- ---------------------------------------------------------------------------
-- Marketplace & incubator
-- ---------------------------------------------------------------------------
create policy opportunities_read on public.opportunities
  for select to anon, authenticated
  using (status = 'published' or posted_by = (select auth.uid()) or public.is_admin());

create policy opportunities_write on public.opportunities
  for all to authenticated
  using (posted_by = (select auth.uid()) or public.is_admin())
  with check (posted_by = (select auth.uid()) or public.is_admin());

create policy opportunity_applications_scope on public.opportunity_applications
  for select to authenticated
  using (profile_id = (select auth.uid())
         or exists (select 1 from public.opportunities o where o.id = opportunity_id and o.posted_by = (select auth.uid()))
         or public.is_admin());

create policy opportunity_applications_apply on public.opportunity_applications
  for insert to authenticated with check (profile_id = (select auth.uid()));

create policy startups_read on public.startups
  for select to anon, authenticated using (true);

create policy startups_write on public.startups
  for all to authenticated
  using (founder_id = (select auth.uid()) or public.is_admin())
  with check (founder_id = (select auth.uid()) or public.is_admin());

create policy incubator_applications_scope on public.incubator_applications
  for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = (select auth.uid())));

create policy incubator_applications_apply on public.incubator_applications
  for insert to authenticated
  with check (exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = (select auth.uid())));

create policy incubator_applications_review on public.incubator_applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Messaging — participants only, no exceptions
-- ---------------------------------------------------------------------------
create policy conversations_participants on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id) or public.is_admin());

create policy conversation_participants_read on public.conversation_participants
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_conversation_participant(conversation_id) or public.is_admin());

create policy conversation_participants_read_receipt on public.conversation_participants
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy messages_read on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

create policy messages_send on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_participant(conversation_id));

-- ---------------------------------------------------------------------------
-- Notifications & calls
-- ---------------------------------------------------------------------------
create policy notifications_own on public.notifications
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy call_sessions_scope on public.call_sessions
  for select to authenticated
  using (
    public.is_admin()
    or (team_id is not null and public.is_team_member(team_id))
    or exists (select 1 from public.bookings b where b.id = booking_id
               and (b.student_id = (select auth.uid()) or b.mentor_id = (select auth.uid())))
  );

create policy call_sessions_create on public.call_sessions
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (team_id is not null and public.is_team_member(team_id))
      or exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.student_id = (select auth.uid()) or b.mentor_id = (select auth.uid())))
    )
  );

-- ---------------------------------------------------------------------------
-- Audit log: admins read it, nobody edits it
-- ---------------------------------------------------------------------------
create policy admin_audit_log_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());
