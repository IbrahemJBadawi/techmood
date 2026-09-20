-- =============================================================================
-- TechMood — 0013 Privileges
--
-- RLS decides which ROWS you may touch; these grants decide which TABLES and
-- FUNCTIONS you may address at all. Both matter: a SECURITY DEFINER function
-- that anyone may execute is a privilege escalation regardless of RLS, so the
-- internal helpers below are taken away from clients and left to the triggers.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Reads are filtered by RLS, so a blanket select is safe and keeps new tables
-- from silently 404-ing through PostgREST.
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Functions: default deny, then hand back exactly the callable API.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Internal helpers. These are SECURITY DEFINER and perform no authorization of
-- their own because only triggers and other functions call them. A client that
-- could execute award_xp() could mint its own XP; one that could execute
-- notify() could write into anyone's inbox.
--   public.award_xp, public.notify, public.generate_techmood_id,
--   public.generate_certificate_code, public.write_audit_log
-- are intentionally left with no grant at all.

-- Read-only helpers used by the app to render the UI.
grant execute on function public.current_profile_id()                      to authenticated;
grant execute on function public.has_role(public.user_role)                to authenticated;
grant execute on function public.is_admin()                                to authenticated;
grant execute on function public.is_mentor()                               to authenticated;
grant execute on function public.is_team_member(uuid)                      to authenticated;
grant execute on function public.is_team_leader(uuid)                      to authenticated;
grant execute on function public.is_conversation_participant(uuid)         to authenticated;
grant execute on function public.course_lessons_completed(uuid, uuid)      to authenticated;
grant execute on function public.course_work_approved(uuid, uuid)          to authenticated;
grant execute on function public.course_assessments_passed(uuid, uuid)     to authenticated;
grant execute on function public.is_course_complete(uuid, uuid)            to authenticated;
grant execute on function public.is_path_complete(uuid, uuid)              to authenticated;
grant execute on function public.mentor_eligible_level(uuid)               to authenticated;

-- Write actions. Each one authorizes its own caller internally.
grant execute on function public.submit_work(uuid, jsonb, text)                                        to authenticated;
grant execute on function public.evaluate_submission(uuid, public.evaluation_decision, smallint, text, smallint) to authenticated;
grant execute on function public.issue_certificate(public.certificate_kind, uuid)                      to authenticated;
grant execute on function public.revoke_certificate(text, text)                                        to authenticated;
grant execute on function public.verify_payment(uuid, boolean, text)                                   to authenticated;
grant execute on function public.mentor_decide_booking(uuid, boolean, text)                            to authenticated;
grant execute on function public.decide_team_application(uuid, boolean)                                to authenticated;
grant execute on function public.set_mentor_level(uuid, public.mentor_level)                           to authenticated;

-- The one public endpoint: anyone holding a certificate code may check it.
grant execute on function public.verify_certificate(text) to anon, authenticated;
