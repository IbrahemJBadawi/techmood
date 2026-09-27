-- =============================================================================
-- 0077 — A mentor's own price, within their level; a mentor's own "not now"
--
-- Two things mentors did not control, and one gap behind them.
--
-- **Price.** Every mentor of a level charged the level's one price. The spec:
-- each level has a limit, and within it the mentor sets their own price, up or
-- down, with TechMood's share worked out by the platform's commission — for
-- every kind of session and every way it is booked (a learner, a team, a
-- company). So a level now has a floor, a ceiling and a commission percentage,
-- a mentor may price each session type inside that band, and one function —
-- `session_quote()` — is the only place a session's price and its split are
-- decided. A trigger applies it to every booking that names a session type, so
-- no booking path can charge anything else.
--
-- **"Not now".** `is_accepting` existed and nothing in the interface set it.
-- A mentor can now stop taking requests — for now, or until a date — and
-- start again whenever they like.
--
-- **The gap:** a request that reached the mentor *after the learner had paid*
-- waited for an answer forever. Nothing expired it; the learner's money sat
-- behind a mentor who might never look. A request now carries a deadline; past
-- it, it is declined on the mentor's behalf (and joins the refunds TechMood
-- owes), and a mentor who lets requests lapse repeatedly stops receiving them
-- until they switch themselves back on — which only they, or an admin, can do.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Each level: a band, and TechMood's percentage
-- ---------------------------------------------------------------------------
alter table public.mentor_levels
  add column min_session_usd numeric(8,2),
  add column max_session_usd numeric(8,2),
  add column commission_pct  numeric(5,2);

-- The band around each level's existing price, and the percentage its fixed
-- split already implied — so every price and split that existed yesterday is
-- exactly what the new rule produces today.
update public.mentor_levels set
  min_session_usd = case level when 'L1' then 10 when 'L2' then 15 when 'L3' then 25
                               when 'L4' then 35 when 'L5' then 50 else 70 end,
  max_session_usd = case level when 'L1' then 20 when 'L2' then 35 when 'L3' then 50
                               when 'L4' then 70 when 'L5' then 100 else 150 end,
  commission_pct  = round(platform_share_usd * 100 / session_price_usd, 2);

alter table public.mentor_levels
  alter column min_session_usd set not null,
  alter column max_session_usd set not null,
  alter column commission_pct  set not null,
  add constraint mentor_levels_band_ordered
    check (min_session_usd > 0 and min_session_usd <= session_price_usd and session_price_usd <= max_session_usd),
  add constraint mentor_levels_commission_sane
    check (commission_pct >= 0 and commission_pct <= 60);

comment on column public.mentor_levels.session_price_usd is
  'The default price of a 60-minute session at this level, used until a mentor sets their own. The band is min..max, also per 60 minutes, scaled by the session''s length.';

-- A mentor's own price for one kind of session. Null means "the level's default".
alter table public.mentor_session_types
  add column price_usd numeric(8,2) check (price_usd is null or price_usd > 0);

-- ---------------------------------------------------------------------------
-- 2. The one place a session is priced
-- ---------------------------------------------------------------------------
create or replace function public.session_quote(p_mentor uuid, p_session_type uuid)
returns table (
  price_usd          numeric,
  platform_share_usd numeric,
  mentor_share_usd   numeric,
  min_usd            numeric,
  max_usd            numeric,
  default_usd        numeric,
  commission_pct     numeric,
  duration_minutes   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select lv.commission_pct,
           st.duration_minutes,
           round(lv.min_session_usd   * st.duration_minutes / 60.0, 2) as lo,
           round(lv.max_session_usd   * st.duration_minutes / 60.0, 2) as hi,
           round(lv.session_price_usd * st.duration_minutes / 60.0, 2) as dflt,
           mst.price_usd as own
      from public.mentor_profiles mp
      join public.mentor_levels lv on lv.level = mp.level
      cross join public.session_types st
      left join public.mentor_session_types mst
             on mst.mentor_id = mp.profile_id and mst.session_type_id = st.id
     where mp.profile_id = p_mentor and st.id = p_session_type
  ),
  -- a price set before the admin moved the band is held to the band, not
  -- charged outside it
  priced as (
    select *, least(greatest(coalesce(own, dflt), lo), hi) as price from base
  )
  select price,
         round(price * commission_pct / 100, 2),
         price - round(price * commission_pct / 100, 2),
         lo, hi, dflt, commission_pct, duration_minutes
    from priced;
$$;

grant execute on function public.session_quote(uuid, uuid) to anon, authenticated;

