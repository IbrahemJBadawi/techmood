-- =============================================================================
-- 0083 — Help & Reports: a ticket that becomes a conversation
--
-- A person reports a problem — a payment, a booking, a mentor, a message,
-- anything — and it becomes Ticket #TM-10001. The ticket is not a form that
-- disappears into a queue: it is a conversation with TechMood support whose
-- first line is automated.
--
-- The automated first line is honest about what it is. It reads the operation
-- the ticket is about (the reporter's own booking, payment, escrow, withdrawal)
-- and says where it stands, it lists what it already knows so nobody is asked
-- the same thing twice, and it asks only for what is missing. It never
-- decides anything. The cases the spec names — a money dispute, fraud, abuse or
-- harassment, a dispute between two people, a refund request, an account at
-- risk, a project dispute, repeated complaints about the same person, or
-- anything it cannot place — are escalated to a person with every piece of
-- context it gathered ("Needs Human Review"). These rules are written here, in
-- the database, so they apply whether or not an AI model is configured; when
-- one is, it assists the admin (0084), it does not replace these rules.
--
-- Privacy: a ticket is the reporter's and the admins'. The person a ticket is
-- about does not see it — reporting somebody must not expose the reporter.
-- =============================================================================

create sequence public.support_ticket_seq start 10001;

create table public.support_tickets (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default ('TM-' || nextval('public.support_ticket_seq')::text),
  reporter_id         uuid not null references public.profiles (id) on delete cascade,
  category            public.ticket_category not null,
  -- what it is about: one of the reporter's own operations, or a person/content
  related_type        text check (related_type in (
                        'booking', 'payment', 'escrow', 'project', 'team', 'video_session',
                        'course', 'profile', 'opportunity', 'payout', 'message')),
  related_id          uuid,
  reported_profile_id uuid references public.profiles (id) on delete set null,
  subject_ar          text not null check (length(btrim(subject_ar)) between 3 and 160),
  status              public.ticket_status not null default 'open',
  priority            public.ticket_priority not null default 'medium',
  needs_human         boolean not null default false,
  escalation_reason   text,
  -- written only by an admin's AI assist (0084): a suggestion, never a decision
  ai_category         public.ticket_category,
  ai_confidence       integer check (ai_confidence between 0 and 100),
  ai_suggested_action text,
  ai_summary_ar       text,
  assigned_to         uuid references public.profiles (id) on delete set null,
  case_id             uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz,

  check ((related_type is null) = (related_id is null))
);

create index support_tickets_reporter_idx on public.support_tickets (reporter_id, updated_at desc);
create index support_tickets_status_idx   on public.support_tickets (status, priority, updated_at desc);
create index support_tickets_reported_idx on public.support_tickets (reported_profile_id, created_at desc);

create table public.ticket_messages (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.support_tickets (id) on delete cascade,
  author_kind     public.ticket_author not null,
  author_id       uuid references public.profiles (id) on delete set null,
  body_ar         text not null check (length(body_ar) between 1 and 5000),
  attachment_path text,
  -- an admin's note to other admins; the reporter never sees it
  is_internal     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- The timeline the reporter reads: created, answered, sent to a person, asked
-- for evidence, resolved. Written by triggers and functions, never by a client.
create table public.ticket_events (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets (id) on delete cascade,
  kind       text not null,
  actor_id   uuid references public.profiles (id) on delete set null,
  note_ar    text,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_events   enable row level security;

create policy support_tickets_read on public.support_tickets
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

create policy ticket_messages_read on public.ticket_messages
  for select to authenticated
  using (
    public.is_admin()
    or (not is_internal and exists (
          select 1 from public.support_tickets t
           where t.id = ticket_id and t.reporter_id = (select auth.uid())))
  );

create policy ticket_events_read on public.ticket_events
  for select to authenticated
  using (
    public.is_admin()
    or (not is_internal and exists (
          select 1 from public.support_tickets t
           where t.id = ticket_id and t.reporter_id = (select auth.uid())))
  );

-- Every write goes through the functions below.
revoke insert, update, delete on public.support_tickets, public.ticket_messages, public.ticket_events
  from anon, authenticated;
grant select on public.support_tickets, public.ticket_messages, public.ticket_events to authenticated;

-- ---------------------------------------------------------------------------
-- Telling every admin
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins(
  p_title    text,
  p_body     text,
  p_link     text,
  p_type     text,
  p_id       uuid,
  p_priority public.notify_priority default 'important'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  for v_admin in
    select pr.profile_id from public.profile_roles pr
     where pr.role = 'admin' and pr.status = 'approved'
  loop
    perform public.notify(v_admin, 'support', p_title, p_body, p_link, p_type, p_id, p_priority);
  end loop;
end;
$$;

revoke execute on function public.notify_admins(text, text, text, text, uuid, public.notify_priority)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What a person may report something about
-- ---------------------------------------------------------------------------
-- §29: a ticket may point only at an operation the reporter is part of, or at
-- a person, message or piece of content they could actually see. Returns the
-- other side of the operation when there is one, so the ticket knows who it is
-- about without the reporter having to type an id.
create or replace function public.report_target(p_type text, p_id uuid)
returns table (allowed boolean, other_party uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_row record;
begin
  if p_type is null then
    return query select true, null::uuid;
    return;
  end if;

  if p_type = 'booking' then
    select b.student_id, b.mentor_id, b.team_id into v_row from public.bookings b where b.id = p_id;
    if found and (v_row.student_id = v_me or v_row.mentor_id = v_me
                  or (v_row.team_id is not null and public.is_team_member(v_row.team_id))) then
      return query select true, case when v_row.mentor_id = v_me then v_row.student_id else v_row.mentor_id end;
      return;
    end if;

  elsif p_type = 'payment' then
    select b.student_id, b.mentor_id, e.payer_id, e.payee_id into v_row
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.escrows  e on e.id = p.escrow_id
     where p.id = p_id;
    if found and v_me in (v_row.student_id, v_row.payer_id) then
      return query select true, coalesce(v_row.mentor_id, v_row.payee_id);
      return;
    end if;

  elsif p_type = 'escrow' then
    select e.payer_id, e.payee_id into v_row from public.escrows e where e.id = p_id;
    if found and v_me in (v_row.payer_id, v_row.payee_id) then
      return query select true, case when v_row.payer_id = v_me then v_row.payee_id else v_row.payer_id end;
      return;
    end if;

  elsif p_type = 'project' then
    if public.is_project_party(p_id) then
      select pr.owner_id, pr.client_id into v_row from public.projects pr where pr.id = p_id;
      return query select true, case when v_row.client_id = v_me then v_row.owner_id
                                     when v_row.owner_id = v_me then v_row.client_id end;
      return;
    end if;

  elsif p_type = 'team' then
    if public.is_team_member(p_id) then
      return query select true, null::uuid;
      return;
    end if;

  elsif p_type = 'video_session' then
    if exists (select 1 from public.video_session_participants vp
                where vp.session_id = p_id and vp.profile_id = v_me) then
      return query select true, null::uuid;
      return;
    end if;

  elsif p_type = 'payout' then
    if exists (select 1 from public.payout_requests pr where pr.id = p_id and pr.profile_id = v_me) then
      return query select true, null::uuid;
      return;
    end if;

  elsif p_type = 'message' then
    select m.sender_id, m.conversation_id into v_row from public.messages m where m.id = p_id;
    if found and exists (select 1 from public.conversation_participants cp
                          where cp.conversation_id = v_row.conversation_id and cp.profile_id = v_me) then
      return query select true, v_row.sender_id;
      return;
    end if;

  elsif p_type = 'profile' then
    if p_id <> v_me and exists (select 1 from public.profiles p where p.id = p_id) then
      return query select true, p_id;
      return;
    end if;

  elsif p_type = 'course' then
    if exists (select 1 from public.courses c where c.id = p_id) then
      return query select true, null::uuid;
      return;
    end if;

  elsif p_type = 'opportunity' then
    if public.can_read_brief(p_id) then
      select o.posted_by into v_row from public.opportunities o where o.id = p_id;
      return query select true, v_row.posted_by;
      return;
    end if;
  end if;

  return query select false, null::uuid;
end;
$$;

grant execute on function public.report_target(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Priority and escalation: rules, not guesses
-- ---------------------------------------------------------------------------
-- Priority is set by the system; the reporter does not have to judge it.
create or replace function public.ticket_triage(
  p_category    public.ticket_category,
  p_related     text,
  p_related_id  uuid,
  p_reported    uuid,
  p_text        text,
  p_ticket      uuid default null
)
returns table (priority public.ticket_priority, escalate boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_text     text := lower(coalesce(p_text, ''));
  v_repeated integer := 0;
  v_pay      public.payment_status;
  v_escrow   public.escrow_status;
begin
  if p_reported is not null then
    select count(*) into v_repeated
      from public.support_tickets t
     where t.reported_profile_id = p_reported
       and t.created_at > now() - interval '30 days'
       and (p_ticket is null or t.id <> p_ticket);
  end if;

  if p_related = 'payment' then
    select p.status into v_pay from public.payments p where p.id = p_related_id;
  elsif p_related = 'escrow' then
    select e.status into v_escrow from public.escrows e where e.id = p_related_id;
  end if;

  -- the order is the order of seriousness: the first rule that fits decides
  if p_category = 'fraud' or v_text ~ '(احتيال|نصب|سرق|fraud|scam)' then
    return query select 'urgent'::public.ticket_priority, true, 'fraud';
  elsif p_category = 'behavior' or v_text ~ '(تحرش|إساءة|اساءة|تهديد|شتم|harass|abuse|threat)' then
    return query select 'urgent'::public.ticket_priority, true, 'abuse';
  elsif p_category = 'account' and v_text ~ '(اختراق|مخترق|سرقة الحساب|hacked|compromised|لم أعد أستطيع الدخول)' then
    return query select 'urgent'::public.ticket_priority, true, 'account_risk';
  elsif v_text ~ '(استرداد|استرجاع|ارجاع المبلغ|إرجاع المبلغ|refund)' then
    return query select 'high'::public.ticket_priority, true, 'refund';
  elsif v_repeated >= 2 then
    return query select 'high'::public.ticket_priority, true, 'repeated_complaints';
  elsif v_escrow = 'disputed' or (p_related in ('project', 'escrow') and p_category in ('freelancer', 'client')) then
    return query select 'high'::public.ticket_priority, true, 'project_dispute';
  elsif p_category = 'payment' and v_pay in ('verified', 'rejected', 'refunded') then
    return query select 'high'::public.ticket_priority, true, 'money_dispute';
  elsif p_category in ('mentor', 'mentee') and p_reported is not null then
    return query select 'medium'::public.ticket_priority, true, 'relationship_dispute';
  elsif p_category = 'copyright' then
    return query select 'high'::public.ticket_priority, true, 'content_rights';
  elsif p_category = 'account' then
    return query select 'high'::public.ticket_priority, true, 'account_risk';
  elsif v_text ~ '(موظف|انسان|إنسان|شخص حقيقي|human|agent)' then
    return query select 'medium'::public.ticket_priority, true, 'asked_for_person';
  elsif p_category = 'other' and p_related is null then
    return query select 'low'::public.ticket_priority, true, 'unknown';
  elsif p_category = 'payment' then
    return query select 'high'::public.ticket_priority, false, null::text;
  elsif p_category in ('booking', 'mentor', 'mentee', 'freelancer', 'client', 'content') then
    return query select 'medium'::public.ticket_priority, false, null::text;
  else
    return query select 'low'::public.ticket_priority, false, null::text;
  end if;
end;
$$;

revoke execute on function public.ticket_triage(public.ticket_category, text, uuid, uuid, text, uuid)
  from public, anon, authenticated;

create or replace function public.escalation_label(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'fraud'                then 'اتهام أو شبهة احتيال'
    when 'abuse'                then 'إساءة أو تحرش أو سلوك مخالف'
    when 'account_risk'         then 'حساب معرّض للخطر'
    when 'refund'               then 'طلب استرداد'
    when 'repeated_complaints'  then 'شكاوى متكررة عن الشخص نفسه'
    when 'project_dispute'      then 'نزاع على مشروع'
    when 'money_dispute'        then 'نزاع مالي'
    when 'relationship_dispute' then 'خلاف بين طرفي علاقة إرشاد'
    when 'content_rights'       then 'حقوق محتوى'
    when 'asked_for_person'     then 'طلب التحدث مع شخص'
    when 'unknown'              then 'حالة لا يستطيع المساعد تحديدها'
    else coalesce(p_reason, '')
  end;
$$;

grant execute on function public.escalation_label(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The automated first line: reads the operation, says where it stands
-- ---------------------------------------------------------------------------
-- Everything here is read from the reporter's own rows; it states facts and
-- asks for what is missing, and it never promises an outcome.
create or replace function public.support_first_reply(p_ticket uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t        public.support_tickets%rowtype;
  v_name   text;
  v_pay    public.payments%rowtype;
  v_book   public.bookings%rowtype;
  v_escrow public.escrows%rowtype;
  v_out    public.payout_requests%rowtype;
  v_has_file boolean;
  v_lines  text[] := '{}';
begin
  select * into t from public.support_tickets where id = p_ticket;
  select coalesce(p.display_name, split_part(p.full_name, ' ', 1)) into v_name from public.profiles p where p.id = t.reporter_id;
  select exists (select 1 from public.ticket_messages m where m.ticket_id = p_ticket and m.attachment_path is not null)
    into v_has_file;

  v_lines := array_append(v_lines, (('مرحباً ' || coalesce(v_name, '') || '، استلمنا البلاغ ' || t.code || '.'))::text);

  -- a payment, directly or through its booking
  if t.related_type = 'payment' then
    select * into v_pay from public.payments where id = t.related_id;
  elsif t.related_type = 'booking' then
    select * into v_book from public.bookings where id = t.related_id;
    select * into v_pay from public.payments where booking_id = t.related_id order by created_at desc limit 1;
  elsif t.related_type = 'escrow' then
    select * into v_escrow from public.escrows where id = t.related_id;
    select * into v_pay from public.payments where escrow_id = t.related_id order by created_at desc limit 1;
  elsif t.related_type = 'payout' then
    select * into v_out from public.payout_requests where id = t.related_id;
  end if;

  if v_book.id is null and v_pay.booking_id is not null then
    select * into v_book from public.bookings where id = v_pay.booking_id;
  end if;

  if v_pay.id is not null then
    v_lines := array_append(v_lines, (case v_pay.status
      when 'pending'      then 'الدفعة ' || coalesce(v_pay.payment_code, '') || ' لم يصلنا إيصالها بعد. ارفع صورة التحويل من صفحة الدفع لتبدأ مراجعتها.'
      when 'under_review' then 'الدفعة ' || coalesce(v_pay.payment_code, '') || ' وصل إيصالها وهي قيد المراجعة من الإدارة. لا يلزمك شيء الآن.'
      when 'needs_info'   then 'الإدارة طلبت معلومة عن الدفعة: «' || coalesce(v_pay.info_request_ar, '') || '». أجب عنها من صفحة الدفع.'
      when 'verified'     then 'تم تأكيد الدفعة ' || coalesce(v_pay.payment_code, '') || '.'
      when 'rejected'     then 'رُفض إيصال الدفعة: «' || coalesce(v_pay.rejection_reason, 'بلا سبب مكتوب') || '».'
      when 'refunded'     then 'أُعيدت قيمة الدفعة إلى محفظتك.'
      else 'حالة الدفعة: ' || v_pay.status::text || '.'
    end)::text);
  end if;

  if v_book.id is not null then
    v_lines := array_append(v_lines, (case v_book.status
      when 'payment_pending'   then 'الحجز ' || v_book.booking_code || ' محجوز مؤقتاً بانتظار الدفع.'
      when 'payment_submitted' then 'الحجز ' || v_book.booking_code || ' بانتظار مراجعة الدفع.'
      when 'mentor_pending'    then 'الحجز ' || v_book.booking_code || ' بانتظار موافقة المنتور'
                                     || coalesce(' حتى ' || to_char(v_book.mentor_respond_by at time zone 'Asia/Jerusalem', 'YYYY-MM-DD HH24:MI'), '')
                                     || '. إن لم يردّ في المهلة يُعتذر عنه تلقائياً ويُعاد المبلغ.'
      when 'confirmed'         then 'الحجز ' || v_book.booking_code || ' مؤكد.'
      when 'completed'         then 'الجلسة ' || v_book.booking_code || ' مكتملة.'
      when 'rejected'          then 'اعتذر المنتور عن الحجز ' || v_book.booking_code || coalesce(' («' || v_book.cancelled_reason || '»)', '') || '، والمبلغ المدفوع يُعاد لك.'
      when 'cancelled'         then 'الحجز ' || v_book.booking_code || ' ملغى.'
      when 'refunded'          then 'الحجز ' || v_book.booking_code || ' أُعيدت قيمته.'
      when 'expired'           then 'انتهت مهلة الحجز المؤقت ' || v_book.booking_code || ' قبل الدفع.'
      else 'حالة الحجز: ' || v_book.status::text || '.'
    end)::text);
  end if;

  if v_escrow.id is not null then
    v_lines := array_append(v_lines, (case v_escrow.status
      when 'awaiting_payment' then 'المبلغ المحتجز ' || v_escrow.escrow_code || ' بانتظار الدفع.'
      when 'funded'           then 'المبلغ ' || v_escrow.escrow_code || ' محتجز لدى تكمود حتى تسليم العمل.'
      when 'released'         then 'أُفرج عن المبلغ ' || v_escrow.escrow_code || ' لمن نفّذ العمل.'
      when 'disputed'         then 'المبلغ ' || v_escrow.escrow_code || ' عليه نزاع مفتوح لدى الإدارة.'
      when 'refunded'         then 'أُعيد المبلغ ' || v_escrow.escrow_code || ' للعميل.'
      else 'حالة المبلغ المحتجز: ' || v_escrow.status::text || '.'
    end)::text);
  end if;

  if v_out.id is not null then
    v_lines := array_append(v_lines, (case v_out.status::text
      when 'requested'  then 'طلب السحب ' || v_out.request_code || ' وصل وينتظر المعالجة.'
      when 'processing' then 'طلب السحب ' || v_out.request_code || ' قيد التحويل.'
      when 'completed'  then 'تم تحويل طلب السحب ' || v_out.request_code || coalesce(' (مرجع ' || v_out.paid_reference || ')', '') || '.'
      else 'حالة طلب السحب: ' || v_out.status::text || '.'
    end)::text);
  end if;

  -- ask only for what is missing
  if t.category = 'payment' and v_pay.id is null then
    v_lines := array_append(v_lines, ('لم يُربط البلاغ بعملية دفع. اكتب رقم العملية أو الحجز، طريقة الدفع، تاريخ التحويل والمبلغ.')::text);
  end if;
  if t.category in ('payment', 'fraud') and not v_has_file and coalesce(v_pay.proof_path, '') = '' then
    v_lines := array_append(v_lines, ('إن كانت لديك صورة التحويل أو أي دليل، أرفقه هنا.')::text);
  end if;
  if t.category in ('behavior', 'mentor', 'mentee', 'freelancer', 'client') and not v_has_file then
    v_lines := array_append(v_lines, ('إن كانت هناك رسائل أو لقطات شاشة تخص المشكلة، أرفقها هنا — تبقى بينك وبين فريق الدعم.')::text);
  end if;

  if t.needs_human then
    v_lines := array_append(v_lines, (('هذه الحالة (' || public.escalation_label(t.escalation_reason) || ') يراجعها فريق الدعم بنفسه، وقد حُوّلت إليه مع كل ما سبق. سنردّ عليك هنا.'))::text);
  else
    v_lines := array_append(v_lines, ('اكتب هنا أي تفاصيل إضافية. وإن أردت التحدث مع شخص من فريق الدعم فاكتب ذلك وسيُحوّل البلاغ إليه.')::text);
  end if;

  return array_to_string(v_lines, E'\n');
end;
$$;

revoke execute on function public.support_first_reply(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Opening a ticket
-- ---------------------------------------------------------------------------
create or replace function public.open_ticket(
  p_category    public.ticket_category,
  p_subject     text,
  p_description text,
  p_related     text default null,
  p_related_id  uuid default null,
  p_attachment  text default null,
  p_reported    uuid default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_target record;
  v_triage record;
  v_ticket public.support_tickets;
  v_other  uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'اشرح المشكلة في عشرة أحرف على الأقل';
  end if;

  if (p_related is null) <> (p_related_id is null) then
    raise exception 'حدّد العملية المرتبطة كاملة أو اتركها فارغة';
  end if;

  select * into v_target from public.report_target(p_related, p_related_id);
  if not v_target.allowed then
    raise exception 'لا يمكنك الإبلاغ عن عملية لست طرفاً فيها';
  end if;

  -- The person it is about: the other side of the operation, or someone the
  -- reporter names who is on that operation. A reporter cannot attach an
  -- arbitrary stranger to an operation they share with somebody else.
  v_other := v_target.other_party;
  if p_reported is not null then
    if p_reported = v_me then
      raise exception 'لا يمكنك الإبلاغ عن نفسك';
    end if;
    if v_other is not null and p_reported <> v_other then
      raise exception 'الشخص المُبلَّغ عنه ليس طرفاً في هذه العملية';
    end if;
    if p_related is null or p_related in ('team', 'video_session') then
      select allowed into v_target from public.report_target('profile', p_reported);
      if not v_target.allowed then
        raise exception 'الشخص المُبلَّغ عنه غير موجود';
      end if;
    end if;
    v_other := p_reported;
  end if;

  if p_attachment is not null and split_part(p_attachment, '/', 1) <> v_me::text then
    raise exception 'المرفق يجب أن يكون من ملفاتك';
  end if;

  select * into v_triage from public.ticket_triage(
    p_category, p_related, p_related_id, v_other, p_subject || ' ' || p_description);

  insert into public.support_tickets
    (reporter_id, category, related_type, related_id, reported_profile_id, subject_ar,
     status, priority, needs_human, escalation_reason)
  values
    (v_me, p_category, p_related, p_related_id, v_other, btrim(p_subject),
     case when v_triage.escalate then 'needs_human' else 'assistant' end::public.ticket_status,
     v_triage.priority, v_triage.escalate, v_triage.reason)
  returning * into v_ticket;

  insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar, attachment_path)
  values (v_ticket.id, 'user', v_me, btrim(p_description), p_attachment);

  insert into public.ticket_events (ticket_id, kind, actor_id, note_ar)
  values (v_ticket.id, 'created', v_me, 'أُنشئ البلاغ');

  insert into public.ticket_messages (ticket_id, author_kind, body_ar)
  values (v_ticket.id, 'assistant', public.support_first_reply(v_ticket.id));

  insert into public.ticket_events (ticket_id, kind, note_ar)
  values (v_ticket.id, 'assistant_collected', 'جمع المساعد معلومات العملية');

  if v_ticket.needs_human then
    insert into public.ticket_events (ticket_id, kind, note_ar)
    values (v_ticket.id, 'escalated', 'حُوّل إلى فريق الدعم: ' || public.escalation_label(v_ticket.escalation_reason));

    perform public.notify_admins(
      'بلاغ يحتاج مراجعة: ' || v_ticket.code,
      public.escalation_label(v_ticket.escalation_reason) || ' — ' || v_ticket.subject_ar,
      '/admin/support/' || v_ticket.id::text, 'support_ticket', v_ticket.id,
      case when v_ticket.priority = 'urgent' then 'critical' else 'important' end::public.notify_priority);
  end if;

  return v_ticket;
end;
$$;

grant execute on function public.open_ticket(public.ticket_category, text, text, text, uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Talking in a ticket
-- ---------------------------------------------------------------------------
create or replace function public.post_ticket_message(
  p_ticket     uuid,
  p_body       text,
  p_attachment text default null,
  p_internal   boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_admin   boolean := public.is_admin();
  v_ticket  public.support_tickets%rowtype;
  v_triage  record;
  v_id      uuid;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket;
  if not found or (v_ticket.reporter_id <> v_me and not v_admin) then
    raise exception 'البلاغ غير موجود';
  end if;

  if v_ticket.status in ('resolved', 'rejected', 'closed') and not v_admin then
    raise exception 'أُغلق هذا البلاغ. افتح بلاغاً جديداً إن استمرت المشكلة';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'اكتب رسالة';
  end if;

  if p_attachment is not null and split_part(p_attachment, '/', 1) <> v_me::text then
    raise exception 'المرفق يجب أن يكون من ملفاتك';
  end if;

  if v_ticket.reporter_id = v_me and not v_admin then
    insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar, attachment_path)
    values (p_ticket, 'user', v_me, btrim(p_body), p_attachment)
    returning id into v_id;

    -- A reply can change what the case is — a refund asked for, a person
    -- asked for, something serious said. The same rules decide.
    if not v_ticket.needs_human then
      select * into v_triage from public.ticket_triage(
        v_ticket.category, v_ticket.related_type, v_ticket.related_id,
        v_ticket.reported_profile_id, p_body, v_ticket.id);

      if v_triage.escalate then
        update public.support_tickets
           set needs_human = true, escalation_reason = v_triage.reason, status = 'needs_human',
               priority = greatest(priority, v_triage.priority), updated_at = now()
         where id = p_ticket;

        insert into public.ticket_messages (ticket_id, author_kind, body_ar)
        values (p_ticket, 'assistant',
                'حوّلت المحادثة إلى فريق الدعم (' || public.escalation_label(v_triage.reason)
                || ')، ومعها كل ما جمعته. سيردّ عليك شخص من الفريق هنا.');

        insert into public.ticket_events (ticket_id, kind, note_ar)
        values (p_ticket, 'escalated', 'حُوّل إلى فريق الدعم: ' || public.escalation_label(v_triage.reason));

        perform public.notify_admins(
          'بلاغ يحتاج مراجعة: ' || v_ticket.code, public.escalation_label(v_triage.reason),
          '/admin/support/' || p_ticket::text, 'support_ticket', p_ticket);
      end if;
    elsif v_ticket.status = 'pending_user' then
      update public.support_tickets set status = 'under_review', updated_at = now() where id = p_ticket;
      insert into public.ticket_events (ticket_id, kind, note_ar)
      values (p_ticket, 'user_answered', 'ردّ صاحب البلاغ');
      perform public.notify_admins(
        'ردّ على البلاغ ' || v_ticket.code, left(p_body, 140),
        '/admin/support/' || p_ticket::text, 'support_ticket', p_ticket, 'normal');
    end if;

    update public.support_tickets set updated_at = now() where id = p_ticket;
  else
    insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar, attachment_path, is_internal)
    values (p_ticket, 'admin', v_me, btrim(p_body), p_attachment, coalesce(p_internal, false))
    returning id into v_id;

    if not coalesce(p_internal, false) then
      update public.support_tickets
         set status = case when status in ('open', 'assistant', 'needs_human') then 'under_review' else status end,
             assigned_to = coalesce(assigned_to, v_me), updated_at = now()
       where id = p_ticket;

      insert into public.ticket_events (ticket_id, kind, actor_id, note_ar)
      values (p_ticket, 'admin_replied', v_me, 'ردّ فريق الدعم');

      perform public.notify(v_ticket.reporter_id, 'support', 'ردّ فريق الدعم على بلاغك ' || v_ticket.code,
        left(p_body, 200), '/support/' || p_ticket::text, 'support_ticket', p_ticket, 'important');
    else
      insert into public.ticket_events (ticket_id, kind, actor_id, note_ar, is_internal)
      values (p_ticket, 'internal_note', v_me, 'ملاحظة داخلية', true);
    end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.post_ticket_message(uuid, text, text, boolean) to authenticated;

-- An admin moves a ticket along. Resolving and rejecting say why, to the
-- reporter, in the conversation.
create or replace function public.set_ticket_status(
  p_ticket uuid,
  p_status public.ticket_status,
  p_note   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_ticket public.support_tickets%rowtype;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'إدارة البلاغات للإدارة فقط';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket;
  if not found then
    raise exception 'البلاغ غير موجود';
  end if;

  if p_status in ('resolved', 'rejected', 'pending_user') and v_note is null then
    raise exception 'اكتب لصاحب البلاغ ما حدث أو ما المطلوب منه';
  end if;

  update public.support_tickets
     set status = p_status,
         assigned_to = coalesce(assigned_to, v_me),
         resolved_at = case when p_status in ('resolved', 'rejected', 'closed') then now() else null end,
         updated_at = now()
   where id = p_ticket;

  if v_note is not null then
    insert into public.ticket_messages (ticket_id, author_kind, author_id, body_ar)
    values (p_ticket, 'admin', v_me, v_note);
  end if;

  insert into public.ticket_events (ticket_id, kind, actor_id, note_ar)
  values (p_ticket, 'status_' || p_status::text, v_me,
          case p_status
            when 'pending_user' then 'طلب فريق الدعم معلومات إضافية'
            when 'under_review' then 'يراجعه فريق الدعم'
            when 'resolved'     then 'حُلّ البلاغ'
            when 'rejected'     then 'رُفض البلاغ'
            when 'closed'       then 'أُغلق البلاغ'
            else 'تغيّرت الحالة'
          end);

  perform public.notify(v_ticket.reporter_id, 'support',
    case p_status
      when 'pending_user' then 'فريق الدعم يحتاج معلومة منك — ' || v_ticket.code
      when 'resolved'     then 'حُلّ بلاغك ' || v_ticket.code
      when 'rejected'     then 'أُغلق بلاغك ' || v_ticket.code
      else 'تحديث على بلاغك ' || v_ticket.code
    end,
    v_note, '/support/' || p_ticket::text, 'support_ticket', p_ticket);
end;
$$;

grant execute on function public.set_ticket_status(uuid, public.ticket_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The reporter's list, and the admin's
-- ---------------------------------------------------------------------------
create or replace function public.my_tickets()
returns table (
  id uuid, code text, category public.ticket_category, subject_ar text, status public.ticket_status,
  needs_human boolean, updated_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.code, t.category, t.subject_ar, t.status, t.needs_human, t.updated_at, t.created_at
    from public.support_tickets t
   where t.reporter_id = (select auth.uid())
   order by t.updated_at desc;
$$;

grant execute on function public.my_tickets() to authenticated;

create or replace function public.admin_tickets(p_filter text default 'open')
returns table (
  id uuid, code text, category public.ticket_category, subject_ar text, status public.ticket_status,
  priority public.ticket_priority, needs_human boolean, escalation_reason text,
  ai_category public.ticket_category, ai_confidence integer, ai_suggested_action text,
  reporter_id uuid, reporter_name text, reporter_techmood_id text,
  reported_profile_id uuid, reported_name text, case_id uuid,
  updated_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.code, t.category, t.subject_ar, t.status, t.priority, t.needs_human, t.escalation_reason,
         t.ai_category, t.ai_confidence, t.ai_suggested_action,
         t.reporter_id, rp.full_name, rp.techmood_id,
         t.reported_profile_id, xp.full_name, t.case_id,
         t.updated_at, t.created_at
    from public.support_tickets t
    join public.profiles rp on rp.id = t.reporter_id
    left join public.profiles xp on xp.id = t.reported_profile_id
   where public.is_admin()
     and case coalesce(p_filter, 'open')
           when 'all'       then true
           when 'open'      then t.status not in ('resolved', 'rejected', 'closed')
           when 'pending'   then t.status = 'pending_user'
           when 'escalated' then t.needs_human and t.status not in ('resolved', 'rejected', 'closed')
           when 'assistant' then t.status = 'assistant'
           when 'resolved'  then t.status in ('resolved', 'rejected', 'closed')
           else true
         end
   order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
            t.updated_at desc
   limit 300;
$$;

grant execute on function public.admin_tickets(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('support-files', 'support-files', false)
on conflict (id) do nothing;

-- A file is uploaded into the uploader's own folder. It can be read by its
-- uploader, by admins, and by the reporter when support attached it to their
-- ticket in a line they can see.
create or replace function public.can_read_support_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_name, '/', 1) = (select auth.uid())::text
      or public.is_admin()
      or exists (
        select 1 from public.ticket_messages m
          join public.support_tickets t on t.id = m.ticket_id
         where m.attachment_path = p_name and not m.is_internal
           and t.reporter_id = (select auth.uid()));
$$;

grant execute on function public.can_read_support_file(text) to authenticated;

create policy support_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'support-files' and public.can_read_support_file(name));

create policy support_files_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
