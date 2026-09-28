-- =============================================================================
-- 0100 — Notifications on the device: a third channel, and a daily nudge
--
-- 0065 built one engine with two channels (in-app, email) and a rule about
-- which. This is the third: Web Push, the notification that appears on a
-- phone's lock screen whether TechMood is open or not (0100 + the PWA's
-- service worker).
--
--   * A person turns it on per device (Settings → Notifications). The browser
--     gives a subscription; it is stored here, one row per device, theirs only.
--   * Per category they choose, as for email; the categories nobody may
--     silence (money, roles, security) reach the device too.
--   * Every notification the engine writes is copied to a push outbox for its
--     person when they have a device and want it — the same durable-queue shape
--     as email, written in the same transaction as the notification.
--   * A sender drains it: the `push-dispatch` Edge Function, woken every minute
--     by pg_cron through pg_net. It signs with VAPID keys that live in Supabase
--     Vault — the private key is never in this repository or in the app — and
--     removes a device the push service says is gone.
--   * A daily reminder: a learner with a device, an open path and nothing
--     studied in the last day gets one nudge a day (academy category, so they
--     can silence it).
--
-- Configuration lives in the database, not in code: `push_vapid_public_key`,
-- `push_vapid_subject` and `push_dispatch_url` are platform settings, and the
-- private key and the dispatcher's shared secret are Vault secrets named
-- `push_vapid_private_key` and `push_dispatch_secret`. Until they are set,
-- subscriptions are kept and the outbox fills, and nothing is sent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. A person's devices
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default extensions.gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~* '^https://'),
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failures        integer not null default 0
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()));

grant select on public.push_subscriptions to authenticated;

-- A device belongs to whoever is signed in on it now: re-subscribing the same
-- browser under another account moves it.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if coalesce(p_endpoint, '') !~* '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'اشتراك الجهاز غير صالح';
  end if;

  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, failures = 0;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and profile_id = (select auth.uid());
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- The public half of the VAPID pair, for the browser to subscribe with.
insert into public.platform_settings (key, value, description_ar) values
  ('push_vapid_public_key', '', 'مفتاح VAPID العام لإشعارات الجهاز (العام فقط؛ الخاص في Vault)'),
  ('push_vapid_subject',    '', 'جهة VAPID: رابط المنصة أو mailto للتواصل'),
  ('push_dispatch_url',     '', 'رابط دالة الإرسال push-dispatch على Supabase')
on conflict (key) do nothing;

create or replace function public.push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(value, '') from public.platform_settings where key = 'push_vapid_public_key';
$$;

revoke execute on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Choosing it, per category
-- ---------------------------------------------------------------------------
alter table public.notification_categories
  add column push_default boolean not null default true;

alter table public.notification_preferences
  add column push boolean not null default true;

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
    when p_channel = 'push' then coalesce(
      (select p.push from public.notification_preferences p
        where p.profile_id = p_profile and p.kind = p_kind),
      (select c.push_default from public.notification_categories c where c.kind = p_kind),
      true)
    else coalesce(
      (select p.in_app from public.notification_preferences p
        where p.profile_id = p_profile and p.kind = p_kind),
      (select c.in_app_default from public.notification_categories c where c.kind = p_kind),
      true)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The third channel's queue
-- ---------------------------------------------------------------------------
create table public.push_outbox (
  id              uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete set null,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  title           text not null,
  body            text,
  url             text,
  status          text not null default 'queued'
                    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts        integer not null default 0,
  last_error      text,
  queued_at       timestamptz not null default now(),
  sent_at         timestamptz
);

create index push_outbox_queue_idx on public.push_outbox (status, queued_at)
  where status in ('queued', 'sending');

alter table public.push_outbox enable row level security;
-- no policies: nobody reads or writes it from a client

create or replace function public.queue_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.profile_id = new.profile_id)
     and public.wants_notification(new.profile_id, new.kind, 'push') then
    insert into public.push_outbox (notification_id, profile_id, title, body, url)
    values (new.id, new.profile_id, new.title_ar, left(new.body_ar, 240), coalesce(new.link, '/notifications'));
  end if;
  return new;
end;
$$;

create trigger notifications_queue_push
  after insert on public.notifications
  for each row execute function public.queue_push_for_notification();

