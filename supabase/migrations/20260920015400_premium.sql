-- ============================================================================
-- 0154 — TechMood Premium, a paid verified membership (design lab 4: «مثل
-- Telegram Premium»)
--
-- A member subscribes for a month or a year, paid from their balance (0151);
-- there is no automatic renewal — a reminder three days before it ends, and
-- they renew if they want. What it gives, each enforced where it lives:
--   * a Premium badge next to their name, on their profile and in lists;
--   * more questions to the assistant a day (setting ai_daily_messages_premium,
--     150 to start, instead of ai_daily_messages);
--   * a featured place: first among the talent in the market, and among the
--     people suggested to follow;
--   * TechMood shows no advertising to anyone today; Premium members are
--     promised it stays that way for them.
--
-- Who is Premium is public, like a badge; the membership row is written only
-- by `subscribe_premium()`.
-- ============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('premium_monthly_usd', '5', 'سعر TechMood Premium لشهر بالدولار.'),
  ('premium_yearly_usd', '48', 'سعر TechMood Premium لسنة بالدولار.'),
  ('ai_daily_messages_premium', '150', 'أسئلة المساعد الذكي في اليوم لأعضاء Premium.')
on conflict (key) do nothing;

create table public.premium_memberships (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  until      timestamptz not null,
  since      timestamptz not null default now(),
  reminded_at timestamptz
);

alter table public.premium_memberships enable row level security;
create policy premium_memberships_read on public.premium_memberships for select to anon, authenticated using (true);
revoke all on public.premium_memberships from anon, authenticated;
grant select (profile_id, until, since) on public.premium_memberships to anon, authenticated;

create table public.premium_purchases (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan       text not null check (plan in ('month', 'year')),
  paid_usd   numeric(8,2) not null check (paid_usd > 0),
  from_at    timestamptz not null,
  until      timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.premium_purchases enable row level security;
create policy premium_purchases_own on public.premium_purchases
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.premium_purchases from anon, authenticated;
grant select on public.premium_purchases to authenticated;

create or replace function public.is_premium(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.premium_memberships m where m.profile_id = p_profile and m.until > now());
$$;

revoke execute on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to anon, authenticated;

-- The offer: both plans and their prices, and where I stand.
create or replace function public.premium_offer()
returns table (monthly_usd numeric, yearly_usd numeric, my_until timestamptz, ai_daily integer, ai_daily_premium integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nullif(value, '')::numeric from public.platform_settings where key = 'premium_monthly_usd'), 5),
         coalesce((select nullif(value, '')::numeric from public.platform_settings where key = 'premium_yearly_usd'), 48),
         (select m.until from public.premium_memberships m where m.profile_id = (select auth.uid()) and m.until > now()),
         coalesce((select nullif(value, '')::integer from public.platform_settings where key = 'ai_daily_messages'), 40),
         coalesce((select nullif(value, '')::integer from public.platform_settings where key = 'ai_daily_messages_premium'), 150);
$$;

revoke execute on function public.premium_offer() from public, anon;
grant execute on function public.premium_offer() to authenticated;

