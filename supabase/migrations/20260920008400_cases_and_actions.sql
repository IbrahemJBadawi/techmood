-- =============================================================================
-- 0084 — Cases, admin actions, and restrictions that actually restrict
--
-- A ticket is what a person reported. A case is what the administration
-- investigates: one or more tickets, the people involved, the operations
-- (payment, booking, session, escrow, message), evidence, notes, a timeline,
-- a decision and the actions taken.
--
-- The actions the spec lists are functions here, and each one is written down
-- three times: as a case event (the case's own story), in admin_audit_log (who
-- did what to which row), and — when it touches a person — as a notification
-- to them if the admin chose to tell them. Sensitive actions refuse to run
-- without a reason, and the ones that take something away also need a
-- duration and evidence on the case.
--
-- A restriction is only real if the platform enforces it. So "restrict
-- feature" and "suspend account" are checked by triggers on the rows they
-- stop — a booking, a message, an application, a withdrawal, a rating — not by
-- a flag a page may or may not read. A suspended person can still open a
-- support ticket and write to the administration: an appeal is never blocked.
--
-- AI assists and never decides: an admin may store an AI summary and a
-- suggested next step on a case or ticket; nothing reads them to act.
-- =============================================================================

create sequence public.case_seq start 1001;

create table public.cases (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default ('CM-' || nextval('public.case_seq')::text),
  title_ar            text not null check (length(btrim(title_ar)) between 3 and 200),
  status              public.case_status not null default 'open',
  priority            public.ticket_priority not null default 'medium',
  reporter_id         uuid references public.profiles (id) on delete set null,
  reported_profile_id uuid references public.profiles (id) on delete set null,
  decision_ar         text,
  decided_by          uuid references public.profiles (id) on delete set null,
  decided_at          timestamptz,
  ai_summary_ar       text,
  ai_next_step_ar     text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index cases_status_idx on public.cases (status, priority, updated_at desc);

alter table public.support_tickets
  add constraint support_tickets_case_fk foreign key (case_id) references public.cases (id) on delete set null;

-- What the case is about: any operation, by type and id.
create table public.case_links (
  case_id     uuid not null references public.cases (id) on delete cascade,
  entity_type text not null check (entity_type in (
                'ticket', 'profile', 'booking', 'payment', 'escrow', 'project',
                'video_session', 'message', 'payout', 'course', 'opportunity', 'team')),
  entity_id   uuid not null,
  note_ar     text,
  added_by    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  primary key (case_id, entity_type, entity_id)
);

create table public.case_notes (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body_ar    text not null check (length(body_ar) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.case_evidence (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  label_ar   text not null,
  -- a file in support-files, or an https link
  path       text,
  url        text check (url is null or url ~* '^https://'),
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  check ((path is null) <> (url is null))
);

create table public.case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  kind       text not null,
  actor_id   uuid references public.profiles (id) on delete set null,
  note_ar    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index case_events_case_idx on public.case_events (case_id, created_at);

create table public.user_warnings (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete set null,
  reason_ar       text not null,
  issued_by       uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create table public.user_restrictions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  feature     public.restricted_feature not null,
  reason_ar   text not null,
  case_id     uuid references public.cases (id) on delete set null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  lifted_at   timestamptz,
  lifted_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  check (ends_at is null or ends_at > starts_at)
);

create index user_restrictions_profile_idx on public.user_restrictions (profile_id, feature);

alter table public.cases             enable row level security;
alter table public.case_links        enable row level security;
alter table public.case_notes        enable row level security;
alter table public.case_evidence     enable row level security;
alter table public.case_events       enable row level security;
alter table public.user_warnings     enable row level security;
alter table public.user_restrictions enable row level security;

create policy cases_admin         on public.cases         for select to authenticated using (public.is_admin());
create policy case_links_admin    on public.case_links    for select to authenticated using (public.is_admin());
create policy case_notes_admin    on public.case_notes    for select to authenticated using (public.is_admin());
create policy case_evidence_admin on public.case_evidence for select to authenticated using (public.is_admin());
create policy case_events_admin   on public.case_events   for select to authenticated using (public.is_admin());

-- A person always knows what was decided about them.
create policy user_warnings_read on public.user_warnings
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
create policy user_restrictions_read on public.user_restrictions
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.cases, public.case_links, public.case_notes, public.case_evidence,
  public.case_events, public.user_warnings, public.user_restrictions from anon, authenticated;
grant select on public.cases, public.case_links, public.case_notes, public.case_evidence,
  public.case_events, public.user_warnings, public.user_restrictions to authenticated;

-- ---------------------------------------------------------------------------
-- Is a restriction in force?
-- ---------------------------------------------------------------------------
create or replace function public.is_restricted(p_profile uuid, p_feature public.restricted_feature)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_restrictions r
     where r.profile_id = p_profile
       and (r.feature = p_feature or r.feature = 'everything')
       and r.lifted_at is null
       and r.starts_at <= now()
       and (r.ends_at is null or r.ends_at > now())
  );
$$;

grant execute on function public.is_restricted(uuid, public.restricted_feature) to authenticated;

create or replace function public.my_restrictions()
returns table (feature public.restricted_feature, reason_ar text, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.feature, r.reason_ar, r.ends_at
    from public.user_restrictions r
   where r.profile_id = (select auth.uid())
     and r.lifted_at is null and r.starts_at <= now()
     and (r.ends_at is null or r.ends_at > now());
$$;

grant execute on function public.my_restrictions() to authenticated;

-- One trigger function, told which feature the table belongs to. It checks the
-- signed-in person — the one acting — and lets an admin and the platform's own
-- jobs through.
create or replace function public.enforce_restriction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_feature public.restricted_feature := tg_argv[0]::public.restricted_feature;
begin
  if v_me is null or public.is_admin() then
    return new;
  end if;

  -- A conversation with the administration stays open to everyone: that is
  -- where a restricted person asks why.
  if tg_table_name = 'messages' then
    if exists (select 1 from public.conversations c
                where c.id = (to_jsonb(new) ->> 'conversation_id')::uuid and c.kind = 'admin') then
      return new;
    end if;
  end if;

  if public.is_restricted(v_me, v_feature) then
    raise exception 'هذه الميزة موقوفة على حسابك بقرار إداري. راجع «المساعدة والبلاغات» لمعرفة السبب أو الاعتراض';
  end if;

  return new;
end;
$$;

create trigger bookings_restriction          before insert on public.bookings
  for each row execute function public.enforce_restriction('booking');
create trigger messages_restriction          before insert on public.messages
  for each row execute function public.enforce_restriction('messaging');
create trigger applications_restriction      before insert on public.opportunity_applications
  for each row execute function public.enforce_restriction('marketplace');
create trigger opportunities_restriction     before insert on public.opportunities
  for each row execute function public.enforce_restriction('marketplace');
create trigger payouts_restriction           before insert on public.payout_requests
  for each row execute function public.enforce_restriction('withdrawals');
create trigger session_feedback_restriction  before insert on public.session_feedback
  for each row execute function public.enforce_restriction('reviews');
create trigger client_reviews_restriction    before insert on public.client_reviews
  for each row execute function public.enforce_restriction('reviews');
create trigger worker_reviews_restriction    before insert on public.worker_reviews
  for each row execute function public.enforce_restriction('reviews');
create trigger course_feedback_restriction   before insert on public.course_feedback
  for each row execute function public.enforce_restriction('reviews');

-- ---------------------------------------------------------------------------
-- Writing to a case
-- ---------------------------------------------------------------------------
create or replace function public.case_event(p_case uuid, p_kind text, p_note text, p_data jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.case_events (case_id, kind, actor_id, note_ar, data)
  values (p_case, p_kind, (select auth.uid()), p_note, coalesce(p_data, '{}'::jsonb));
  update public.cases set updated_at = now() where id = p_case;
$$;

revoke execute on function public.case_event(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.audit(p_action text, p_table text, p_id uuid, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, after_data)
  values ((select auth.uid()), p_action, p_table, p_id, p_data);
$$;

revoke execute on function public.audit(text, text, uuid, jsonb) from public, anon, authenticated;

-- Opening a case, from a ticket or from nothing.
create or replace function public.open_case(
  p_title    text,
  p_ticket   uuid default null,
  p_reported uuid default null
)
returns public.cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_ticket public.support_tickets%rowtype;
  v_case   public.cases;
begin
  if not public.is_admin() then
    raise exception 'القضايا للإدارة فقط';
  end if;

  if p_ticket is not null then
    select * into v_ticket from public.support_tickets where id = p_ticket;
    if not found then
      raise exception 'البلاغ غير موجود';
    end if;
    if v_ticket.case_id is not null then
      raise exception 'لهذا البلاغ قضية بالفعل';
    end if;
  end if;

  insert into public.cases (title_ar, priority, reporter_id, reported_profile_id, created_by)
  values (btrim(p_title), coalesce(v_ticket.priority, 'medium'), v_ticket.reporter_id,
          coalesce(p_reported, v_ticket.reported_profile_id), v_me)
  returning * into v_case;

  if p_ticket is not null then
    update public.support_tickets set case_id = v_case.id, status = 'under_review', updated_at = now() where id = p_ticket;
    insert into public.case_links (case_id, entity_type, entity_id, added_by) values (v_case.id, 'ticket', p_ticket, v_me);
    if v_ticket.related_type is not null then
      insert into public.case_links (case_id, entity_type, entity_id, added_by)
      values (v_case.id, v_ticket.related_type, v_ticket.related_id, v_me)
      on conflict do nothing;
    end if;
    insert into public.ticket_events (ticket_id, kind, actor_id, note_ar)
    values (p_ticket, 'case_opened', v_me, 'يُحقَّق في البلاغ ضمن قضية');
  end if;

  if v_case.reporter_id is not null then
    insert into public.case_links (case_id, entity_type, entity_id, added_by, note_ar)
    values (v_case.id, 'profile', v_case.reporter_id, v_me, 'المُبلِّغ') on conflict do nothing;
  end if;
  if v_case.reported_profile_id is not null then
    insert into public.case_links (case_id, entity_type, entity_id, added_by, note_ar)
    values (v_case.id, 'profile', v_case.reported_profile_id, v_me, 'المُبلَّغ عنه') on conflict do nothing;
  end if;

  perform public.case_event(v_case.id, 'opened', 'فُتحت القضية' || coalesce(' من البلاغ ' || v_ticket.code, ''));
  perform public.audit('case_open', 'cases', v_case.id, to_jsonb(v_case));
  return v_case;
end;
$$;

grant execute on function public.open_case(text, uuid, uuid) to authenticated;

create or replace function public.link_to_case(p_case uuid, p_type text, p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'القضايا للإدارة فقط';
  end if;
  insert into public.case_links (case_id, entity_type, entity_id, note_ar, added_by)
  values (p_case, p_type, p_id, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  on conflict do nothing;
  if p_type = 'ticket' then
    update public.support_tickets set case_id = p_case where id = p_id and case_id is null;
  end if;
  perform public.case_event(p_case, 'linked', 'رُبط ' || p_type, jsonb_build_object('type', p_type, 'id', p_id));
end;
$$;

grant execute on function public.link_to_case(uuid, text, uuid, text) to authenticated;

create or replace function public.add_case_note(p_case uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'القضايا للإدارة فقط';
  end if;
  insert into public.case_notes (case_id, author_id, body_ar) values (p_case, (select auth.uid()), btrim(p_body));
  perform public.case_event(p_case, 'note', 'ملاحظة إدارية');
end;
$$;

grant execute on function public.add_case_note(uuid, text) to authenticated;

create or replace function public.add_case_evidence(p_case uuid, p_label text, p_path text default null, p_url text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'القضايا للإدارة فقط';
  end if;
  insert into public.case_evidence (case_id, label_ar, path, url, added_by)
  values (p_case, btrim(p_label), p_path, p_url, (select auth.uid()));
  perform public.case_event(p_case, 'evidence', 'أُضيف دليل: ' || btrim(p_label));
end;
$$;

grant execute on function public.add_case_evidence(uuid, text, text, text) to authenticated;

-- The AI's reading of a case or a ticket, kept as a suggestion beside it.
create or replace function public.save_ai_assist(
  p_case uuid, p_ticket uuid, p_summary text, p_next_step text,
  p_category public.ticket_category default null, p_confidence integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'القضايا للإدارة فقط';
  end if;
  if p_case is not null then
    update public.cases set ai_summary_ar = p_summary, ai_next_step_ar = p_next_step, updated_at = now() where id = p_case;
    perform public.case_event(p_case, 'ai_assist', 'قرأ الذكاء الاصطناعي القضية (اقتراح لا قرار)');
  end if;
  if p_ticket is not null then
    update public.support_tickets
       set ai_summary_ar = p_summary, ai_suggested_action = p_next_step,
           ai_category = coalesce(p_category, ai_category),
           ai_confidence = coalesce(least(100, greatest(0, p_confidence)), ai_confidence)
     where id = p_ticket;
  end if;
end;
$$;

grant execute on function public.save_ai_assist(uuid, uuid, text, text, public.ticket_category, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The actions
-- ---------------------------------------------------------------------------
create or replace function public.admin_case_action(
  p_case          uuid,
  p_action        public.admin_action_kind,
  p_reason        text,
  p_target_profile uuid default null,
  p_target_id     uuid default null,
  p_feature       public.restricted_feature default null,
  p_duration_days integer default null,
  p_notify        boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := (select auth.uid());
  v_case     public.cases%rowtype;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_until    timestamptz;
  v_target   uuid := p_target_profile;
  v_ticket   record;
  v_evidence integer;
  v_label    text;
begin
  if not public.is_admin() then
    raise exception 'الإجراءات الإدارية للإدارة فقط';
  end if;

  select * into v_case from public.cases where id = p_case;
  if not found then
    raise exception 'القضية غير موجودة';
  end if;

  if v_reason is null then
    raise exception 'كل إجراء إداري يحتاج سبباً مكتوباً';
  end if;

  if p_action in ('warn', 'restrict_feature', 'suspend_account') then
    v_target := coalesce(v_target, v_case.reported_profile_id);
    if v_target is null then
      raise exception 'حدّد الشخص المقصود بالإجراء';
    end if;
    if v_target = v_me then
      raise exception 'لا تُتخذ إجراءات إدارية على حسابك نفسه';
    end if;

    -- What takes something away needs something behind it.
    select (select count(*) from public.case_evidence e where e.case_id = p_case)
         + (select count(*) from public.case_links l where l.case_id = p_case and l.entity_type <> 'profile')
      into v_evidence;
    if v_evidence = 0 then
      raise exception 'أرفق دليلاً أو اربط العملية بالقضية قبل هذا الإجراء';
    end if;
  end if;

  if p_action in ('restrict_feature', 'suspend_account') then
    if p_duration_days is null or p_duration_days < 0 then
      raise exception 'حدّد المدة بالأيام (0 = حتى يُرفع يدوياً)';
    end if;
    v_until := case when p_duration_days = 0 then null else now() + make_interval(days => p_duration_days) end;
  end if;

  if p_action = 'request_info' then
    for v_ticket in select t.id, t.code, t.reporter_id from public.support_tickets t
                     where t.case_id = p_case and (p_target_id is null or t.id = p_target_id)
                       and t.status not in ('resolved', 'rejected', 'closed')
    loop
      update public.support_tickets set status = 'pending_user', updated_at = now() where id = v_ticket.id;
      insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar) values (v_ticket.id, 'admin', v_me, v_reason);
      insert into public.ticket_events (ticket_id, kind, actor_id, note_ar) values (v_ticket.id, 'status_pending_user', v_me, 'طلب فريق الدعم معلومات إضافية');
      perform public.notify(v_ticket.reporter_id, 'support', 'فريق الدعم يحتاج معلومة منك — ' || v_ticket.code,
        v_reason, '/support/' || v_ticket.id::text, 'support_ticket', v_ticket.id, 'important');
    end loop;
    update public.cases set status = 'awaiting_info' where id = p_case;
    v_label := 'طُلبت معلومات إضافية';

  elsif p_action = 'warn' then
    insert into public.user_warnings (profile_id, case_id, reason_ar, issued_by) values (v_target, p_case, v_reason, v_me);
    if p_notify then
      perform public.notify(v_target, 'security', 'تنبيه من إدارة تكمود', v_reason, '/support', null, null, 'critical');
    end if;
    v_label := 'تنبيه للمستخدم';

  elsif p_action = 'restrict_feature' then
    if p_feature is null or p_feature = 'everything' then
      raise exception 'حدّد الميزة المقيّدة (إيقاف الحساب كله إجراء منفصل)';
    end if;
    insert into public.user_restrictions (profile_id, feature, reason_ar, case_id, ends_at, created_by)
    values (v_target, p_feature, v_reason, p_case, v_until, v_me);
    if p_notify then
      perform public.notify(v_target, 'security', 'قُيّدت ميزة على حسابك', v_reason, '/support', null, null, 'critical');
    end if;
    v_label := 'تقييد ميزة: ' || p_feature::text;

  elsif p_action = 'suspend_account' then
    insert into public.user_restrictions (profile_id, feature, reason_ar, case_id, ends_at, created_by)
    values (v_target, 'everything', v_reason, p_case, v_until, v_me);
    if p_notify then
      perform public.notify(v_target, 'security', 'أُوقف حسابك مؤقتاً', v_reason
        || ' — يمكنك الاعتراض من «المساعدة والبلاغات».', '/support', null, null, 'critical');
    end if;
    v_label := 'إيقاف الحساب';

  elsif p_action = 'lift_restriction' then
    update public.user_restrictions set lifted_at = now(), lifted_by = v_me
     where id = p_target_id and lifted_at is null
    returning profile_id into v_target;
    if v_target is null then
      raise exception 'القيد غير موجود أو رُفع بالفعل';
    end if;
    if p_notify then
      perform public.notify(v_target, 'security', 'رُفع قيد عن حسابك', v_reason, '/support');
    end if;
    v_label := 'رفع قيد';

  elsif p_action = 'suspend_session' then
    update public.video_sessions set status = 'cancelled' where id = p_target_id and status in ('scheduled', 'live');
    if not found then
      raise exception 'الجلسة غير موجودة أو انتهت';
    end if;
    v_label := 'إيقاف جلسة';

  elsif p_action = 'cancel_booking' then
    perform public.cancel_booking(p_target_id, v_reason);
    v_label := 'إلغاء حجز';

  elsif p_action = 'refund' then
    if exists (select 1 from public.bookings where id = p_target_id) then
      perform public.refund_booking(p_target_id, v_reason);
    elsif exists (select 1 from public.escrows where id = p_target_id) then
      perform public.refund_escrow(p_target_id, v_reason);
    else
      raise exception 'حدّد الحجز أو المبلغ المحتجز المراد إرجاعه';
    end if;
    v_label := 'إرجاع مبلغ';

  elsif p_action in ('reject_report', 'resolve') then
    for v_ticket in select t.id, t.code, t.reporter_id from public.support_tickets t
                     where t.case_id = p_case and t.status not in ('resolved', 'rejected', 'closed')
    loop
      update public.support_tickets
         set status = case when p_action = 'resolve' then 'resolved' else 'rejected' end::public.ticket_status,
             resolved_at = now(), updated_at = now()
       where id = v_ticket.id;
      insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar) values (v_ticket.id, 'admin', v_me, v_reason);
      insert into public.ticket_events (ticket_id, kind, actor_id, note_ar)
      values (v_ticket.id, case when p_action = 'resolve' then 'status_resolved' else 'status_rejected' end, v_me,
              case when p_action = 'resolve' then 'حُلّ البلاغ' else 'رُفض البلاغ' end);
      if p_notify then
        perform public.notify(v_ticket.reporter_id, 'support',
          case when p_action = 'resolve' then 'حُلّ بلاغك ' else 'أُغلق بلاغك ' end || v_ticket.code,
          v_reason, '/support/' || v_ticket.id::text, 'support_ticket', v_ticket.id);
      end if;
    end loop;
    update public.cases
       set status = case when p_action = 'resolve' then 'decided' else 'closed' end::public.case_status,
           decision_ar = v_reason, decided_by = v_me, decided_at = now()
     where id = p_case;
    v_label := case when p_action = 'resolve' then 'حُلّت القضية' else 'رُفض البلاغ' end;

  elsif p_action = 'escalate' then
    update public.cases
       set priority = case priority when 'low' then 'medium' when 'medium' then 'high' else 'urgent' end::public.ticket_priority,
           status = 'investigating'
     where id = p_case;
    perform public.notify_admins('صُعّدت القضية ' || v_case.code, v_reason, '/admin/cases/' || p_case::text, 'case', p_case, 'critical');
    v_label := 'تصعيد';
  end if;

  if p_action not in ('resolve', 'reject_report', 'request_info', 'escalate') and v_case.status = 'open' then
    update public.cases set status = 'investigating' where id = p_case;
  end if;

  perform public.case_event(p_case, 'action_' || p_action::text, v_label || ' — ' || v_reason,
    jsonb_build_object('action', p_action, 'target_profile', v_target, 'target_id', p_target_id,
                       'feature', p_feature, 'duration_days', p_duration_days, 'until', v_until, 'notified', p_notify));
  perform public.audit('case_action:' || p_action::text, 'cases', p_case,
    jsonb_build_object('reason', v_reason, 'target_profile', v_target, 'target_id', p_target_id,
                       'feature', p_feature, 'until', v_until, 'notified', p_notify));
end;
$$;

grant execute on function public.admin_case_action(
  uuid, public.admin_action_kind, text, uuid, uuid, public.restricted_feature, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- What an admin reads first: the facts, gathered
-- ---------------------------------------------------------------------------
-- The same summary the spec asks the AI for, built from rows so it exists
-- without a model: who, what, how much, where it stands, what came before.
create or replace function public.case_facts(p_case uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_case  public.cases%rowtype;
  v_facts jsonb := '[]'::jsonb;
  v_link  record;
  v_line  text;
begin
  if not public.is_admin() then
    return null;
  end if;

  select * into v_case from public.cases where id = p_case;
  if not found then
    return null;
  end if;

  for v_link in select * from public.case_links where case_id = p_case order by created_at loop
    v_line := case v_link.entity_type
      when 'booking' then (select 'الحجز ' || b.booking_code || ': ' || b.status::text || '، ' || b.price_usd || '$'
                             from public.bookings b where b.id = v_link.entity_id)
      when 'payment' then (select 'الدفعة ' || coalesce(p.payment_code, '') || ': ' || p.status::text || '، ' || p.amount_usd || '$'
                                  || case when p.proof_path is not null then '، إثبات مرفق' else '، بلا إثبات' end
                             from public.payments p where p.id = v_link.entity_id)
      when 'escrow' then (select 'المبلغ المحتجز ' || e.escrow_code || ': ' || e.status::text || '، ' || e.amount_usd || '$'
                            from public.escrows e where e.id = v_link.entity_id)
      when 'ticket' then (select 'البلاغ ' || t.code || ' (' || t.category::text || '): ' || t.subject_ar
                            from public.support_tickets t where t.id = v_link.entity_id)
      when 'profile' then (select coalesce(v_link.note_ar || ': ', '') || p.full_name || ' (' || p.techmood_id || ')'
                             || ' — بلاغات عنه خلال 90 يوماً: '
                             || (select count(*) from public.support_tickets t
                                  where t.reported_profile_id = p.id and t.created_at > now() - interval '90 days')
                             || '، تنبيهات سابقة: ' || (select count(*) from public.user_warnings w where w.profile_id = p.id)
                             from public.profiles p where p.id = v_link.entity_id)
      when 'video_session' then (select 'الجلسة ' || v.session_code || ': ' || v.status::text from public.video_sessions v where v.id = v_link.entity_id)
      when 'payout' then (select 'طلب السحب ' || r.request_code || ': ' || r.status::text || '، ' || r.amount_usd || '$' from public.payout_requests r where r.id = v_link.entity_id)
      when 'project' then (select 'المشروع ' || pr.code || ': ' || pr.status::text from public.projects pr where pr.id = v_link.entity_id)
      else v_link.entity_type || ' ' || v_link.entity_id::text
    end;
    if v_line is not null then
      v_facts := v_facts || to_jsonb(v_line);
    end if;
  end loop;

  return jsonb_build_object(
    'code', v_case.code,
    'title', v_case.title_ar,
    'facts', v_facts,
    'evidence', (select count(*) from public.case_evidence where case_id = p_case),
    'messages', (select count(*) from public.ticket_messages m join public.support_tickets t on t.id = m.ticket_id where t.case_id = p_case),
    'attachments', (select count(*) from public.ticket_messages m join public.support_tickets t on t.id = m.ticket_id
                     where t.case_id = p_case and m.attachment_path is not null)
  );
end;
$$;

grant execute on function public.case_facts(uuid) to authenticated;

create or replace function public.admin_cases(p_filter text default 'open')
returns table (
  id uuid, code text, title_ar text, status public.case_status, priority public.ticket_priority,
  reporter_name text, reported_name text, tickets integer, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.code, c.title_ar, c.status, c.priority,
         (select p.full_name from public.profiles p where p.id = c.reporter_id),
         (select p.full_name from public.profiles p where p.id = c.reported_profile_id),
         (select count(*)::int from public.support_tickets t where t.case_id = c.id),
         c.updated_at
    from public.cases c
   where public.is_admin()
     and (coalesce(p_filter, 'open') = 'all'
          or (p_filter = 'open' and c.status not in ('decided', 'closed'))
          or (p_filter = 'closed' and c.status in ('decided', 'closed')))
   order by case c.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, c.updated_at desc
   limit 300;
$$;

grant execute on function public.admin_cases(text) to authenticated;