-- The sender's side, for the service role only.
create or replace function public.claim_push_batch(p_limit integer default 50)
returns table (id uuid, title text, body text, url text, subscriptions jsonb)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.push_outbox o
       set status = 'sending', attempts = o.attempts + 1
     where o.id in (
       select o2.id from public.push_outbox o2
        where o2.status = 'queued'
           or (o2.status = 'sending' and o2.queued_at < now() - interval '10 minutes' and o2.attempts < 3)
        order by o2.queued_at
        limit greatest(1, least(coalesce(p_limit, 50), 200))
        for update skip locked
     )
    returning o.id, o.profile_id, o.title, o.body, o.url
  )
  select c.id, c.title, c.body, c.url,
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint,
                                                        'p256dh', s.p256dh, 'auth', s.auth))
                     from public.push_subscriptions s where s.profile_id = c.profile_id), '[]'::jsonb)
    from claimed c;
$$;

create or replace function public.mark_push_result(
  p_outbox uuid, p_ok boolean, p_error text default null, p_gone uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         last_error = case when p_ok then null else left(p_error, 500) end
   where id = p_outbox;

  -- A device the push service no longer knows is removed, not retried.
  delete from public.push_subscriptions where id = any (coalesce(p_gone, '{}'));

  if p_ok then
    update public.push_subscriptions s set last_success_at = now(), failures = 0
      from public.push_outbox o
     where o.id = p_outbox and s.profile_id = o.profile_id;
  end if;
end;
$$;

-- The dispatcher's configuration, read from Vault. Only the service role (the
-- Edge Function) may call it.
create or replace function public.push_config()
returns table (public_key text, private_key text, subject text, dispatch_secret text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select (select nullif(value, '') from public.platform_settings where key = 'push_vapid_public_key'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private_key' limit 1),
         coalesce((select nullif(value, '') from public.platform_settings where key = 'push_vapid_subject'),
                  'mailto:support@techmood.app'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1);
end;
$$;

revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke execute on function public.mark_push_result(uuid, boolean, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.push_config() from public, anon, authenticated;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_push_batch(integer) to service_role;
    grant execute on function public.mark_push_result(uuid, boolean, text, uuid[]) to service_role;
    grant execute on function public.push_config() to service_role;
  end if;
end
$grants$;

-- Wakes the dispatcher when something is waiting. Needs pg_net and the two
-- settings; without them it does nothing, and the queue waits.
create or replace function public.dispatch_push()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if to_regnamespace('net') is null then
    return false;
  end if;
  if not exists (select 1 from public.push_outbox where status = 'queued') then
    return false;
  end if;

  select nullif(value, '') into v_url from public.platform_settings where key = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1;
  if v_url is null or v_secret is null then
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 20000
  );
  return true;
end;
$$;

revoke execute on function public.dispatch_push() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. One nudge a day
-- ---------------------------------------------------------------------------
create or replace function public.daily_learning_reminder()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r       record;
begin
  for r in
    select distinct e.profile_id,
           (select lp.title_ar from public.learning_paths lp where lp.id = e.path_id) as path_title,
           (select lp.slug from public.learning_paths lp where lp.id = e.path_id) as path_slug
      from public.enrollments e
     where e.path_id is not null and e.completed_at is null
       and exists (select 1 from public.push_subscriptions s where s.profile_id = e.profile_id)
       and not exists (select 1 from public.lesson_progress p
                        where p.profile_id = e.profile_id and p.updated_at > now() - interval '24 hours')
       and not exists (select 1 from public.notifications n
                        where n.profile_id = e.profile_id
                          and n.metadata ->> 'reminder' = 'daily'
                          and n.created_at > now() - interval '20 hours')
  loop
    -- one nudge per person, whichever path comes first
    if exists (select 1 from public.notifications n
                where n.profile_id = r.profile_id and n.metadata ->> 'reminder' = 'daily'
                  and n.created_at > now() - interval '20 hours') then
      continue;
    end if;

    perform public.notify(r.profile_id, 'academy', 'خطوة صغيرة اليوم؟',
      'درس واحد في «' || coalesce(r.path_title, 'مسارك') || '» يبقيك على الطريق.',
      '/academy/' || coalesce(r.path_slug, ''), null, null, 'info', '{"reminder":"daily"}'::jsonb);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.daily_learning_reminder() from public, anon, authenticated;

-- pg_net is how the database wakes the dispatcher (Supabase ships it).
do $net$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end
$net$;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-push-dispatch', '* * * * *', $$select public.dispatch_push()$$);
    perform cron.schedule('techmood-daily-reminder', '0 16 * * *', $$select public.daily_learning_reminder()$$);
  end if;
end
$migration$;