-- Subscribing (or renewing): paid from the balance, added to what is left.
create or replace function public.subscribe_premium(p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_price numeric;
  v_from  timestamptz;
  v_until timestamptz;
  v_id    uuid := extensions.gen_random_uuid();
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_plan not in ('month', 'year') then
    raise exception 'الخطة شهرية أو سنوية';
  end if;
  select case when p_plan = 'month' then monthly_usd else yearly_usd end into v_price from public.premium_offer();

  perform pg_advisory_xact_lock(hashtext('premium:' || v_me::text));
  perform public.spend_credit(v_me, v_price, 'TechMood Premium — ' || case when p_plan = 'month' then 'شهر' else 'سنة' end,
                              'premium_purchases', v_id);

  select greatest(now(), coalesce((select until from public.premium_memberships where profile_id = v_me), now()))
    into v_from;
  v_until := v_from + case when p_plan = 'month' then interval '1 month' else interval '1 year' end;

  insert into public.premium_memberships (profile_id, until) values (v_me, v_until)
  on conflict (profile_id) do update
    set until = excluded.until, reminded_at = null,
        since = case when public.premium_memberships.until < now() then now() else public.premium_memberships.since end;
  insert into public.premium_purchases (id, profile_id, plan, paid_usd, from_at, until)
  values (v_id, v_me, p_plan, v_price, v_from, v_until);

  perform public.notify(v_me, 'payment', '✦ أصبحت عضواً في TechMood Premium',
    'شارتك ومزاياك فعّالة حتى ' || to_char(v_until at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') || '.', '/premium');
  return v_until;
end;
$$;

revoke execute on function public.subscribe_premium(text) from public, anon;
grant execute on function public.subscribe_premium(text) to authenticated;

-- Three days before it ends: one reminder, no automatic charge.
create or replace function public.premium_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_sent integer := 0;
begin
  for v_row in
    select profile_id, until from public.premium_memberships
     where reminded_at is null and until between now() and now() + interval '3 days'
     for update skip locked
  loop
    perform public.notify(v_row.profile_id, 'payment', 'تنتهي عضوية Premium خلال 3 أيام',
      'جدّدها من صفحة Premium إن أردت — لا نخصم شيئاً تلقائياً.', '/premium');
    update public.premium_memberships set reminded_at = now() where profile_id = v_row.profile_id;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.premium_reminders() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-premium-reminders', '20 7 * * *', $$select public.premium_reminders()$$);
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- The perks, where they live
-- ---------------------------------------------------------------------------
-- More questions to the assistant a day.
create or replace function public.ai_daily_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_used  integer;
begin
  if new.role <> 'user' then
    return new;
  end if;
  select profile_id into v_owner from public.ai_threads where id = new.thread_id;
  if v_owner is null or public.is_admin() then
    return new;
  end if;

  if public.is_premium(v_owner) then
    select coalesce(nullif(value, '')::integer, 150) into v_limit
      from public.platform_settings where key = 'ai_daily_messages_premium';
    v_limit := coalesce(v_limit, 150);
  else
    select coalesce(nullif(value, '')::integer, 40) into v_limit
      from public.platform_settings where key = 'ai_daily_messages';
    v_limit := coalesce(v_limit, 40);
  end if;

  select count(*) into v_used
    from public.ai_messages m
    join public.ai_threads t on t.id = m.thread_id
   where t.profile_id = v_owner
     and m.role = 'user'
     and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem');

  if v_used >= v_limit then
    raise exception 'بلغت حدّ أسئلة المساعد لهذا اليوم (%). يتجدد غداً.', v_limit;
  end if;
  return new;
end;
$$;

-- Featured: Premium members first among the talent in the market…
create or replace function public.market_talent(p_search text default null, p_skill text default null, p_limit integer default 24)
returns table (profile_id uuid, techmood_id text, full_name text, headline text, avatar_url text, rate_kind text,
               rate_min_usd numeric, rate_max_usd numeric, stars_avg numeric, total_xp integer, skills text[],
               projects integer, certificates integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.techmood_id,
         p.full_name,
         coalesce(fp.headline_ar, p.headline),
         p.avatar_url,
         fp.rate_kind,
         fp.rate_min_usd,
         fp.rate_max_usd,
         coalesce((select ps.stars_avg from public.profile_stars ps where ps.profile_id = p.id), 0),
         coalesce((select px.total_xp from public.profile_xp px where px.profile_id = p.id), 0),
         coalesce((
           select array_agg(s.name_ar order by s.name_ar)
             from public.profile_skills psk
             join public.skills s on s.id = psk.skill_id
            where psk.profile_id = p.id
         ), '{}'),
         (select count(*)::int from public.profile_exhibition_entries(p.id)),
         (select count(*)::int from public.certificates c
           where c.profile_id = p.id and c.status = 'active')
    from public.freelancer_profiles fp
    join public.profiles p on p.id = fp.profile_id
   where fp.is_available
     and (p_search is null or p_search = ''
          or p.full_name ilike '%' || p_search || '%'
          or coalesce(fp.headline_ar, p.headline, '') ilike '%' || p_search || '%')
     and (p_skill is null or p_skill = '' or exists (
       select 1 from public.profile_skills psk
         join public.skills s on s.id = psk.skill_id
        where psk.profile_id = p.id
          and (s.slug = p_skill or s.name_ar = p_skill or s.name_en = p_skill)
     ))
   order by public.is_premium(p.id) desc,
            coalesce((select ps.stars_avg from public.profile_stars ps where ps.profile_id = p.id), 0) desc,
            p.full_name
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

-- …and among the people suggested to follow.
create or replace function public.suggested_people(p_limit integer default 12)
returns table (techmood_id text, name text, avatar_url text, headline text, xp integer, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select f.followee_id as id from public.follows f
     where f.follower_id = (select auth.uid()) and f.active
  ),
  cand as (
    select pr.id, pr.techmood_id, coalesce(pr.display_name, pr.full_name) as name,
           pr.avatar_url, pr.headline,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = pr.id and x.created_at >= date_trunc('week', now())), 0)::int as xp,
           coalesce((select count(*) from public.lesson_progress lp
                      where lp.profile_id = pr.id and lp.status = 'completed'
                        and lp.completed_at > now() - interval '45 days'), 0) as recent,
           coalesce((select count(*) from public.follows f
                      where f.followee_id = pr.id and f.active), 0)::int as followers,
           public.is_premium(pr.id) as premium
      from public.profiles pr
     where pr.is_public
       and pr.id <> (select auth.uid())
       and pr.id not in (select id from mine)
  )
  select techmood_id, name, avatar_url, headline, xp, followers
    from cand
   order by premium desc, (recent > 0) desc, xp desc, recent desc, followers desc, random()
   limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;