-- Every booking that names a kind of session is priced here, whichever
-- function wrote it and however many seats it has. The functions still write
-- their own figures; this is what makes them irrelevant, so a new booking path
-- cannot charge by a rule of its own.
create or replace function public.price_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote record;
begin
  if new.session_type_id is null then
    return new;
  end if;

  select * into v_quote from public.session_quote(new.mentor_id, new.session_type_id);
  if not found then
    return new;
  end if;

  new.price_usd          := v_quote.price_usd * greatest(new.seats, 1);
  new.platform_share_usd := v_quote.platform_share_usd * greatest(new.seats, 1);
  new.mentor_share_usd   := v_quote.mentor_share_usd * greatest(new.seats, 1);
  return new;
end;
$$;

create trigger bookings_price
  before insert on public.bookings
  for each row execute function public.price_booking();

-- The payment row is written by the same functions from their own figures;
-- keep it equal to what the booking now says.
create or replace function public.price_booking_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_id is not null then
    select b.price_usd into new.amount_usd from public.bookings b where b.id = new.booking_id;
  end if;
  return new;
end;
$$;

create trigger payments_price_from_booking
  before insert on public.payments
  for each row execute function public.price_booking_payment();

-- A mentor pricing one kind of session. Null goes back to the level's default.
create or replace function public.set_session_price(p_session_type uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_quote record;
begin
  if not exists (select 1 from public.mentor_profiles mp where mp.profile_id = v_me) then
    raise exception 'التسعير للمنتورز فقط';
  end if;

  select * into v_quote from public.session_quote(v_me, p_session_type);
  if not found then
    raise exception 'نوع الجلسة غير موجود';
  end if;

  if p_price is not null and (p_price < v_quote.min_usd or p_price > v_quote.max_usd) then
    raise exception 'السعر خارج حدود مستواك لهذه الجلسة: من % إلى % دولار', v_quote.min_usd, v_quote.max_usd;
  end if;

  insert into public.mentor_session_types (mentor_id, session_type_id, is_active, price_usd)
  values (v_me, p_session_type, true, p_price)
  on conflict (mentor_id, session_type_id) do update set price_usd = excluded.price_usd;
end;
$$;

grant execute on function public.set_session_price(uuid, numeric) to authenticated;

-- What a mentor charges, for their page and for their own pricing screen.
create or replace function public.mentor_price_list(p_mentor uuid)
returns table (
  session_type_id uuid,
  name_ar         text,
  name_en         text,
  duration_minutes integer,
  price_usd       numeric,
  mentor_share_usd numeric,
  min_usd         numeric,
  max_usd         numeric,
  default_usd     numeric,
  is_custom       boolean,
  is_active       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.name_ar, st.name_en, st.duration_minutes,
         q.price_usd, q.mentor_share_usd, q.min_usd, q.max_usd, q.default_usd,
         mst.price_usd is not null, coalesce(mst.is_active, false)
    from public.session_types st
    left join public.mentor_session_types mst
           on mst.session_type_id = st.id and mst.mentor_id = p_mentor
    cross join lateral public.session_quote(p_mentor, st.id) q
   where st.is_active
   order by st.sort_order;
$$;

grant execute on function public.mentor_price_list(uuid) to anon, authenticated;

-- The admin sets a level's band, default and percentage in one call, and the
-- fixed split columns follow so nothing reading them is left behind.
create or replace function public.save_mentor_level(
  p_level          public.mentor_level,
  p_default_usd    numeric,
  p_min_usd        numeric,
  p_max_usd        numeric,
  p_commission_pct numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform numeric := round(p_default_usd * p_commission_pct / 100, 2);
begin
  if not public.is_admin() then
    raise exception 'التسعير للإدارة فقط';
  end if;

  update public.mentor_levels
     set session_price_usd  = p_default_usd,
         min_session_usd    = p_min_usd,
         max_session_usd    = p_max_usd,
         commission_pct     = p_commission_pct,
         platform_share_usd = v_platform,
         mentor_share_usd   = p_default_usd - v_platform
   where level = p_level;
end;
$$;

grant execute on function public.save_mentor_level(public.mentor_level, numeric, numeric, numeric, numeric) to authenticated;

-- The market's brackets, editable the same way.
create or replace function public.save_commission_tier(
  p_kind text, p_min_amount numeric, p_rate numeric, p_note text default null, p_remove boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'التسعير للإدارة فقط';
  end if;

  if p_remove then
    if p_min_amount = 0 then
      raise exception 'الشريحة الأولى (من صفر) لا تُحذف — كل مبلغ يحتاج نسبة';
    end if;
    delete from public.commission_tiers where kind = p_kind and min_amount_usd = p_min_amount;
    return;
  end if;

  insert into public.commission_tiers (kind, min_amount_usd, rate_percent, note_ar)
  values (p_kind, p_min_amount, p_rate, p_note)
  on conflict (kind, min_amount_usd) do update
    set rate_percent = excluded.rate_percent, note_ar = coalesce(excluded.note_ar, public.commission_tiers.note_ar);
end;
$$;

grant execute on function public.save_commission_tier(text, numeric, numeric, text, boolean) to authenticated;

create or replace function public.save_platform_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'الإعدادات للإدارة فقط';
  end if;

  update public.platform_settings set value = p_value where key = p_key;
  if not found then
    raise exception 'إعداد غير معروف: %', p_key;
  end if;
end;
$$;

grant execute on function public.save_platform_setting(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. "Not now", said by the mentor
-- ---------------------------------------------------------------------------
alter table public.mentor_profiles
  add column pause_reason   text check (pause_reason in ('manual', 'vacation', 'unresponsive')),
  add column paused_until   date,
  add column pause_note_ar  text,
  add column paused_at      timestamptz,
  -- when requests were last switched back on: lapses before it are forgiven
  add column accepting_since timestamptz not null default now();

create or replace function public.set_mentor_accepting(
  p_accepting boolean,
  p_until     date default null,
  p_note      text default null,
  p_mentor    uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_mentor, (select auth.uid()));
begin
  -- A mentor switches themselves; an admin may switch anyone.
  if v_target <> (select auth.uid()) and not public.is_admin() then
    raise exception 'المنتور وحده من يغيّر استقباله للطلبات';
  end if;

  if not exists (select 1 from public.mentor_profiles mp where mp.profile_id = v_target) then
    raise exception 'ليس ملف منتور';
  end if;

  if p_until is not null and p_until < current_date then
    raise exception 'تاريخ العودة يجب أن يكون اليوم أو بعده';
  end if;

  if p_accepting then
    update public.mentor_profiles
       set is_accepting = true, pause_reason = null, paused_until = null,
           pause_note_ar = null, paused_at = null, accepting_since = now()
     where profile_id = v_target;
  else
    update public.mentor_profiles
       set is_accepting = false,
           pause_reason = case when p_until is not null then 'vacation' else 'manual' end,
           paused_until = p_until,
           pause_note_ar = nullif(btrim(coalesce(p_note, '')), ''),
           paused_at = now()
     where profile_id = v_target;
  end if;
end;
$$;

grant execute on function public.set_mentor_accepting(boolean, date, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. A request that reached the mentor has a deadline
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('mentor_response_hours',   '48', 'المهلة التي يردّ فيها المنتور على طلب مدفوع قبل أن يُعتذر عنه تلقائياً'),
  ('mentor_unanswered_limit', '3',  'عدد الطلبات التي تنتهي مهلتها دون ردّ قبل إيقاف استقبال المنتور للطلبات')
on conflict (key) do nothing;

alter table public.bookings
  add column mentor_respond_by timestamptz,
  add column auto_declined     boolean not null default false;

create or replace function public.set_mentor_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'mentor_pending' and old.status is distinct from 'mentor_pending' then
    -- the sooner of: the response window, or two hours before the session —
    -- but never less than an hour from now
    new.mentor_respond_by := greatest(
      now() + interval '1 hour',
      least(now() + (coalesce(public.setting_int('mentor_response_hours'), 48) || ' hours')::interval,
            new.scheduled_start - interval '2 hours'));
  end if;
  return new;
end;
$$;

create trigger bookings_mentor_deadline
  before update of status on public.bookings
  for each row execute function public.set_mentor_deadline();

-- Run on a schedule, like expire_stale_bookings(). Idempotent.
create or replace function public.mentor_request_housekeeping()
returns table (declined integer, paused integer, resumed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_declined integer := 0;
  v_paused   integer := 0;
  v_resumed  integer := 0;
  v_limit    integer := coalesce(public.setting_int('mentor_unanswered_limit'), 3);
  v_row      record;
begin
  -- 1. Requests nobody answered in time are declined on the mentor's behalf.
  --    Declined is where a paid booking waits for its refund.
  for v_row in
    update public.bookings
       set status = 'rejected',
           auto_declined = true,
           mentor_decided_at = now(),
           cancelled_reason = 'انتهت مهلة ردّ المنتور'
     where status = 'mentor_pending' and mentor_respond_by < now()
    returning id, student_id, mentor_id, booking_code
  loop
    v_declined := v_declined + 1;
    perform public.notify(v_row.student_id, 'booking', 'لم يردّ المنتور على طلبك',
      'أُلغي الطلب ' || v_row.booking_code || ' ويُعاد لك المبلغ.', '/bookings', 'booking', v_row.id, 'important');
    perform public.notify(v_row.mentor_id, 'booking', 'انتهت مهلة طلب دون ردّ',
      'الطلب ' || v_row.booking_code || ' أُلغي تلقائياً.', '/mentor-requests', 'booking', v_row.id);
  end loop;

  -- 2. A mentor who keeps letting requests lapse stops receiving them, until
  --    they switch themselves back on. Lapses from before their last switch-on
  --    are forgiven, so switching back on is a fresh start, not a trap.
  for v_row in
    select mp.profile_id
      from public.mentor_profiles mp
     where mp.is_accepting
       and (select count(*) from public.bookings b
             where b.mentor_id = mp.profile_id and b.auto_declined
               and b.mentor_decided_at > mp.accepting_since
               and b.mentor_decided_at > now() - interval '30 days') >= v_limit
  loop
    update public.mentor_profiles
       set is_accepting = false, pause_reason = 'unresponsive', paused_at = now(),
           paused_until = null,
           pause_note_ar = 'أُوقف الاستقبال تلقائياً بعد ' || v_limit || ' طلبات انتهت مهلتها دون ردّ'
     where profile_id = v_row.profile_id;
    v_paused := v_paused + 1;
    perform public.notify(v_row.profile_id, 'booking', 'أُوقف استقبالك للطلبات',
      'انتهت مهلة ' || v_limit || ' طلبات دون ردّ. فعّل الاستقبال من صفحة طلباتك متى كنت جاهزاً.',
      '/mentor-requests', null, null, 'important');
  end loop;

  -- 3. A holiday with an end date ends by itself.
  with back as (
    update public.mentor_profiles
       set is_accepting = true, pause_reason = null, paused_until = null,
           pause_note_ar = null, paused_at = null, accepting_since = now()
     where pause_reason = 'vacation' and paused_until < current_date
    returning profile_id
  )
  select count(*)::int into v_resumed from back;

  return query select v_declined, v_paused, v_resumed;
end;
$$;

revoke execute on function public.mentor_request_housekeeping() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Money TechMood owes back
--
-- A paid booking the mentor declined — or that was declined for them — waits
-- for a refund, and nothing listed it. It does now, on the admin's picture.
-- ---------------------------------------------------------------------------
create or replace function public.refunds_owed()
returns table (
  booking_id   uuid,
  booking_code text,
  student_name text,
  mentor_name  text,
  amount_usd   numeric,
  reason_ar    text,
  auto_declined boolean,
  since        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.booking_code,
         (select coalesce(p.display_name, p.full_name) from public.profiles p where p.id = b.student_id),
         (select coalesce(p.display_name, p.full_name) from public.profiles p where p.id = b.mentor_id),
         pay.amount_usd, b.cancelled_reason, b.auto_declined, coalesce(b.mentor_decided_at, b.updated_at)
    from public.bookings b
    join public.payments pay on pay.booking_id = b.id and pay.status = 'verified'
   where b.status in ('rejected', 'cancelled')
     and public.is_admin()
   order by 8;
$$;

grant execute on function public.refunds_owed() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The switch stays coherent however it is flipped
--
-- A mentor may update their own row (0006), so is_accepting can be flipped
-- without set_mentor_accepting(). Whichever way it is flipped, switching on
-- is a fresh start and switching off records why; a client cannot claim the
-- platform's own reason ("unresponsive"), nor move accepting_since to wipe
-- lapses without actually switching back on.
-- ---------------------------------------------------------------------------
create or replace function public.guard_mentor_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted writers pass: an admin, another trigger, and the platform's own
  -- jobs, which do not run under a signed-in role — so
  -- mentor_request_housekeeping() can record "unresponsive". (current_user is
  -- this function's owner here; the session's role setting is the caller's.)
  if public.is_admin() or pg_trigger_depth() > 1
     or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  new.level          := old.level;
  new.sessions_count := old.sessions_count;
  new.rating_avg     := old.rating_avg;
  new.approved_at    := old.approved_at;

  if new.is_accepting and not old.is_accepting then
    new.pause_reason    := null;
    new.paused_until    := null;
    new.pause_note_ar   := null;
    new.paused_at       := null;
    new.accepting_since := now();
  else
    new.accepting_since := old.accepting_since;
    if not new.is_accepting and old.is_accepting then
      new.paused_at := now();
      if new.pause_reason is null or new.pause_reason = 'unresponsive' then
        new.pause_reason := case when new.paused_until is not null then 'vacation' else 'manual' end;
      end if;
    elsif new.pause_reason is distinct from old.pause_reason and new.pause_reason = 'unresponsive' then
      new.pause_reason := old.pause_reason;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_mentor_profile_columns() from public, anon, authenticated;
