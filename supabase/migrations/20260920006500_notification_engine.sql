-- =============================================================================
-- 0065 — One engine, two channels, and a rule about which
--
-- `notify()` has been the platform's one way of telling somebody something
-- since 0009, and twenty-four places call it. That part was right. What it
-- could not do is everything a notification centre needs:
--
--   * It knew a kind, a title, a body and a link — but not **what the
--     notification is about**. "Your project was evaluated" pointed at a URL
--     somebody typed by hand, and if that route ever changed the notification
--     lied. A notification now carries the entity it concerns.
--   * Everything was equally loud. A password change and a course
--     recommendation arrived the same way, so a person either read everything
--     or nothing.
--   * There was no second channel. Email is the obvious one — and the obvious
--     mistake is to make the email *be* the notification. Here the engine
--     writes the in-app row first, always, and email is a copy sent when the
--     kind deserves it and the person has not said otherwise.
--   * And nobody could say otherwise: there were no preferences at all.
--
-- The one rule that shapes the preferences: **a person may silence what is
-- theirs to silence, and nothing else.** Money, security and account decisions
-- reach them whatever their settings say, because a platform that lets somebody
-- switch off "your withdrawal was rejected" is not being respectful, it is
-- being negligent.
-- =============================================================================

create type public.notify_priority as enum ('critical', 'important', 'normal', 'info');

-- ---------------------------------------------------------------------------
-- What a notification now carries
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column entity_type text,
  add column entity_id   uuid,
  add column priority    public.notify_priority not null default 'normal',
  add column read_at     timestamptz,
  add column metadata    jsonb not null default '{}'::jsonb,
  add column emailed_at  timestamptz;

create index notifications_entity_idx on public.notifications (entity_type, entity_id);

update public.notifications set read_at = created_at where is_read and read_at is null;

-- is_read and read_at are the same fact; keep them from disagreeing.
create or replace function public.sync_notification_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_read and new.read_at is null then
    new.read_at := now();
  elsif not new.is_read then
    new.read_at := null;
  end if;
  return new;
end;
$$;

create trigger notifications_read_sync
  before insert or update of is_read on public.notifications
  for each row execute function public.sync_notification_read();

-- ---------------------------------------------------------------------------
-- What each category is, and what a person may do about it
-- ---------------------------------------------------------------------------
create table public.notification_categories (
  kind           public.notification_kind primary key,
  title_ar       text not null,
  detail_ar      text,
  -- the default, for somebody who has never opened the settings page
  in_app_default boolean not null default true,
  email_default  boolean not null default false,
  -- what a person may not silence: money, security, account decisions
  is_mandatory   boolean not null default false,
  sort_order     integer not null default 0
);

alter table public.notification_categories enable row level security;

create policy notification_categories_read on public.notification_categories
  for select to anon, authenticated using (true);

grant select on public.notification_categories to anon, authenticated;

insert into public.notification_categories
  (kind, title_ar, detail_ar, in_app_default, email_default, is_mandatory, sort_order) values
  ('academy',     'الأكاديمية',      'الدروس، التسليمات، الاختبارات، وتقدّم المسار.', true, false, false, 1),
  ('evaluation',  'تقييم الأعمال',    'ما يقوله المنتور عن عمل سلّمته.',            true, false, false, 2),
  ('booking',     'الجلسات',          'طلبات الحجز وقبولها وتذكيرها ومواعيدها.',     true, true,  false, 3),
  ('team',        'الفرق',            'الدعوات والمهام وقرارات الفريق.',             true, true,  false, 4),
  ('work',        'السوق والعمل',     'الفرص والطلبات والدعوات والعقود.',            true, true,  false, 5),
  ('project',     'المشاريع والمعرض', 'التسليم والتقييم والنشر في المعرض.',          true, false, false, 6),
  ('message',     'الرسائل',          'رسالة جديدة في محادثة.',                     true, false, false, 7),
  ('certificate', 'الشهادات',         'إصدار شهادة باسمك.',                         true, true,  false, 8),
  ('payment',     'المال',            'المدفوعات والاسترداد والسحب والمستحقات.',     true, true,  true,  9),
  ('role_review', 'الأدوار',          'قرارات مراجعة الأدوار التي طلبتها.',          true, true,  true,  10),
  ('security',    'الأمان والحساب',   'تغيير البريد أو كلمة المرور أو حالة الحساب.', true, true,  true,  11),
  ('system',      'إعلانات المنصة',   'تحديثات وإعلانات من إدارة TechMood.',         true, false, false, 12);

-- ---------------------------------------------------------------------------
-- What a person chose
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null references public.notification_categories (kind) on delete cascade,
  in_app     boolean not null default true,
  email      boolean not null default false,
  updated_at timestamptz not null default now(),

  primary key (profile_id, kind)
);

alter table public.notification_preferences enable row level security;

