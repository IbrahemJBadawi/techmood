-- =============================================================================
-- 0087 — The rest of the Control Center: cohorts, AI oversight, knowledge
-- base, analytics, and who is an admin
--
-- Everything here reads rows that already exist, except two new things: the
-- knowledge base's articles, and the rule for when an admin may read a
-- person's private AI conversation.
--
-- **Cohorts, without splitting anybody.** A path is one open community with
-- one conversation (0020); nothing here changes that. A cohort is a lens: the
-- people who started the same path in the same month, and how they are doing.
--
-- **AI oversight respects the person.** A conversation with the assistant is
-- private (0067 lets only its owner read it). The admin sees how the assistant
-- is used — threads, volume, errors, every proposed action and what became of
-- it — but not what anybody said. Reading a conversation's words requires an
-- open case and a written reason; the access is written to the case, the audit
-- log, and a notification to the person whose conversation it is.
--
-- **Admins are made by admins.** Granting or suspending the admin role is an
-- audited action with a reason, and nobody suspends themselves — which also
-- means the platform can never be left without an admin.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cohorts
-- ---------------------------------------------------------------------------
create or replace function public.admin_cohorts(p_months integer default 12)
returns table (
  path_id uuid, path_title_ar text, cohort_month date,
  enrolled integer, active_30d integer, completed integer, completion_pct integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with cohort as (
    select e.path_id, e.profile_id, date_trunc('month', e.enrolled_at)::date as month
      from public.enrollments e
     where e.path_id is not null
       and e.enrolled_at >= date_trunc('month', now()) - make_interval(months => greatest(coalesce(p_months, 12), 1) - 1)
  )
  select c.path_id, lp.title_ar, c.month,
         count(*)::int,
         count(*) filter (where exists (
           select 1 from public.lesson_progress pr
             join public.lessons l on l.id = pr.lesson_id
             join public.modules m on m.id = l.module_id
             join public.path_courses pc on pc.course_id = m.course_id
            where pr.profile_id = c.profile_id and pc.path_id = c.path_id
              and pr.updated_at > now() - interval '30 days'))::int,
         count(*) filter (where public.is_path_complete(c.profile_id, c.path_id))::int,
         round(100.0 * count(*) filter (where public.is_path_complete(c.profile_id, c.path_id)) / count(*))::int
    from cohort c
    join public.learning_paths lp on lp.id = c.path_id
   where public.is_admin()
   group by c.path_id, lp.title_ar, c.month
   order by c.month desc, count(*) desc;
$$;

grant execute on function public.admin_cohorts(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. AI oversight: how it is used, never what was said
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_overview(p_days integer default 30)
returns table (
  threads integer, people integer, messages integer, model_errors integer,
  proposals integer, confirmed integer, declined integer, failed integer, escalations integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (select now() - make_interval(days => greatest(coalesce(p_days, 30), 1)) as t)
  select
    (select count(*)::int from public.ai_threads th, since where th.created_at >= since.t),
    (select count(distinct th.profile_id)::int from public.ai_threads th, since where th.last_message_at >= since.t),
    (select count(*)::int from public.ai_messages m, since where m.created_at >= since.t),
    (select count(*)::int from public.ai_messages m, since where m.created_at >= since.t and m.error_ar is not null),
    (select count(*)::int from public.ai_actions a, since where a.proposed_at >= since.t),
    (select count(*)::int from public.ai_actions a, since where a.proposed_at >= since.t and a.status::text in ('confirmed', 'executed')),
    (select count(*)::int from public.ai_actions a, since where a.proposed_at >= since.t and a.status::text = 'declined'),
    (select count(*)::int from public.ai_actions a, since where a.proposed_at >= since.t and a.status::text = 'failed'),
    (select count(*)::int from public.ticket_events ev, since where ev.created_at >= since.t and ev.kind = 'escalated')
  where public.is_admin();
$$;

grant execute on function public.admin_ai_overview(integer) to authenticated;

-- Threads without their words: whose, where, how long, whether anything broke.
create or replace function public.admin_ai_threads(p_limit integer default 100)
returns table (
  id uuid, profile_id uuid, full_name text, techmood_id text, surface text, scope text,
  messages integer, errors integer, created_at timestamptz, last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select th.id, th.profile_id, p.full_name, p.techmood_id, th.surface::text, th.scope::text,
         (select count(*)::int from public.ai_messages m where m.thread_id = th.id),
         (select count(*)::int from public.ai_messages m where m.thread_id = th.id and m.error_ar is not null),
         th.created_at, th.last_message_at
    from public.ai_threads th
    join public.profiles p on p.id = th.profile_id
   where public.is_admin()
   order by th.last_message_at desc nulls last
   limit least(coalesce(p_limit, 100), 500);
$$;

grant execute on function public.admin_ai_threads(integer) to authenticated;

-- Every action the assistant proposed, and what the person did with it.
create or replace function public.admin_ai_actions(p_status text default null, p_limit integer default 100)
returns table (
  id uuid, profile_id uuid, full_name text, kind text, summary_ar text, status text,
  error_ar text, proposed_at timestamptz, decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.profile_id, p.full_name, a.kind, a.summary_ar, a.status::text, a.error_ar, a.proposed_at, a.decided_at
    from public.ai_actions a
    join public.profiles p on p.id = a.profile_id
   where public.is_admin()
     and (p_status is null or a.status::text = p_status)
   order by a.proposed_at desc
   limit least(coalesce(p_limit, 100), 500);
$$;

grant execute on function public.admin_ai_actions(text, integer) to authenticated;

-- The model's side of the log: which model answered, where, and every error.
create or replace function public.admin_ai_log(p_errors_only boolean default false, p_limit integer default 200)
returns table (at timestamptz, profile_id uuid, surface text, model text, error_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.created_at, th.profile_id, m.surface::text, m.model, m.error_ar
    from public.ai_messages m
    join public.ai_threads th on th.id = m.thread_id
   where public.is_admin()
     and m.role::text = 'assistant'
     and (not coalesce(p_errors_only, false) or m.error_ar is not null)
   order by m.created_at desc
   limit least(coalesce(p_limit, 200), 1000);
$$;

grant execute on function public.admin_ai_log(boolean, integer) to authenticated;

-- Reading the words: only for an open case, with a reason, and never quietly.
create or replace function public.admin_read_ai_thread(p_thread uuid, p_case uuid, p_reason text)
returns table (role text, content text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_case   public.cases%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;

  select th.profile_id into v_owner from public.ai_threads th where th.id = p_thread;
  if v_owner is null then
    raise exception 'المحادثة غير موجودة';
  end if;

  select * into v_case from public.cases c where c.id = p_case;
  if not found or v_case.status in ('decided', 'closed') then
    raise exception 'قراءة محادثة خاصة تحتاج قضية مفتوحة';
  end if;

  if v_reason is null or length(v_reason) < 10 then
    raise exception 'اكتب سبب الاطلاع على المحادثة (عشرة أحرف على الأقل)';
  end if;

  perform public.case_event(p_case, 'ai_thread_read', 'اطّلعت الإدارة على محادثة مساعد خاصة: ' || v_reason,
    jsonb_build_object('thread', p_thread, 'owner', v_owner));
  perform public.audit('ai_thread_read', 'ai_threads', p_thread,
    jsonb_build_object('case', p_case, 'reason', v_reason, 'owner', v_owner));
  perform public.notify(v_owner, 'security', 'اطّلعت إدارة تكمود على إحدى محادثاتك مع المساعد',
    'ضمن مراجعة القضية ' || v_case.code || ': ' || v_reason, '/support', null, null, 'important');

  return query
    select m.role::text, m.content, m.created_at
      from public.ai_messages m
     where m.thread_id = p_thread
     order by m.created_at;
end;
$$;

grant execute on function public.admin_read_ai_thread(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Knowledge base
-- ---------------------------------------------------------------------------
create table public.kb_articles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category    public.ticket_category,
  title_ar    text not null check (length(btrim(title_ar)) between 3 and 200),
  title_en    text,
  body_ar     text not null check (length(btrim(body_ar)) >= 20),
  status      public.content_status not null default 'draft',
  sort_order  integer not null default 0,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index kb_articles_category_idx on public.kb_articles (category, status, sort_order);

alter table public.kb_articles enable row level security;

create policy kb_articles_read on public.kb_articles
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy kb_articles_admin on public.kb_articles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.kb_articles to anon, authenticated;
grant insert, update, delete on public.kb_articles to authenticated;

create or replace function public.touch_kb_article()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger kb_articles_touch
  before insert or update on public.kb_articles
  for each row execute function public.touch_kb_article();

-- ---------------------------------------------------------------------------
-- 4. Analytics
-- ---------------------------------------------------------------------------
create or replace function public.admin_weekly_metrics(p_weeks integer default 12)
returns table (
  week date, signups integer, active_people integer, enrolments integer, certificates integer,
  sessions_completed integer, tickets_opened integer, tickets_resolved integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with weeks as (
    select generate_series(
             date_trunc('week', now()) - make_interval(weeks => least(greatest(coalesce(p_weeks, 12), 1), 52) - 1),
             date_trunc('week', now()), interval '1 week') as w
  )
  select w::date,
    (select count(*)::int from public.profiles p where p.created_at >= w and p.created_at < w + interval '1 week'),
    (select count(distinct x.pid)::int from (
       select m.sender_id as pid, m.created_at as at from public.messages m
       union all select lp.profile_id, lp.updated_at from public.lesson_progress lp
       union all select s.profile_id, s.updated_at from public.submissions s
       union all select b.student_id, b.created_at from public.bookings b
     ) x where x.at >= w and x.at < w + interval '1 week' and x.pid is not null),
    (select count(*)::int from public.enrollments e where e.enrolled_at >= w and e.enrolled_at < w + interval '1 week'),
    (select count(*)::int from public.certificates c where c.issued_at >= w and c.issued_at < w + interval '1 week'),
    (select count(*)::int from public.bookings b where b.completed_at >= w and b.completed_at < w + interval '1 week'),
    (select count(*)::int from public.support_tickets t where t.created_at >= w and t.created_at < w + interval '1 week'),
    (select count(*)::int from public.support_tickets t where t.resolved_at >= w and t.resolved_at < w + interval '1 week')
  from weeks
  where public.is_admin()
  order by w;
$$;

grant execute on function public.admin_weekly_metrics(integer) to authenticated;

create or replace function public.admin_ticket_stats(p_days integer default 90)
returns table (category public.ticket_category, opened integer, escalated integer, resolved integer, avg_hours_to_resolve numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select t.category,
         count(*)::int,
         count(*) filter (where t.needs_human)::int,
         count(*) filter (where t.resolved_at is not null)::int,
         round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 3600) filter (where t.resolved_at is not null), 1)
    from public.support_tickets t
   where public.is_admin()
     and t.created_at > now() - make_interval(days => greatest(coalesce(p_days, 90), 1))
   group by t.category
   order by count(*) desc;
$$;

grant execute on function public.admin_ticket_stats(integer) to authenticated;

create or replace function public.admin_top_paths(p_limit integer default 10)
returns table (path_id uuid, title_ar text, enrolled integer, completed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select lp.id, lp.title_ar,
         count(e.id)::int,
         count(e.id) filter (where public.is_path_complete(e.profile_id, lp.id))::int
    from public.learning_paths lp
    join public.enrollments e on e.path_id = lp.id
   where public.is_admin()
   group by lp.id, lp.title_ar
   order by count(e.id) desc
   limit least(coalesce(p_limit, 10), 50);
$$;

grant execute on function public.admin_top_paths(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admins and permissions
-- ---------------------------------------------------------------------------
create or replace function public.admin_team()
returns table (profile_id uuid, full_name text, techmood_id text, status text, since timestamptz, granted_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.profile_id, p.full_name, p.techmood_id, r.status::text,
         coalesce(r.reviewed_at, r.created_at),
         (select g.full_name from public.profiles g where g.id = r.reviewed_by)
    from public.profile_roles r
    join public.profiles p on p.id = r.profile_id
   where public.is_admin() and r.role = 'admin'
   order by r.status, p.full_name;
$$;

grant execute on function public.admin_team() to authenticated;

create or replace function public.set_admin_role(p_profile uuid, p_grant boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'الصلاحيات للإدارة فقط';
  end if;
  if v_reason is null then
    raise exception 'منح صلاحية الإدارة أو سحبها يحتاج سبباً مكتوباً';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'الحساب غير موجود';
  end if;

  if p_grant then
    insert into public.profile_roles (profile_id, role, status, reviewed_by, reviewed_at, review_note)
    values (p_profile, 'admin', 'approved', v_me, now(), v_reason)
    on conflict (profile_id, role) do update
      set status = 'approved', reviewed_by = v_me, reviewed_at = now(), review_note = v_reason;
    perform public.notify(p_profile, 'role_review', 'مُنحت صلاحية الإدارة في تكمود', v_reason, '/admin', null, null, 'important');
  else
    if p_profile = v_me then
      raise exception 'لا تسحب صلاحية الإدارة من نفسك';
    end if;
    update public.profile_roles
       set status = 'suspended', reviewed_by = v_me, reviewed_at = now(), review_note = v_reason
     where profile_id = p_profile and role = 'admin' and status = 'approved';
    if not found then
      raise exception 'هذا الحساب ليس مديراً';
    end if;
    perform public.notify(p_profile, 'role_review', 'سُحبت صلاحية الإدارة', v_reason, '/home', null, null, 'important');
  end if;

  perform public.audit(case when p_grant then 'admin_grant' else 'admin_revoke' end, 'profiles', p_profile,
    jsonb_build_object('reason', v_reason));
end;
$$;

grant execute on function public.set_admin_role(uuid, boolean, text) to authenticated;

-- The audit log, readable: who, what, on which row, when.
create or replace function public.admin_audit_trail(p_action text default null, p_limit integer default 200)
returns table (at timestamptz, actor_name text, action text, entity_table text, entity_id uuid, detail jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select l.created_at, p.full_name, l.action, l.entity_table, l.entity_id,
         case when l.action like 'case_action:%' or l.action in ('admin_grant', 'admin_revoke', 'ai_thread_read', 'case_open')
              then l.after_data else null end
    from public.admin_audit_log l
    left join public.profiles p on p.id = l.actor_id
   where public.is_admin()
     and (p_action is null or l.action like p_action || '%')
   order by l.created_at desc
   limit least(coalesce(p_limit, 200), 1000);
$$;

grant execute on function public.admin_audit_trail(text, integer) to authenticated;
