-- ============================================================================
-- 0162 — Paid courses by mentors, and a sponsored card for them (design lab 5)
--
-- 1. A mentor chooses, for each course they wrote, how it is studied:
--      free          — as today;
--      once          — bought once and kept;
--      subscription  — open while the learner subscribes to that mentor
--                      (one monthly price for all their subscription courses).
--    TechMood's own catalogue stays free. Payment comes from the member's
--    balance (0151), the same path as Premium and session packages. The
--    mentor earns the price less TechMood's share (15%, an admin setting),
--    held for seven days — the refund window — then available to withdraw.
-- 2. What is paid for is closed in the database, not just on the screen: the
--    lessons of a paid course, their videos and their resources are readable
--    only by those who may study it (buyer, subscriber, author, admin). The
--    first lesson stays open as a preview, and anyone can still see the
--    outline — titles, durations — through `course_outline()`. Completing a
--    lesson or handing in work for a paid course needs the same access, so a
--    certificate cannot be had without paying.
-- 3. A mentor can sponsor a published course: a «مُموَّل» card in the academy
--    and on the home page, paid by the day from their balance, stopping by
--    itself when the days run out. Premium members never see it (the ad-free
--    promise), nor do people who already have the course.
-- ============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('course_commission_pct', '15', 'حصة TechMood من سعر الكورس المدفوع أو اشتراك المنتور (٪).'),
  ('course_ad_daily_usd', '2', 'سعر يوم واحد لبطاقة «مُموَّل» لكورس.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Prices, purchases, subscriptions
-- ---------------------------------------------------------------------------
alter table public.courses
  add column price_mode text not null default 'free' check (price_mode in ('free', 'once', 'subscription')),
  add column price_usd  numeric(8,2) check (price_usd is null or price_usd between 1 and 300);

alter table public.lessons
  add column is_preview boolean not null default false;

create table public.mentor_course_plans (
  mentor_id   uuid primary key references public.profiles (id) on delete cascade,
  monthly_usd numeric(8,2) not null check (monthly_usd between 1 and 100),
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.mentor_course_plans enable row level security;
create policy mentor_course_plans_read on public.mentor_course_plans for select to anon, authenticated using (true);
revoke all on public.mentor_course_plans from anon, authenticated;
grant select on public.mentor_course_plans to anon, authenticated;

create table public.course_purchases (
  id         uuid primary key default extensions.gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mentor_id  uuid references public.profiles (id) on delete set null,
  price_usd  numeric(8,2) not null,
  fee_usd    numeric(8,2) not null,
  created_at timestamptz not null default now(),
  unique (course_id, profile_id)
);

create index course_purchases_profile_idx on public.course_purchases (profile_id);
create index course_purchases_mentor_idx on public.course_purchases (mentor_id, created_at desc);

alter table public.course_purchases enable row level security;
create policy course_purchases_parties on public.course_purchases for select to authenticated
  using (profile_id = (select auth.uid()) or mentor_id = (select auth.uid()) or public.is_admin());
revoke all on public.course_purchases from anon, authenticated;
grant select on public.course_purchases to authenticated;

create table public.mentor_subscriptions (
  id         uuid primary key default extensions.gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  from_at    timestamptz not null,
  until      timestamptz not null,
  price_usd  numeric(8,2) not null,
  fee_usd    numeric(8,2) not null,
  created_at timestamptz not null default now()
);

create index mentor_subscriptions_member_idx on public.mentor_subscriptions (profile_id, mentor_id, until desc);
create index mentor_subscriptions_mentor_idx on public.mentor_subscriptions (mentor_id, created_at desc);

alter table public.mentor_subscriptions enable row level security;
create policy mentor_subscriptions_parties on public.mentor_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()) or mentor_id = (select auth.uid()) or public.is_admin());
revoke all on public.mentor_subscriptions from anon, authenticated;
grant select on public.mentor_subscriptions to authenticated;