create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- The answer for one person and one category, defaults and all — and the
-- mandatory ones answer "yes" whatever the row says.
create or replace function public.wants_notification(
  p_profile uuid,
  p_kind    public.notification_kind,
  p_channel text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select c.is_mandatory from public.notification_categories c where c.kind = p_kind) then true
    when p_channel = 'email' then coalesce(
      (select p.email from public.notification_preferences p
        where p.profile_id = p_profile and p.kind = p_kind),
      (select c.email_default from public.notification_categories c where c.kind = p_kind),
      false)
    else coalesce(
      (select p.in_app from public.notification_preferences p
        where p.profile_id = p_profile and p.kind = p_kind),
      (select c.in_app_default from public.notification_categories c where c.kind = p_kind),
      true)
  end;
$$;

comment on function public.wants_notification is
  'What this person chose, or the category default — except where the category is one nobody may silence.';

grant execute on function public.wants_notification(uuid, public.notification_kind, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The second channel
-- ---------------------------------------------------------------------------
-- The email is not the notification: it is a copy of one. The outbox is a real,
-- durable queue — written inside the same transaction as the notification, so
-- an email can never exist for something that did not happen — and a sender
-- drains it. What this repository cannot do is *be* that sender: no mail
-- provider is configured here, and one cannot be stood up in a migration.
create table public.email_outbox (
  id              uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete set null,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  to_email        text not null,
  subject         text not null,
  body_ar         text not null,
  action_url      text,
  status          text not null default 'queued'
                    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts        integer not null default 0,
  last_error      text,
  queued_at       timestamptz not null default now(),
  sent_at         timestamptz
);

create index email_outbox_queue_idx on public.email_outbox (status, queued_at)
  where status in ('queued', 'sending');

alter table public.email_outbox enable row level security;

-- A person may see the mail the platform sent them; nobody else may, and no
-- client writes this table.
create policy email_outbox_own on public.email_outbox
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

grant select on public.email_outbox to authenticated;

-- ---------------------------------------------------------------------------
-- The engine
-- ---------------------------------------------------------------------------
-- Every caller of notify() since 0009 keeps working: the old five arguments
-- still mean what they meant. What is new is optional, and what is decided here
-- is which channels the message actually travels on.
create or replace function public.notify(
  p_profile     uuid,
  p_kind        public.notification_kind,
  p_title       text,
  p_body        text default null,
  p_link        text default null,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_priority    public.notify_priority default 'normal',
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_email text;
begin
  if p_profile is null then
    return null;
  end if;

  -- In-app first, always: it is the record that something happened. A person
  -- who silenced a category still has the row, marked as read, rather than a
  -- hole in their history.
  insert into public.notifications
    (profile_id, kind, title_ar, body_ar, link, entity_type, entity_id, priority, metadata,
     is_read)
  values (
    p_profile, p_kind, p_title, p_body, p_link, p_entity_type, p_entity_id, p_priority,
    coalesce(p_metadata, '{}'::jsonb),
    not public.wants_notification(p_profile, p_kind, 'in_app')
  )
  returning id into v_id;

  -- Email is a copy, and only when the category and the person agree.
  if public.wants_notification(p_profile, p_kind, 'email') then
    select u.email into v_email from auth.users u where u.id = p_profile;

    if v_email is not null then
      insert into public.email_outbox
        (notification_id, profile_id, to_email, subject, body_ar, action_url)
      values (v_id, p_profile, v_email, p_title, coalesce(p_body, p_title), p_link);
    end if;
  end if;

  return v_id;
end;
$$;

-- The old signature is still referenced by triggers written before today; drop
-- it so there is exactly one engine and no ambiguity about which one ran.
drop function if exists public.notify(uuid, public.notification_kind, text, text, text);

-- The engine is the platform's, not a client's: nobody writes into somebody
-- else's inbox by calling it.
revoke execute on function public.notify(
  uuid, public.notification_kind, text, text, text, text, uuid, public.notify_priority, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reading, and reading everything
-- ---------------------------------------------------------------------------
create or replace function public.my_notifications(
  p_kind   public.notification_kind default null,
  p_unread boolean default false,
  p_limit  integer default 50
)
returns table (
  id uuid, kind public.notification_kind, title_ar text, body_ar text, link text,
  entity_type text, entity_id uuid, priority public.notify_priority,
  is_read boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind, n.title_ar, n.body_ar, n.link, n.entity_type, n.entity_id,
         n.priority, n.is_read, n.created_at
    from public.notifications n
   where n.profile_id = (select auth.uid())
     and (p_kind is null or n.kind = p_kind)
     and (not p_unread or not n.is_read)
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.my_notifications(public.notification_kind, boolean, integer) to authenticated;

create or replace function public.notification_counts()
returns table (kind public.notification_kind, unread integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.kind,
         count(*) filter (where not n.is_read)::int,
         count(n.id)::int
    from public.notification_categories c
    left join public.notifications n
      on n.kind = c.kind and n.profile_id = (select auth.uid())
   group by c.kind, c.sort_order
   order by c.sort_order;
$$;

grant execute on function public.notification_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- An announcement from the platform
-- ---------------------------------------------------------------------------
create table public.notification_broadcasts (
  id           uuid primary key default extensions.gen_random_uuid(),
  kind         public.notification_kind not null default 'system',
  title_ar     text not null,
  body_ar      text,
  link         text,
  priority     public.notify_priority not null default 'info',
  audience_role public.user_role,
  send_email   boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  recipients   integer not null default 0
);

alter table public.notification_broadcasts enable row level security;

create policy notification_broadcasts_admin on public.notification_broadcasts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.notification_broadcasts to authenticated;

-- Sending one is a fan-out through the same engine, so an announcement obeys
-- the same preferences as everything else — and lands in the same inbox.
create or replace function public.send_broadcast(p_broadcast uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   public.notification_broadcasts%rowtype;
  v_person record;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;

  select * into v_row from public.notification_broadcasts where id = p_broadcast;
  if not found then
    raise exception 'الإعلان غير موجود';
  end if;

  if v_row.sent_at is not null then
    raise exception 'أُرسل هذا الإعلان بالفعل';
  end if;

  for v_person in
    select p.id from public.profiles p
     where v_row.audience_role is null
        or exists (
          select 1 from public.profile_roles pr
           where pr.profile_id = p.id
             and pr.role = v_row.audience_role
             and pr.status = 'approved'
        )
  loop
    perform public.notify(
      v_person.id, v_row.kind, v_row.title_ar, v_row.body_ar, v_row.link,
      'broadcast', v_row.id, v_row.priority,
      jsonb_build_object('broadcast', v_row.id)
    );
    v_count := v_count + 1;
  end loop;

  update public.notification_broadcasts
     set sent_at = now(), recipients = v_count
   where id = p_broadcast;

  return v_count;
end;
$$;

grant execute on function public.send_broadcast(uuid) to authenticated;

-- What actually happened to one: how many were told, how many read it, how much
-- mail it produced and how that mail fared.
create or replace function public.broadcast_log()
returns table (
  id uuid, title_ar text, kind public.notification_kind, priority public.notify_priority,
  audience_role public.user_role, sent_at timestamptz, recipients integer,
  read_count integer, emails integer, emails_sent integer, emails_failed integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title_ar, b.kind, b.priority, b.audience_role, b.sent_at, b.recipients,
         (select count(*)::int from public.notifications n
           where n.entity_type = 'broadcast' and n.entity_id = b.id and n.is_read),
         (select count(*)::int from public.email_outbox e
            join public.notifications n on n.id = e.notification_id
           where n.entity_type = 'broadcast' and n.entity_id = b.id),
         (select count(*)::int from public.email_outbox e
            join public.notifications n on n.id = e.notification_id
           where n.entity_type = 'broadcast' and n.entity_id = b.id and e.status = 'sent'),
         (select count(*)::int from public.email_outbox e
            join public.notifications n on n.id = e.notification_id
           where n.entity_type = 'broadcast' and n.entity_id = b.id and e.status = 'failed')
    from public.notification_broadcasts b
   where public.is_admin()
   order by coalesce(b.sent_at, b.created_at) desc;
$$;

grant execute on function public.broadcast_log() to authenticated;

-- ---------------------------------------------------------------------------
-- The sender's side of the outbox
-- ---------------------------------------------------------------------------
-- A worker claims a batch, sends it, and reports back. Claiming marks the rows
-- so two workers cannot send the same email twice; a row that fails keeps its
-- error and its attempt count, so a queue that is stuck says why.
create or replace function public.claim_email_batch(p_limit integer default 20)
returns table (id uuid, to_email text, subject text, body_ar text, action_url text)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.email_outbox e
       set status = 'sending', attempts = e.attempts + 1
     where e.id in (
       select e2.id from public.email_outbox e2
        where e2.status = 'queued'
        order by e2.queued_at
        limit greatest(1, least(coalesce(p_limit, 20), 100))
        for update skip locked
     )
    returning e.id, e.to_email, e.subject, e.body_ar, e.action_url
  )
  select * from claimed;
$$;

revoke execute on function public.claim_email_batch(integer) from public, anon, authenticated;

create or replace function public.mark_email_sent(p_email uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         last_error = case when p_ok then null else p_error end
   where id = p_email;
$$;

revoke execute on function public.mark_email_sent(uuid, boolean, text) from public, anon, authenticated;

comment on table public.email_outbox is
  'Queued copies of notifications. Written with the notification itself, so mail can never exist for something that did not happen. A sender drains it — this repository configures no mail provider.';
