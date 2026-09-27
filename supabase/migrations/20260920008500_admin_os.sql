-- =============================================================================
-- 0085 — TechMood Admin OS: what needs attention, what is happening, who is who
--
-- The admin should not have to patrol pages. Three readers, all admin-only and
-- all derived from rows that already exist — nothing here is stored twice:
--
--   admin_overview()        the platform in numbers, and what requires attention
--   admin_event_feed()      everything happening, as one stream of events
--   admin_user_activity()   one person's story across the whole platform,
--                           tied to their TechMood ID
--
-- plus admin_users() to find anybody, and admin_user_summary() for the top of
-- the unified profile.
-- =============================================================================

create or replace function public.admin_overview()
returns table (
  users integer, active_today integer, mentors integer, open_tickets integer,
  pending_payments integer, pending_withdrawals integer, open_reports integer,
  escalations integer, high_priority_reports integer, mentor_applications integer,
  open_cases integer, refunds_owed integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.profiles),
    -- "active" means did something today, counted from what people do
    (select count(distinct x.profile_id)::int from (
       select m.sender_id as profile_id from public.messages m where m.created_at >= current_date
       union select lp.profile_id from public.lesson_progress lp where lp.updated_at >= current_date
       union select s.profile_id from public.submissions s where s.updated_at >= current_date
       union select b.student_id from public.bookings b where b.created_at >= current_date
       union select t.reporter_id from public.support_tickets t where t.created_at >= current_date
       union select a.profile_id from public.ai_threads a where a.last_message_at >= current_date
     ) x where x.profile_id is not null),
    (select count(*)::int from public.profile_roles r where r.role = 'mentor' and r.status = 'approved'),
    (select count(*)::int from public.support_tickets t where t.status not in ('resolved', 'rejected', 'closed')),
    (select count(*)::int from public.payments p where p.status in ('under_review', 'needs_info')),
    (select count(*)::int from public.payout_requests r where r.status::text in ('requested', 'processing')),
    (select count(*)::int from public.support_tickets t
      where t.reported_profile_id is not null and t.status not in ('resolved', 'rejected', 'closed')),
    (select count(*)::int from public.support_tickets t
      where t.needs_human and t.status not in ('resolved', 'rejected', 'closed')),
    (select count(*)::int from public.support_tickets t
      where t.priority in ('high', 'urgent') and t.reported_profile_id is not null
        and t.status not in ('resolved', 'rejected', 'closed')),
    (select count(*)::int from public.profile_roles r where r.role = 'mentor' and r.status = 'pending_review'),
    (select count(*)::int from public.cases c where c.status not in ('decided', 'closed')),
    (select count(*)::int from public.refunds_owed())
  where public.is_admin();
$$;

grant execute on function public.admin_overview() to authenticated;

-- Everything happening on TechMood, as events. `tone` is the spec's colour:
-- red needs a decision about money, orange an application, yellow a complaint,
-- blue an escalation, green something achieved, purple a withdrawal.
create or replace function public.admin_event_feed(p_limit integer default 50)
returns table (at timestamptz, tone text, kind text, title_ar text, link text, profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select p.submitted_at, 'red', 'payment_review',
           'دفعة بانتظار المراجعة ' || coalesce(p.payment_code, '') || ' — ' || p.amount_usd || '$',
           '/admin/payments', coalesce(b.student_id, e.payer_id)
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.escrows e on e.id = p.escrow_id
     where p.status in ('under_review', 'needs_info') and p.submitted_at is not null
    union all
    select r.created_at, 'orange', 'role_application',
           'طلب دور: ' || r.role::text || ' — ' || pr.full_name, '/admin/role-requests', r.profile_id
      from public.profile_roles r join public.profiles pr on pr.id = r.profile_id
     where r.status = 'pending_review'
    union all
    select t.created_at, 'yellow', 'ticket', 'بلاغ جديد ' || t.code || ': ' || t.subject_ar,
           '/admin/support/' || t.id::text, t.reporter_id
      from public.support_tickets t
    union all
    select ev.created_at, 'blue', 'escalation', 'تصعيد ' || t.code || ': ' || coalesce(ev.note_ar, ''),
           '/admin/support/' || t.id::text, t.reporter_id
      from public.ticket_events ev join public.support_tickets t on t.id = ev.ticket_id
     where ev.kind = 'escalated'
    union all
    select c.issued_at, 'green', 'certificate', 'شهادة صدرت ' || c.certificate_code || ' — ' || pr.full_name,
           '/admin/users/' || c.profile_id::text, c.profile_id
      from public.certificates c join public.profiles pr on pr.id = c.profile_id
    union all
    select r.created_at, 'purple', 'withdrawal', 'طلب سحب ' || r.request_code || ' — ' || r.amount_usd || '$',
           '/admin/payouts', r.profile_id
      from public.payout_requests r
  ) feed (at, tone, kind, title_ar, link, profile_id)
  where public.is_admin()
  order by at desc
  limit least(coalesce(p_limit, 50), 200);