-- May this person study this course?
create or replace function public.can_study_course(p_course uuid, p_profile uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_who    uuid := coalesce(p_profile, (select auth.uid()));
  v_course record;
begin
  select c.price_mode, c.author_id into v_course from public.courses c where c.id = p_course;
  if v_course.price_mode is null or v_course.price_mode = 'free' then
    return true;
  end if;
  if v_who is null then
    return false;
  end if;
  if v_course.author_id = v_who or public.is_admin() then
    return true;
  end if;
  if v_course.price_mode = 'once' then
    return exists (select 1 from public.course_purchases cp where cp.course_id = p_course and cp.profile_id = v_who);
  end if;
  return exists (select 1 from public.mentor_subscriptions s
                  where s.mentor_id = v_course.author_id and s.profile_id = v_who and s.until > now())
      -- bought before the mentor moved it to a subscription: still theirs
      or exists (select 1 from public.course_purchases cp where cp.course_id = p_course and cp.profile_id = v_who);
end;
$$;

revoke execute on function public.can_study_course(uuid, uuid) from public;
grant execute on function public.can_study_course(uuid, uuid) to anon, authenticated;

-- The gate every lesson row passes: a free course, the preview lesson, or access.
create or replace function public.lesson_unlocked(p_module uuid, p_preview boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_preview or exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
     where m.id = p_module and (c.price_mode = 'free' or public.can_study_course(c.id)));
$$;

create or replace function public.lesson_id_unlocked(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lessons l where l.id = p_lesson
                   and public.lesson_unlocked(l.module_id, l.is_preview));
$$;

revoke execute on function public.lesson_unlocked(uuid, boolean) from public;
grant execute on function public.lesson_unlocked(uuid, boolean) to anon, authenticated;
revoke execute on function public.lesson_id_unlocked(uuid) from public;
grant execute on function public.lesson_id_unlocked(uuid) to anon, authenticated;

create policy lessons_paid_gate on public.lessons as restrictive
  for select to anon, authenticated
  using (public.lesson_unlocked(module_id, is_preview));

create policy lesson_videos_paid_gate on public.lesson_videos as restrictive
  for select to anon, authenticated
  using (public.lesson_id_unlocked(lesson_id));

create policy lesson_resources_paid_gate on public.lesson_resources as restrictive
  for select to anon, authenticated
  using (public.lesson_id_unlocked(lesson_id));

-- The outline anyone can read: what a paid course contains, without its content.
create or replace function public.course_outline(p_course uuid)
returns table (module_id uuid, module_title text, module_order integer, lesson_id uuid, slug text,
               title_ar text, title_en text, kind text, duration_minutes integer, sort_order integer,
               status text, is_preview boolean, unlocked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title_ar, m.sort_order, l.id, l.slug, l.title_ar, l.title_en, l.kind::text,
         l.duration_minutes, l.sort_order, l.status::text, l.is_preview,
         l.is_preview or public.can_study_course(c.id)
    from public.courses c
    join public.modules m on m.course_id = c.id
    join public.lessons l on l.module_id = m.id
   where c.id = p_course
     and c.status in ('published', 'planned')
     and l.status in ('published', 'planned')
   order by m.sort_order, l.sort_order;
$$;

revoke execute on function public.course_outline(uuid) from public;
grant execute on function public.course_outline(uuid) to anon, authenticated;

-- Finishing a lesson, or handing in work, needs the course.
create or replace function public.enforce_paid_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    select m.course_id into v_course from public.lessons l join public.modules m on m.id = l.module_id
     where l.id = new.lesson_id;
    if v_course is not null and not public.can_study_course(v_course, new.profile_id) then
      raise exception 'هذه الدورة مدفوعة — اشترِها أولاً';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_paid_lesson() from public, anon, authenticated;

create trigger lesson_progress_paid_gate
  before insert or update of status on public.lesson_progress
  for each row execute function public.enforce_paid_lesson();

create or replace function public.enforce_paid_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
begin
  select coalesce(a.course_id, m.course_id) into v_course
    from public.assignments a
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
   where a.id = new.assignment_id;
  if v_course is not null and not public.can_study_course(v_course, new.profile_id) then
    raise exception 'هذه الدورة مدفوعة — اشترِها أولاً';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_paid_submission() from public, anon, authenticated;

create trigger submissions_paid_gate
  before insert on public.submissions
  for each row when (new.profile_id is not null)
  execute function public.enforce_paid_submission();

-- The mentor's earning from a sale, held for the refund window.
create or replace function public.course_fee(p_price numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(p_price * least(greatest(coalesce(public.setting_int('course_commission_pct'), 15), 0), 90) / 100.0, 2);
$$;

revoke execute on function public.course_fee(numeric) from public, anon, authenticated;

create or replace function public.set_course_price(p_course uuid, p_mode text, p_price numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_course record;
  v_first  uuid;
begin
  select c.id, c.author_id into v_course from public.courses c where c.id = p_course for update;
  if v_course.id is null then
    raise exception 'الدورة غير موجودة';
  end if;
  if not public.is_admin() and (v_course.author_id is null or v_course.author_id <> v_me) then
    raise exception 'يحدّد السعر كاتب الدورة فقط';
  end if;
  if v_course.author_id is null then
    raise exception 'دورات TechMood نفسها مجانية';
  end if;
  if p_mode not in ('free', 'once', 'subscription') then
    raise exception 'اختر: مجانية، أو شراء مرة واحدة، أو ضمن اشتراكك';
  end if;
  if p_mode = 'once' and (p_price is null or p_price < 1 or p_price > 300) then
    raise exception 'سعر الدورة بين 1 و300 دولار';
  end if;
  if p_mode = 'subscription' and not exists (
       select 1 from public.mentor_course_plans p where p.mentor_id = v_course.author_id and p.is_active) then
    raise exception 'حدّد سعر اشتراكك الشهري أولاً';
  end if;

  update public.courses
     set price_mode = p_mode,
         price_usd = case when p_mode = 'once' then round(p_price, 2) end
   where id = p_course;

  -- the first lesson is the preview of a paid course
  update public.lessons l set is_preview = false
    from public.modules m where m.id = l.module_id and m.course_id = p_course and l.is_preview;
  if p_mode <> 'free' then
    select l.id into v_first from public.lessons l join public.modules m on m.id = l.module_id
     where m.course_id = p_course order by m.sort_order, l.sort_order limit 1;
    update public.lessons set is_preview = true where id = v_first;
  end if;
end;
$$;

revoke execute on function public.set_course_price(uuid, text, numeric) from public, anon;
grant execute on function public.set_course_price(uuid, text, numeric) to authenticated;

create or replace function public.set_course_plan(p_monthly numeric, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not exists (select 1 from public.profile_roles pr
                  where pr.profile_id = v_me and pr.role = 'mentor' and pr.status = 'approved') then
    raise exception 'الاشتراك للمنتورز فقط';
  end if;
  if p_monthly is null or p_monthly < 1 or p_monthly > 100 then
    raise exception 'الاشتراك الشهري بين 1 و100 دولار';
  end if;
  insert into public.mentor_course_plans (mentor_id, monthly_usd, is_active)
  values (v_me, round(p_monthly, 2), coalesce(p_active, true))
  on conflict (mentor_id) do update set monthly_usd = excluded.monthly_usd, is_active = excluded.is_active, updated_at = now();
end;
$$;

revoke execute on function public.set_course_plan(numeric, boolean) from public, anon;
grant execute on function public.set_course_plan(numeric, boolean) to authenticated;

create or replace function public.buy_course(p_course uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_course record;
  v_id     uuid := extensions.gen_random_uuid();
  v_fee    numeric;
begin
  if v_me is null then
    raise exception 'سجّل الدخول أولاً';
  end if;
  select c.id, c.title_ar, c.author_id, c.price_mode, c.price_usd, c.status into v_course
    from public.courses c where c.id = p_course;
  if v_course.id is null or v_course.status <> 'published' then
    raise exception 'الدورة غير متاحة';
  end if;
  if v_course.price_mode <> 'once' or v_course.price_usd is null then
    raise exception 'هذه الدورة لا تُباع بشراء مرة واحدة';
  end if;
  if v_course.author_id = v_me then
    raise exception 'هذه دورتك';
  end if;
  if exists (select 1 from public.course_purchases cp where cp.course_id = p_course and cp.profile_id = v_me) then
    raise exception 'اشتريت هذه الدورة من قبل';
  end if;

  v_fee := public.course_fee(v_course.price_usd);
  perform public.spend_credit(v_me, v_course.price_usd, 'شراء دورة: ' || v_course.title_ar, 'course_purchases', v_id);
  insert into public.course_purchases (id, course_id, profile_id, mentor_id, price_usd, fee_usd)
  values (v_id, p_course, v_me, v_course.author_id, v_course.price_usd, v_fee);
  insert into public.enrollments (profile_id, course_id) values (v_me, p_course)
  on conflict (profile_id, course_id) where course_id is not null do nothing;

  if v_course.author_id is not null then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (v_course.author_id, 'earning', v_course.price_usd - v_fee, 'pending',
            'بيع دورة: ' || v_course.title_ar || ' (تتاح بعد 7 أيام)', 'course_purchases', v_id);
    perform public.notify(v_course.author_id, 'payment', '🎓 بِيعت نسخة من دورتك',
      v_course.title_ar || ' — أُضيف ' || (v_course.price_usd - v_fee) || '$ إلى أرباحك المعلّقة.', '/wallet',
      'course_purchase', v_id);
  end if;
  perform public.notify(v_me, 'payment', '🎓 الدورة لك الآن', v_course.title_ar || ' — ابدأ أول درس.',
    null, 'course_purchase', v_id);
  return v_id;
end;
$$;

revoke execute on function public.buy_course(uuid) from public, anon;
grant execute on function public.buy_course(uuid) to authenticated;

create or replace function public.subscribe_to_mentor(p_mentor uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_plan  record;
  v_from  timestamptz;
  v_until timestamptz;
  v_id    uuid := extensions.gen_random_uuid();
  v_fee   numeric;
  v_name  text;
begin
  if v_me is null then
    raise exception 'سجّل الدخول أولاً';
  end if;
  if p_mentor = v_me then
    raise exception 'لا تشترك في نفسك';
  end if;
  select * into v_plan from public.mentor_course_plans p where p.mentor_id = p_mentor and p.is_active;
  if v_plan.mentor_id is null then
    raise exception 'هذا المنتور لا يقدّم اشتراكاً الآن';
  end if;

  perform pg_advisory_xact_lock(hashtext('mentor-sub:' || v_me::text || p_mentor::text));
  select greatest(now(), coalesce(max(s.until), now())) into v_from
    from public.mentor_subscriptions s where s.mentor_id = p_mentor and s.profile_id = v_me;
  v_until := v_from + interval '1 month';
  v_fee := public.course_fee(v_plan.monthly_usd);
  select coalesce(p.display_name, p.full_name) into v_name from public.profiles p where p.id = p_mentor;

  perform public.spend_credit(v_me, v_plan.monthly_usd, 'اشتراك شهر في كورسات ' || coalesce(v_name, 'منتور'),
                              'mentor_subscriptions', v_id);
  insert into public.mentor_subscriptions (id, mentor_id, profile_id, from_at, until, price_usd, fee_usd)
  values (v_id, p_mentor, v_me, v_from, v_until, v_plan.monthly_usd, v_fee);
  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (p_mentor, 'earning', v_plan.monthly_usd - v_fee, 'pending',
          'اشتراك شهري في كورساتك (يتاح بعد 7 أيام)', 'mentor_subscriptions', v_id);

  perform public.notify(p_mentor, 'payment', '🎓 مشترك جديد في كورساتك',
    'أُضيف ' || (v_plan.monthly_usd - v_fee) || '$ إلى أرباحك المعلّقة.', '/wallet', 'mentor_subscription', v_id);
  perform public.notify(v_me, 'payment', '🎓 اشتراكك فعّال',
    'كورسات ' || coalesce(v_name, 'المنتور') || ' المتاحة بالاشتراك مفتوحة لك حتى '
      || to_char(v_until at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') || '.',
    '/mentors/' || p_mentor::text, 'mentor_subscription', v_id);
  return v_until;
end;
$$;

revoke execute on function public.subscribe_to_mentor(uuid) from public, anon;
grant execute on function public.subscribe_to_mentor(uuid) to authenticated;

-- What a member sees about a course they might pay for.
create or replace function public.course_offer(p_course uuid)
returns table (price_mode text, price_usd numeric, monthly_usd numeric, mentor_id uuid,
               has_access boolean, subscribed_until timestamptz, balance numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.price_mode, c.price_usd, p.monthly_usd, c.author_id,
         public.can_study_course(c.id),
         (select max(s.until) from public.mentor_subscriptions s
           where s.mentor_id = c.author_id and s.profile_id = (select auth.uid()) and s.until > now()),
         case when (select auth.uid()) is null then null else public.credit_balance_of((select auth.uid())) end
    from public.courses c
    left join public.mentor_course_plans p on p.mentor_id = c.author_id and p.is_active
   where c.id = p_course;
$$;

revoke execute on function public.course_offer(uuid) from public;
grant execute on function public.course_offer(uuid) to anon, authenticated;

-- After the refund window, a sale's earning can be withdrawn.
create or replace function public.release_course_earnings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.wallet_entries
     set status = 'available'
   where ref_table in ('course_purchases', 'mentor_subscriptions')
     and kind = 'earning' and status = 'pending'
     and created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.release_course_earnings() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sponsored course cards
-- ---------------------------------------------------------------------------
create table public.course_promotions (
  id          uuid primary key default extensions.gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  mentor_id   uuid not null references public.profiles (id) on delete cascade,
  days        integer not null check (days between 1 and 30),
  daily_usd   numeric(8,2) not null,
  paid_usd    numeric(8,2) not null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  created_at  timestamptz not null default now()
);

create index course_promotions_live_idx on public.course_promotions (ends_at desc);
create index course_promotions_course_idx on public.course_promotions (course_id);
create index course_promotions_mentor_idx on public.course_promotions (mentor_id, created_at desc);

alter table public.course_promotions enable row level security;
create policy course_promotions_own on public.course_promotions for select to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin());
revoke all on public.course_promotions from anon, authenticated;
grant select on public.course_promotions to authenticated;

create or replace function public.promote_course(p_course uuid, p_days integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_course record;
  v_daily  numeric := coalesce(nullif((select value from public.platform_settings where key = 'course_ad_daily_usd'), '')::numeric, 2);
  v_total  numeric;
  v_from   timestamptz;
  v_id     uuid := extensions.gen_random_uuid();
begin
  select c.id, c.title_ar, c.author_id, c.status into v_course from public.courses c where c.id = p_course;
  if v_course.id is null or v_course.author_id is distinct from v_me then
    raise exception 'تُموِّل دوراتك أنت فقط';
  end if;
  if v_course.status <> 'published' then
    raise exception 'موِّل الدورة بعد نشرها';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'مدة التمويل بين يوم و30 يوماً';
  end if;
  v_total := round(v_daily * p_days, 2);

  perform pg_advisory_xact_lock(hashtext('promo:' || p_course::text));
  -- a running sponsorship is extended, not doubled
  select greatest(now(), coalesce(max(p.ends_at), now())) into v_from
    from public.course_promotions p where p.course_id = p_course;

  perform public.spend_credit(v_me, v_total, 'تمويل دورة ' || p_days || ' يوماً: ' || v_course.title_ar,
                              'course_promotions', v_id);
  insert into public.course_promotions (id, course_id, mentor_id, days, daily_usd, paid_usd, starts_at, ends_at)
  values (v_id, p_course, v_me, p_days, v_daily, v_total, v_from, v_from + make_interval(days => p_days));
  return v_id;
end;
$$;

revoke execute on function public.promote_course(uuid, integer) from public, anon;
grant execute on function public.promote_course(uuid, integer) to authenticated;

-- One sponsored course for this viewer, counted as seen; nothing for Premium.
create or replace function public.sponsored_course()
returns table (promotion_id uuid, course_id uuid, course_slug text, path_slug text, title_ar text,
               description_ar text, mentor_name text, price_mode text, price_usd numeric)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_pick uuid;
begin
  if v_me is not null and public.is_premium(v_me) then
    return;
  end if;
  select p.id into v_pick
    from public.course_promotions p
    join public.courses c on c.id = p.course_id
   where now() between p.starts_at and p.ends_at
     and c.status = 'published'
     and (v_me is null or (c.author_id is distinct from v_me
          and not (c.price_mode <> 'free' and public.can_study_course(c.id, v_me))
          and not exists (select 1 from public.enrollments e where e.profile_id = v_me and e.course_id = c.id)))
   order by random()
   limit 1;
  if v_pick is null then
    return;
  end if;
  update public.course_promotions set impressions = impressions + 1 where id = v_pick;

  return query
  select p.id, c.id, c.slug,
         (select lp.slug from public.path_courses pc join public.learning_paths lp on lp.id = pc.path_id
           where pc.course_id = c.id order by lp.status = 'published' desc, pc.sort_order limit 1),
         c.title_ar, c.description_ar, coalesce(pr.display_name, pr.full_name), c.price_mode, c.price_usd
    from public.course_promotions p
    join public.courses c on c.id = p.course_id
    left join public.profiles pr on pr.id = c.author_id
   where p.id = v_pick;
end;
$$;

revoke execute on function public.sponsored_course() from public;
grant execute on function public.sponsored_course() to anon, authenticated;

create or replace function public.sponsored_click(p_promotion uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.course_promotions set clicks = clicks + 1
   where id = p_promotion and now() between starts_at and ends_at;
$$;

revoke execute on function public.sponsored_click(uuid) from public;
grant execute on function public.sponsored_click(uuid) to anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-course-earnings', '25 3 * * *', $$select public.release_course_earnings()$$);
  end if;
end
$migration$;
