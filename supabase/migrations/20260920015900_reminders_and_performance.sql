-- ============================================================================
-- 0159 — a nudge for unfinished sign-ups, and an index for every foreign key
--
-- 1. Members who signed up but never finished setting up their account get
--    up to two emails: a day after signing up, and again three days after
--    that. Nothing is queued while no mail provider key exists — so the
--    reminders go out at the right moment once one is added, rather than
--    expiring unseen in the outbox.
-- 2. Every foreign key gets an index (the advisor counted 188 without one).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reminders
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_reminders (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stage      smallint not null check (stage in (1, 2)),
  sent_at    timestamptz not null default now(),
  primary key (profile_id, stage)
);

alter table public.onboarding_reminders enable row level security;
revoke all on public.onboarding_reminders from anon, authenticated;

create or replace function public.onboarding_reminders_run()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_stage smallint;
  v_sent  integer := 0;
  v_site  text;
  v_has_key boolean;
begin
  -- No provider, no email: wait for one rather than queue mail that expires.
  if to_regclass('vault.decrypted_secrets') is null then
    return 0;
  end if;
  execute $q$select exists (select 1 from vault.decrypted_secrets
                             where name = 'email_api_key' and nullif(decrypted_secret, '') is not null)$q$
     into v_has_key;
  if not v_has_key then
    return 0;
  end if;
  v_site := coalesce((select nullif(value, '') from public.platform_settings where key = 'site_url'), 'https://techmoodtech.vercel.app');

  for v_row in
    select p.id, u.email, coalesce(p.display_name, nullif(p.full_name, '')) as name, p.created_at,
           (select max(o.stage) from public.onboarding_reminders o where o.profile_id = p.id) as last_stage,
           (select max(o.sent_at) from public.onboarding_reminders o where o.profile_id = p.id) as last_sent
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.onboarding_completed_at is null
       and u.email is not null
       and p.created_at < now() - interval '1 day'
       and p.created_at > now() - interval '14 days'
  loop
    v_stage := case
      when v_row.last_stage is null then 1
      when v_row.last_stage = 1 and v_row.last_sent < now() - interval '3 days' then 2
    end;
    continue when v_stage is null;

    insert into public.email_outbox (profile_id, to_email, subject, body_ar, action_url)
    values (
      v_row.id, v_row.email,
      case when v_stage = 1 then 'خطوة واحدة وحسابك في TechMood جاهز'
           else 'ما زال مكانك محفوظاً في TechMood' end,
      case when v_stage = 1
           then 'أهلاً' || coalesce(' ' || v_row.name, '') || '،' || chr(10) || chr(10)
                || 'بدأت التسجيل في TechMood ولم تُكمل إعداد حسابك بعد. يأخذ دقيقتين: اسمك، وهدفك، ومجالاتك — ثم نرشّح لك مساراً تبدأ به مجاناً.'
           else 'أهلاً' || coalesce(' ' || v_row.name, '') || '،' || chr(10) || chr(10)
                || 'حسابك ينتظرك: مسارات ودورات مجانية، ومشاريع مع فرق، ومنتورز يراجعون عملك. أكمل الإعداد وابدأ أول درس اليوم.' end,
      v_site || '/onboarding'
    );
    insert into public.onboarding_reminders (profile_id, stage) values (v_row.id, v_stage);
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.onboarding_reminders_run() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-onboarding-reminders', '40 16 * * *', $$select public.onboarding_reminders_run()$$);
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 2. An index for every foreign key
-- ---------------------------------------------------------------------------
do $indexes$
declare
  v_fk record;
begin
  for v_fk in
    select c.conrelid::regclass as tbl, c.conname,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
      from pg_constraint c
     where c.contype = 'f'
       and c.connamespace = 'public'::regnamespace
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and i.indkey[0] = c.conkey[1]
            and c.conkey::int2[] <@ i.indkey::int2[])
  loop
    execute format('create index if not exists %I on %s (%s)', left(v_fk.conname, 59) || '_idx', v_fk.tbl, v_fk.cols);
  end loop;
end
$indexes$;