$$;

grant execute on function public.admin_event_feed(integer) to authenticated;

create or replace function public.admin_users(p_role public.user_role default null, p_query text default null, p_limit integer default 100)
returns table (
  id uuid, techmood_id text, full_name text, username text, roles text[],
  restricted boolean, open_reports integer, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.techmood_id, p.full_name, p.username,
         coalesce((select array_agg(r.role::text order by r.role) from public.profile_roles r
                    where r.profile_id = p.id and r.status = 'approved'), '{}'),
         exists (select 1 from public.user_restrictions ur
                  where ur.profile_id = p.id and ur.lifted_at is null
                    and (ur.ends_at is null or ur.ends_at > now())),
         (select count(*)::int from public.support_tickets t
           where t.reported_profile_id = p.id and t.status not in ('resolved', 'rejected', 'closed')),
         p.created_at
    from public.profiles p
   where public.is_admin()
     and (p_role is null or exists (select 1 from public.profile_roles r
                                     where r.profile_id = p.id and r.role = p_role and r.status = 'approved'))
     and (nullif(btrim(coalesce(p_query, '')), '') is null
          or p.full_name ilike '%' || btrim(p_query) || '%'
          or p.techmood_id ilike '%' || btrim(p_query) || '%'
          or p.username ilike '%' || btrim(p_query) || '%')
   order by p.created_at desc
   limit least(coalesce(p_limit, 100), 500);
$$;

grant execute on function public.admin_users(public.user_role, text, integer) to authenticated;

create or replace function public.admin_user_summary(p_profile uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'roles', coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'status', r.status) order by r.role)
                         from public.profile_roles r where r.profile_id = p_profile), '[]'::jsonb),
    'xp', (select coalesce(sum(x.xp), 0) from public.xp_events x where x.profile_id = p_profile),
    'stars', (select s.stars_avg from public.profile_stars s where s.profile_id = p_profile),
    'wallet_available', (select w.available_usd from public.wallet_balance w where w.profile_id = p_profile),
    'wallet_pending', (select w.pending_usd from public.wallet_balance w where w.profile_id = p_profile),
    'enrolments', (select count(*) from public.enrollments e where e.profile_id = p_profile),
    'certificates', (select count(*) from public.certificates c where c.profile_id = p_profile and c.status = 'active'),
    'bookings', (select count(*) from public.bookings b where b.student_id = p_profile),
    'sessions_as_mentor', (select count(*) from public.bookings b where b.mentor_id = p_profile and b.status = 'completed'),
    'teams', (select count(*) from public.team_members tm where tm.profile_id = p_profile and tm.is_active),
    'projects', (select count(*) from public.projects pr where pr.owner_id = p_profile or pr.client_id = p_profile),
    'tickets_filed', (select count(*) from public.support_tickets t where t.reporter_id = p_profile),
    'reports_about', (select count(*) from public.support_tickets t where t.reported_profile_id = p_profile),
    'warnings', (select count(*) from public.user_warnings w where w.profile_id = p_profile),
    'active_restrictions', coalesce((select jsonb_agg(jsonb_build_object(
                              'id', ur.id, 'feature', ur.feature, 'reason', ur.reason_ar, 'ends_at', ur.ends_at))
                             from public.user_restrictions ur
                            where ur.profile_id = p_profile and ur.lifted_at is null
                              and (ur.ends_at is null or ur.ends_at > now())), '[]'::jsonb),
    'cases', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title_ar, 'status', c.status))
                         from public.cases c
                        where c.reporter_id = p_profile or c.reported_profile_id = p_profile), '[]'::jsonb)
  ) end;
