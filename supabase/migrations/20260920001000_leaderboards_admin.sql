-- =============================================================================
-- TechMood — 0010 Leaderboards, admin review queue, audit log
--
-- Every standing below is a deterministic function of recorded facts. Nothing
-- here is random, so a refresh never reshuffles the table and the numbers can be
-- explained to the person they rank.
-- =============================================================================

-- Students: progress (XP) carries the ranking, quality (stars) breaks ties.
create or replace view public.leaderboard_students
with (security_invoker = true) as
  select p.id as profile_id,
         p.techmood_id,
         p.full_name,
         coalesce(x.total_xp, 0) as total_xp,
         coalesce(s.stars_avg, 0) as stars_avg,
         (select count(*) from public.certificates c
           where c.profile_id = p.id and c.status = 'active' and c.kind = 'course') as course_certificates,
         (select count(*) from public.certificates c
           where c.profile_id = p.id and c.status = 'active' and c.kind = 'path') as path_certificates
  from public.profiles p
  join public.profile_roles pr
    on pr.profile_id = p.id and pr.role = 'student' and pr.status = 'approved'
  left join public.profile_xp x on x.profile_id = p.id
  left join public.profile_stars s on s.profile_id = p.id
  where p.is_public;

create or replace view public.leaderboard_mentors
with (security_invoker = true) as
  select mp.profile_id,
         p.full_name,
         mp.level,
         mp.sessions_count,
         coalesce(mp.rating_avg, 0) as rating_avg,
         (select count(*) from public.evaluations e where e.evaluator_id = mp.profile_id) as evaluations_given
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.profile_id
  where p.is_public;

create or replace view public.leaderboard_teams
with (security_invoker = true) as
  select t.id as team_id,
         t.title_ar,
         (select count(*) from public.team_members tm where tm.team_id = t.id) as members_count,
         (select count(*) from public.projects pr
           where pr.team_id = t.id and pr.status = 'completed') as projects_completed,
         coalesce((select round(avg(r.stars)::numeric, 2) from public.team_reviews r where r.team_id = t.id), 0) as rating_avg
  from public.teams t;

create or replace view public.leaderboard_startups
with (security_invoker = true) as
  select s.id as startup_id,
         s.name_ar,
         s.stage,
         s.users_count,
         p.full_name as founder_name,
         case s.stage
           when 'idea'           then 1
           when 'validation'     then 2
           when 'mvp'            then 3
           when 'users'          then 4
           when 'business_model' then 5
           when 'startup'        then 6
         end as stage_rank
  from public.startups s
  join public.profiles p on p.id = s.founder_id;

-- ---------------------------------------------------------------------------
-- Admin review queue — one list of everything waiting on a human decision.
-- ---------------------------------------------------------------------------
create or replace view public.admin_review_queue
with (security_invoker = true) as
      select 'role_application'  as item_kind,
             pr.id               as item_id,
             p.full_name         as subject,
             pr.role::text       as detail,
             pr.created_at
      from public.profile_roles pr
      join public.profiles p on p.id = pr.profile_id
      where pr.status = 'pending_review'
  union all
      select 'submission',
             s.id,
             p.full_name,
             a.title_ar,
             s.updated_at
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.profiles p on p.id = s.profile_id
      where s.status in ('submitted', 'under_review')
  union all
      select 'payment',
             pay.id,
             coalesce(p.full_name, t.title_ar),
             pay.method::text || ' · $' || pay.amount_usd::text,
             pay.submitted_at
      from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      left join public.profiles p on p.id = b.student_id
      left join public.teams t on t.id = b.team_id
      where pay.status = 'submitted'
  union all
      select 'incubator_application',
             ia.id,
             s.name_ar,
             s.stage::text,
             ia.created_at
      from public.incubator_applications ia
      join public.startups s on s.id = ia.startup_id
      where ia.status = 'pending_review'
  union all
      select 'reevaluation_request',
             rr.id,
             p.full_name,
             rr.reason_ar,
             rr.created_at
      from public.reevaluation_requests rr
      join public.profiles p on p.id = rr.requested_by
      where rr.status = 'open';

comment on view public.admin_review_queue is
  'Everything that the manual-verification MVP depends on a human to clear.';

-- ---------------------------------------------------------------------------
-- Audit log — who did what, to which row, and what changed
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id           uuid primary key default extensions.gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  entity_table text not null,
  entity_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz not null default now()
);

create index admin_audit_log_entity_idx on public.admin_audit_log (entity_table, entity_id, created_at desc);
create index admin_audit_log_actor_idx  on public.admin_audit_log (actor_id, created_at desc);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')::uuid else (to_jsonb(new) ->> 'id')::uuid end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- The money and the gatekeeping decisions are the ones worth an audit trail.
create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.write_audit_log();

create trigger bookings_audit
  after update on public.bookings
  for each row execute function public.write_audit_log();

create trigger profile_roles_audit
  after insert or update or delete on public.profile_roles
  for each row execute function public.write_audit_log();

create trigger certificates_audit
  after insert or update or delete on public.certificates
  for each row execute function public.write_audit_log();
