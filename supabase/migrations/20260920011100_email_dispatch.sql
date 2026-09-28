-- =============================================================================
-- 0111 — Sending the email outbox
--
-- 0065 built the outbox: every email the platform owes somebody is written in
-- the same transaction as the notification it copies. What it could not have
-- was a sender. This is the database's half of one, mirroring device push
-- (0100): the edge function `email-dispatch` claims a batch, sends it through
-- the mail provider, and reports back; pg_cron wakes it each minute when there
-- is something to send.
--
-- Nothing secret lives here or in the code. The provider's API key is a Vault
-- secret (`email_api_key`), and the dispatcher's shared secret is generated in
-- the database the first time this runs (`email_dispatch_secret`). Until an
-- API key exists, nothing is woken and the queue simply waits.
--
-- The sender and the site address are settings the admin can change:
-- `email_from` (for example: TechMood <hello@example.com>, on a domain
-- verified with the provider) and `site_url`, which turns a notification's
-- path into a link. Mail left unsent for three days is skipped rather than
-- delivered late — a reminder for yesterday's session is noise.
-- =============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('email_from',         '', 'عنوان المرسل للبريد، مثل: TechMood <hello@example.com> — على نطاق موثّق لدى مزوّد البريد'),
  ('site_url',           'https://techmoodtech.vercel.app', 'عنوان المنصة الذي تُبنى منه روابط الرسائل'),
  ('email_dispatch_url', '', 'رابط دالة الإرسال email-dispatch على Supabase')
on conflict (key) do nothing;

-- When the sender took a message, so one it never reported on can be retried.
alter table public.email_outbox add column if not exists claimed_at timestamptz;

create or replace function public.claim_email_batch(p_limit integer default 20)
returns table (id uuid, to_email text, subject text, body_ar text, action_url text)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.email_outbox e
       set status = 'sending', attempts = e.attempts + 1, claimed_at = now()
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

do $vault$
begin
  if to_regnamespace('vault') is not null then
    if not exists (select 1 from vault.secrets where name = 'email_dispatch_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_dispatch_secret');
    end if;
  end if;
end
$vault$;

create or replace function public.email_config()
returns table (api_key text, from_address text, site_url text, dispatch_secret text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regnamespace('vault') is null then
    return query select null::text, null::text, null::text, null::text;
    return;
  end if;
  return query
  select (select decrypted_secret from vault.decrypted_secrets where name = 'email_api_key' limit 1),
         (select nullif(value, '') from public.platform_settings where key = 'email_from'),
         coalesce((select nullif(value, '') from public.platform_settings where key = 'site_url'),
                  'https://techmoodtech.vercel.app'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_secret' limit 1);
end;
$$;

revoke execute on function public.email_config() from public, anon, authenticated;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_email_batch(integer) to service_role;
    grant execute on function public.mark_email_sent(uuid, boolean, text) to service_role;
    grant execute on function public.email_config() to service_role;
  end if;
end
$grants$;

-- Wakes the sender when there is mail, a key to send it with and somewhere to
-- send the request. Without any of the three it does nothing.
create or replace function public.dispatch_email()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  update public.email_outbox
     set status = 'skipped', last_error = 'expired before a sender was available'
   where status = 'queued' and queued_at < now() - interval '3 days';

  -- A batch the sender claimed but never reported on (it timed out or
  -- crashed) goes back to the queue, twice at most, then counts as failed.
  update public.email_outbox
     set status = case when attempts >= 3 then 'failed' else 'queued' end,
         last_error = coalesce(last_error, 'the sender did not report back')
   where status = 'sending' and claimed_at < now() - interval '15 minutes';

  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return false;
  end if;
  if not exists (select 1 from public.email_outbox where status = 'queued') then
    return false;
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_api_key')
     or not exists (select 1 from public.platform_settings where key = 'email_from' and nullif(value, '') is not null) then
    return false;
  end if;

  select nullif(value, '') into v_url from public.platform_settings where key = 'email_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_dispatch_secret' limit 1;
  if v_url is null or v_secret is null then
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 30000
  );
  return true;
end;
$$;

revoke execute on function public.dispatch_email() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-email-dispatch', '* * * * *', $$select public.dispatch_email()$$);
  end if;
end
$migration$;

comment on table public.email_outbox is
  'Queued copies of notifications. Written with the notification itself, so mail can never exist for something that did not happen. Drained by the email-dispatch edge function (0111) once a provider key is in Vault.';