$$;

grant execute on function public.admin_user_summary(uuid) to authenticated;

-- One person's story, newest first, from every part of the platform.
create or replace function public.admin_user_activity(p_profile uuid, p_limit integer default 100)
returns table (at timestamptz, area text, title_ar text, link text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select t.created_at, 'support', 'أنشأ بلاغاً ' || t.code || ': ' || t.subject_ar, '/admin/support/' || t.id::text
      from public.support_tickets t where t.reporter_id = p_profile
    union all
    select t.created_at, 'reports', 'بُلّغ عنه ' || t.code || ' (' || t.category::text || ')', '/admin/support/' || t.id::text
      from public.support_tickets t where t.reported_profile_id = p_profile
    union all
    select b.created_at, 'mentorship', 'حجز جلسة ' || b.booking_code || ' (' || b.status::text || ')', null
      from public.bookings b where b.student_id = p_profile
    union all
    select b.completed_at, 'mentorship', 'أكمل جلسة ' || b.booking_code, null
      from public.bookings b where (b.student_id = p_profile or b.mentor_id = p_profile) and b.completed_at is not null
    union all
    select p.submitted_at, 'wallet', 'أرسل دفعة ' || coalesce(p.payment_code, '') || ' — ' || p.amount_usd || '$', '/admin/payments'
      from public.payments p join public.bookings b on b.id = p.booking_id
     where b.student_id = p_profile and p.submitted_at is not null
    union all
    select r.created_at, 'wallet', 'طلب سحب ' || r.request_code || ' — ' || r.amount_usd || '$', '/admin/payouts'
      from public.payout_requests r where r.profile_id = p_profile
    union all
    select e.enrolled_at, 'academy', 'التحق بمسار', null
      from public.enrollments e where e.profile_id = p_profile
    union all
    select c.issued_at, 'academy', 'صدرت له شهادة ' || c.certificate_code, null
      from public.certificates c where c.profile_id = p_profile
    union all
    select s.created_at, 'academy', 'سلّم عملاً', null
      from public.submissions s where s.profile_id = p_profile
    union all
    select tm.joined_at, 'teams', 'انضم إلى فريق', null
      from public.team_members tm where tm.profile_id = p_profile
    union all
    select r.created_at, 'roles', 'طلب دور ' || r.role::text || ' (' || r.status::text || ')', '/admin/role-requests'
      from public.profile_roles r where r.profile_id = p_profile
    union all
    select w.created_at, 'moderation', 'تلقى تنبيهاً: ' || w.reason_ar, null
      from public.user_warnings w where w.profile_id = p_profile
    union all
    select ur.created_at, 'moderation', 'قيد على ' || ur.feature::text || ': ' || ur.reason_ar, null
      from public.user_restrictions ur where ur.profile_id = p_profile
    union all
    select sf.created_at, 'reviews', 'تلقى تقييماً ' || sf.stars || '★', null
      from public.session_feedback sf where sf.to_profile = p_profile
  ) a (at, area, title_ar, link)
  where public.is_admin() and at is not null
  order by at desc
  limit least(coalesce(p_limit, 100), 500);
$$;

grant execute on function public.admin_user_activity(uuid, integer) to authenticated;
