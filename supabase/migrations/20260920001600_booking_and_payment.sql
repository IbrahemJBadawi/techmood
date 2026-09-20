-- =============================================================================
-- TechMood — 0016 Booking and payment
--
-- Three separate state machines, deliberately not collapsed into one:
--
--   SLOT     available / pending / booked / unavailable   (derived, see below)
--   BOOKING  payment_pending -> payment_submitted -> payment_verified
--            -> mentor_pending -> confirmed -> completed
--   PAYMENT  pending -> under_review -> verified | rejected | failed | refunded
--
-- Keeping them apart is what makes "paid but the mentor has not accepted yet"
-- and "the mentor accepted but the payment is not verified" both expressible
-- and both visible, instead of collapsing into a single misleading flag.
--
-- Slots are DERIVED, never materialised. A slot is a function of the mentor's
-- availability rules, their time off, and the live bookings that overlap it.
-- A "pending reservation" is simply a booking in payment_pending with a
-- reserved_until in the future — so there is one source of truth for whether a
-- slot is taken, and no second table to drift out of sync.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Platform settings: the numbers the product spec leaves adjustable
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key           text primary key,
  value         text not null,
  description_ar text
);

insert into public.platform_settings (key, value, description_ar) values
  ('booking_min_notice_hours',    '72', 'أقل مهلة بين وقت الطلب وبداية الجلسة، لإتاحة وقت لمراجعة الدفع'),
  ('booking_reservation_minutes', '45', 'مدة حجز الموعد مؤقتاً ريثما يكمل الطالب الدفع'),
  ('receipt_max_bytes',      '5242880', 'أقصى حجم لإيصال الدفع (5 ميغابايت)');

create or replace function public.setting_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select value::integer from public.platform_settings where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Student contact details the booking summary shows back to them
-- ---------------------------------------------------------------------------
alter table public.profiles add column phone text;

-- ---------------------------------------------------------------------------
-- Session types. The TYPE decides what the session is for and how long it runs;
-- the mentor's LEVEL decides what it costs. Price never comes from the client.
-- ---------------------------------------------------------------------------
create table public.session_types (
  id             uuid primary key default extensions.gen_random_uuid(),
  slug           text not null unique,
  name_ar        text not null,
  name_en        text not null,
  description_ar text,
  duration_minutes integer not null default 60 check (duration_minutes in (30, 45, 60, 90)),
  sort_order     integer not null default 0,
  is_active      boolean not null default true
);

insert into public.session_types (slug, name_ar, name_en, description_ar, duration_minutes, sort_order) values
  ('career_guidance',      'إرشاد مهني',        'Career Guidance',       'تحديد وجهتك المهنية والخطوة التالية.',            60, 1),
  ('technical_mentoring',  'إرشاد تقني',        'Technical Mentoring',   'مساعدة في مشكلة أو قرار تقني تعمل عليه الآن.',     60, 2),
  ('project_review',       'مراجعة مشروع',      'Project Review',        'مراجعة مشروع قائم وتحديد ما يحتاج تحسيناً.',       60, 3),
  ('portfolio_review',     'مراجعة معرض أعمال', 'Portfolio Review',      'مراجعة ملفك المهني وأعمالك قبل التقديم لفرصة.',    45, 4),
  ('learning_path_guidance','إرشاد مسار تعلّم',  'Learning Path Guidance','اختيار المسار المناسب وترتيب أولوياتك فيه.',       45, 5);

-- Which types each mentor offers.
create table public.mentor_session_types (
  mentor_id       uuid not null references public.mentor_profiles (profile_id) on delete cascade,
  session_type_id uuid not null references public.session_types (id) on delete cascade,
  is_active       boolean not null default true,
  primary key (mentor_id, session_type_id)
);

-- ---------------------------------------------------------------------------
-- Availability exceptions: close a specific day, or open one that the weekly
-- rule does not cover. Rules stay the base; exceptions bend them per date.
-- ---------------------------------------------------------------------------
create table public.mentor_availability_exceptions (
  id         uuid primary key default extensions.gen_random_uuid(),
  mentor_id  uuid not null references public.mentor_profiles (profile_id) on delete cascade,
  on_date    date not null,
  -- false closes the date entirely; true opens the window below on that date
  is_open    boolean not null default false,
  start_time time,
  end_time   time,
  reason_ar  text,

  constraint availability_exception_window check (
    (is_open and start_time is not null and end_time is not null and end_time > start_time)
    or (not is_open and start_time is null and end_time is null)
  )
);

create index mentor_availability_exceptions_idx
  on public.mentor_availability_exceptions (mentor_id, on_date);

-- ---------------------------------------------------------------------------
-- Payment methods are configuration, not code. Account numbers live here, are
-- edited by an admin, and a student only ever sees the enabled ones.
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  key            text primary key,
  name_ar        text not null,
  name_en        text not null,
  icon           text,
  category       text not null check (category in ('local', 'international')),
  is_enabled     boolean not null default false,
  sort_order     integer not null default 0,
  instructions_ar text,

  -- recipient details, shown and copyable
  recipient_name text,
  account_number text,
  wallet_number  text,
  iban           text,
  swift          text,
  bank_name      text,
  bank_address   text,
  city           text,
  country        text,

  requires_receipt   boolean not null default true,
  requires_reference boolean not null default false,
  -- what to call the reference on this method, e.g. MTCN for Western Union
  reference_label_ar text,
  -- true only when a real gateway integration exists; never faked
  supports_automatic_payment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_methods_touch before update on public.payment_methods
  for each row execute function public.touch_updated_at();

insert into public.payment_methods
  (key, name_ar, name_en, icon, category, is_enabled, sort_order, requires_receipt, requires_reference, reference_label_ar, instructions_ar) values
  ('bank_of_palestine', 'بنك فلسطين', 'Bank of Palestine', '🏦', 'local', true, 1, true, false, 'رقم العملية',
   'حوّل قيمة الجلسة كاملة إلى الحساب الظاهر، احتفظ بإيصال التحويل، ثم ارفعه هنا.'),
  ('palpay', 'PalPay', 'PalPay', '📱', 'local', true, 2, true, false, 'رقم العملية',
   'افتح تطبيق PalPay، حوّل المبلغ إلى الرقم الظاهر، واحتفظ بالإيصال ثم ارفعه.'),
  ('jawwal_pay', 'Jawwal Pay', 'Jawwal Pay', '📲', 'local', true, 3, true, false, 'رقم العملية',
   'افتح Jawwal Pay، أرسل قيمة الجلسة إلى الرقم الظاهر، واحتفظ بالإيصال ثم ارفعه.'),
  ('fawateer', 'فواتيري — بطاقة', 'Fawateer — Card', '💳', 'international', false, 4, false, false, 'رقم العملية',
   'الدفع ببطاقة Visa أو Mastercard. هذه الطريقة معطّلة حتى يكتمل الربط مع مزوّد الدفع.'),
  ('furlanso', 'Furlanso', 'Furlanso', '🌐', 'international', true, 5, true, true, 'رقم العملية',
   'سجّل الدخول إلى Furlanso، أرسل المبلغ إلى حساب TechMood الظاهر، واحتفظ بتأكيد العملية ثم ارفعه.'),
  ('western_union', 'Western Union', 'Western Union', '💸', 'international', true, 6, true, true, 'رقم الحوالة (MTCN)',
   'أرسل الحوالة إلى الاسم والمدينة الظاهرين، ثم أدخل رقم MTCN وارفع إيصال الحوالة.'),
  ('moneygram', 'MoneyGram', 'MoneyGram', '💵', 'international', true, 7, true, true, 'الرقم المرجعي',
   'أرسل الحوالة إلى الاسم والدولة الظاهرين، ثم أدخل الرقم المرجعي وارفع الإيصال.'),
  ('international_transfer', 'تحويل بنكي دولي', 'International Bank Transfer', '🏛️', 'international', true, 8, true, true, 'رقم التحويل',
   'قد تستغرق التحويلات الدولية وقتاً إضافياً وقد تفرض البنوك رسوم تحويل. أدخل رقم التحويل وارفع الإيصال.');

comment on table public.payment_methods is
  'Admin-managed. Account numbers belong here, never hard-coded in the client, '
  'and a method with supports_automatic_payment = false is a manual flow — no '
  'integration is ever implied that does not exist.';

-- ---------------------------------------------------------------------------
-- Bookings gain what the flow needs: what the session is, what the student
-- wants out of it, and how long the slot is held while they pay.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column session_type_id uuid references public.session_types (id) on delete restrict,
  add column session_goal_ar text,
  -- while this is in the future and the booking is still payment_pending, the
  -- slot is held for this student and nobody else may take it
  add column reserved_until timestamptz;

create index bookings_reservation_idx on public.bookings (reserved_until)
  where status = 'payment_pending';

-- An expired reservation releases its slot, so it joins the statuses that the
-- overlap constraint ignores.
alter table public.bookings drop constraint bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    mentor_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
  )
  where (status not in ('cancelled', 'rejected', 'refunded', 'draft', 'expired'));

-- What the student is asking the mentor to look at, pulled from work that
-- already exists on the platform rather than re-uploaded for the session.
create table public.booking_review_items (
  id         uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  item_kind  text not null check (item_kind in
    ('submission', 'project', 'course', 'learning_path', 'certificate', 'career_goal')),
  item_id    uuid,
  label_ar   text not null,
  created_at timestamptz not null default now()
);

create index booking_review_items_booking_idx on public.booking_review_items (booking_id);

-- The timeline the student watches. Written by triggers, never by a client.
create table public.booking_events (
  id         uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event_key  text not null,
  note_ar    text,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Payments move from a fixed enum to the configurable method table.
-- ---------------------------------------------------------------------------
-- The review queue reads payments.method, so it is rebuilt around the new column.
drop view public.admin_review_queue;

alter table public.payments
  add column method_key text references public.payment_methods (key) on delete restrict,
  add column failure_reason text;

update public.payments set method_key = method::text;

alter table public.payments
  alter column method_key set not null,
  drop column method;

drop type public.payment_method;

create or replace view public.admin_review_queue
with (security_invoker = true) as
      select 'role_application'  as item_kind,
             pr.id               as item_id,
             p.full_name         as subject,
             pr.role::text       as detail,
             pr.created_at
      from public.profile_roles pr
      join public.profiles p on p.id = pr.profile_id
      where pr.status = 'pending_review'
  union all
      select 'submission',
             s.id,
             p.full_name,
             a.title_ar,
             s.updated_at
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.profiles p on p.id = s.profile_id
      where s.status in ('submitted', 'under_review')
  union all
      select 'payment',
             pay.id,
             coalesce(p.full_name, t.title_ar),
             pm.name_ar || ' · $' || pay.amount_usd::text,
             pay.submitted_at
      from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      join public.payment_methods pm on pm.key = pay.method_key
      left join public.profiles p on p.id = b.student_id
      left join public.teams t on t.id = b.team_id
      where pay.status = 'under_review'
  union all
      select 'incubator_application',
             ia.id,
             s.name_ar,
             s.stage::text,
             ia.created_at
      from public.incubator_applications ia
      join public.startups s on s.id = ia.startup_id
      where ia.status = 'pending_review'
  union all
      select 'reevaluation_request',
             rr.id,
             p.full_name,
             rr.reason_ar,
             rr.created_at
      from public.reevaluation_requests rr
      join public.profiles p on p.id = rr.requested_by
      where rr.status = 'open';

-- ---------------------------------------------------------------------------
-- Derived slots. This is the single answer to "can this hour be booked?",
-- used by the student's calendar and by the booking rules alike.
-- ---------------------------------------------------------------------------
create or replace function public.mentor_available_slots(
  p_mentor uuid,
  p_from   date,
  p_to     date
)
returns table (slot_start timestamptz, slot_end timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  -- the weekly rule, minus any date the mentor closed, plus any date they opened
  windows as (
    select dy.day, ma.start_time, ma.end_time
    from days dy
    join public.mentor_availability ma
      on ma.mentor_id = p_mentor
     and ma.day_of_week = extract(dow from dy.day)::smallint
    where not exists (
      select 1 from public.mentor_availability_exceptions ex
      where ex.mentor_id = p_mentor and ex.on_date = dy.day and not ex.is_open
    )
    union all
    select ex.on_date, ex.start_time, ex.end_time
    from public.mentor_availability_exceptions ex
    where ex.mentor_id = p_mentor
      and ex.is_open
      and ex.on_date between p_from and p_to
  ),
  -- one row per whole hour inside each window, since a slot is an hour
  slots as (
    select (w.day + w.start_time + (n || ' hours')::interval)::timestamptz       as slot_start,
           (w.day + w.start_time + ((n + 1) || ' hours')::interval)::timestamptz as slot_end
    from windows w
    cross join lateral generate_series(
      0,
      (extract(epoch from (w.end_time - w.start_time)) / 3600)::int - 1
    ) n
  )
  select sl.slot_start,
         sl.slot_end,
         case
           when exists (
             select 1 from public.mentor_time_off t
             where t.mentor_id = p_mentor
               and tstzrange(t.starts_at, t.ends_at, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'unavailable'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and b.status in ('payment_verified', 'mentor_pending', 'confirmed', 'completed')
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'booked'
           when exists (
             select 1 from public.bookings b
             where b.mentor_id = p_mentor
               and b.status in ('payment_pending', 'payment_submitted')
               and coalesce(b.reserved_until, b.scheduled_start) > now()
               and tstzrange(b.scheduled_start, b.scheduled_end, '[)')
                   && tstzrange(sl.slot_start, sl.slot_end, '[)')
           ) then 'pending'
           when sl.slot_start
                < now() + (public.setting_int('booking_min_notice_hours') || ' hours')::interval
             then 'unavailable'
           else 'available'
         end as state
  from slots sl
  order by sl.slot_start;
$$;

-- The booking rules now read the notice window from settings and respect
-- date-level exceptions instead of only the weekly rule.
create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dow        smallint;
  v_start_time time;
  v_end_time   time;
  v_notice     integer;
begin
  if tg_op = 'INSERT' or new.scheduled_start is distinct from old.scheduled_start then
    v_notice := coalesce(public.setting_int('booking_min_notice_hours'), 72);
    if new.scheduled_start < now() + (v_notice || ' hours')::interval then
      raise exception 'a session must be booked at least % hours in advance', v_notice;
    end if;
  end if;

  v_dow        := extract(dow from new.scheduled_start)::smallint;
  v_start_time := new.scheduled_start::time;
  v_end_time   := new.scheduled_end::time;

  -- a date the mentor closed is closed, whatever the weekly rule says
  if exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and not ex.is_open
  ) then
    raise exception 'the mentor is not available on that date';
  end if;

  if not exists (
    select 1 from public.mentor_availability ma
    where ma.mentor_id = new.mentor_id
      and ma.day_of_week = v_dow
      and ma.start_time <= v_start_time
      and ma.end_time   >= v_end_time
  ) and not exists (
    select 1 from public.mentor_availability_exceptions ex
    where ex.mentor_id = new.mentor_id
      and ex.on_date = new.scheduled_start::date
      and ex.is_open
      and ex.start_time <= v_start_time
      and ex.end_time   >= v_end_time
  ) then
    raise exception 'the requested slot is outside the mentor published availability';
  end if;

  if exists (
    select 1 from public.mentor_time_off t
    where t.mentor_id = new.mentor_id
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(new.scheduled_start, new.scheduled_end, '[)')
  ) then
    raise exception 'the mentor is unavailable during the requested slot';
  end if;

  return new;
end;
$$;

-- =============================================================================
-- The booking flow, as functions. Clients never INSERT a booking directly:
-- the price is read from the mentor's level here, so a crafted request cannot
-- book a $100 session for $0.
-- =============================================================================

create or replace function public.create_booking_request(
  p_mentor       uuid,
  p_session_type uuid,
  p_starts_at    timestamptz,
  p_method_key   text,
  p_goal         text default null,
  p_review_items jsonb default '[]'::jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student  uuid := (select auth.uid());
  v_level    public.mentor_level;
  v_prices   public.mentor_levels%rowtype;
  v_duration integer;
  v_hold     integer;
  v_booking  public.bookings%rowtype;
  v_item     jsonb;
begin
  if v_student is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
    where pm.key = p_method_key and pm.is_enabled
  ) then
    raise exception 'payment method % is not available', p_method_key;
  end if;

  select mp.level into v_level
  from public.mentor_profiles mp
  where mp.profile_id = p_mentor and mp.is_accepting;

  if v_level is null then
    raise exception 'mentor % is not accepting bookings', p_mentor;
  end if;

  if not exists (
    select 1 from public.mentor_session_types mst
    where mst.mentor_id = p_mentor and mst.session_type_id = p_session_type and mst.is_active
  ) then
    raise exception 'this mentor does not offer the requested session type';
  end if;

  select * into v_prices from public.mentor_levels where level = v_level;
  select duration_minutes into v_duration from public.session_types where id = p_session_type;
  v_hold := coalesce(public.setting_int('booking_reservation_minutes'), 45);

  -- The slot rules (notice window, published availability, time off) and the
  -- no-overlap constraint are enforced by the table's own triggers.
  insert into public.bookings (
    kind, student_id, mentor_id, session_type_id,
    scheduled_start, scheduled_end,
    status, price_usd, platform_share_usd, mentor_share_usd,
    session_goal_ar, reserved_until
  )
  values (
    'student_mentor', v_student, p_mentor, p_session_type,
    p_starts_at, p_starts_at + (v_duration || ' minutes')::interval,
    'payment_pending', v_prices.session_price_usd, v_prices.platform_share_usd, v_prices.mentor_share_usd,
    nullif(trim(coalesce(p_goal, '')), ''), now() + (v_hold || ' minutes')::interval
  )
  returning * into v_booking;

  insert into public.payments (booking_id, method_key, amount_usd, status)
  values (v_booking.id, p_method_key, v_prices.session_price_usd, 'pending');

  for v_item in select * from jsonb_array_elements(coalesce(p_review_items, '[]'::jsonb))
  loop
    insert into public.booking_review_items (booking_id, item_kind, item_id, label_ar)
    values (
      v_booking.id,
      v_item ->> 'kind',
      nullif(v_item ->> 'id', '')::uuid,
      coalesce(v_item ->> 'label', 'عنصر للمراجعة')
    );
  end loop;

  return v_booking;
end;
$$;

-- The student attaches their receipt and hands the payment to TechMood.
create or replace function public.submit_payment_proof(
  p_booking_id uuid,
  p_proof_path text default null,
  p_reference  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_method  public.payment_methods%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.student_id is distinct from (select auth.uid()) then
    raise exception 'only the student who made this booking may submit its payment';
  end if;

  if v_booking.status <> 'payment_pending' then
    raise exception 'this booking is not waiting for a payment';
  end if;

  if v_booking.reserved_until is not null and v_booking.reserved_until < now() then
    raise exception 'the reservation has expired; please pick the slot again';
  end if;

  select * into v_payment from public.payments
   where booking_id = p_booking_id and status in ('pending', 'rejected')
   order by created_at desc limit 1;

  if v_payment.id is null then
    raise exception 'no open payment for this booking';
  end if;

  select * into v_method from public.payment_methods where key = v_payment.method_key;

  -- Requirements are re-checked here, not only in the browser.
  if v_method.requires_receipt and coalesce(trim(p_proof_path), '') = '' then
    raise exception 'this payment method requires a receipt';
  end if;

  if v_method.requires_reference and coalesce(trim(p_reference), '') = '' then
    raise exception 'this payment method requires %', coalesce(v_method.reference_label_ar, 'a reference number');
  end if;

  update public.payments
     set status = 'under_review',
         proof_path = p_proof_path,
         reference = p_reference,
         submitted_at = now(),
         rejection_reason = null
   where id = v_payment.id;

  update public.bookings set status = 'payment_submitted' where id = p_booking_id;
end;
$$;

-- An abandoned reservation must release its slot instead of silently blocking
-- the mentor's calendar. Schedule this (pg_cron, or a scheduled edge function).
create or replace function public.expire_stale_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.bookings
       set status = 'expired'
     where status = 'payment_pending'
       and reserved_until is not null
       and reserved_until < now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

comment on function public.expire_stale_bookings is
  'Run periodically. Releases slots held by reservations that were never paid for.';

-- ---------------------------------------------------------------------------
-- The state machine, extended for expiry
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed public.booking_status[];
begin
  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'draft'             then array['payment_pending', 'cancelled']
    when 'payment_pending'   then array['payment_submitted', 'cancelled', 'expired']
    when 'payment_submitted' then array['payment_verified', 'payment_pending', 'rejected', 'cancelled']
    when 'payment_verified'  then array['mentor_pending', 'cancelled', 'refunded']
    when 'mentor_pending'    then array['confirmed', 'rejected', 'cancelled']
    when 'confirmed'         then array['completed', 'cancelled', 'refunded']
    when 'completed'         then array['refunded']
    when 'cancelled'         then array[]::text[]
    when 'rejected'          then array['refunded']
    when 'refunded'          then array[]::text[]
    when 'expired'           then array[]::text[]
  end::public.booking_status[];

  if not (new.status = any (v_allowed)) then
    raise exception 'illegal booking transition % -> %', old.status, new.status;
  end if;

  -- Verified payment AND mentor acceptance. Never one without the other.
  if new.status = 'confirmed' then
    if not exists (
      select 1 from public.payments p
      where p.booking_id = new.id and p.status = 'verified'
    ) then
      raise exception 'a booking cannot be confirmed before its payment is verified';
    end if;
    new.confirmed_at := now();
    -- the slot is settled; the reservation hold no longer means anything
    new.reserved_until := null;
  end if;

  if new.status = 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

-- Rejecting a payment hands the booking back to the student with a fresh hold
-- on the slot, so they can fix the receipt without losing their appointment.
create or replace function public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
  v_hold    integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;

  select booking_id into v_booking from public.payments where id = p_payment_id;
  if v_booking is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  if p_approve then
    update public.payments
       set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = null
     where id = p_payment_id;

    update public.bookings set status = 'payment_verified' where id = v_booking;
    -- verified money is not a confirmed session: the mentor decides next
    update public.bookings set status = 'mentor_pending' where id = v_booking;
  else
    update public.payments
       set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = p_reason
     where id = p_payment_id;

    update public.bookings
       set status = 'payment_pending',
           reserved_until = greatest(coalesce(reserved_until, now()), now() + (v_hold || ' minutes')::interval)
     where id = v_booking;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Timeline
-- ---------------------------------------------------------------------------
create or replace function public.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, event_key, actor_id)
    values (new.id, 'booking_created', new.student_id);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, event_key, actor_id, note_ar)
    values (new.id, new.status::text, (select auth.uid()), new.cancelled_reason);
  end if;

  return new;
end;
$$;

create trigger bookings_timeline
  after insert or update of status on public.bookings
  for each row execute function public.record_booking_event();

create or replace function public.record_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.booking_events (booking_id, event_key, actor_id, note_ar)
  values (new.booking_id, 'payment_' || new.status::text, (select auth.uid()), new.rejection_reason);

  return new;
end;
$$;

create trigger payments_timeline
  after insert or update of status on public.payments
  for each row execute function public.record_payment_event();

-- =============================================================================
-- Authorization for everything added above
-- =============================================================================

alter table public.platform_settings                enable row level security;
alter table public.session_types                    enable row level security;
alter table public.mentor_session_types             enable row level security;
alter table public.mentor_availability_exceptions   enable row level security;
alter table public.payment_methods                  enable row level security;
alter table public.booking_review_items             enable row level security;
alter table public.booking_events                   enable row level security;

create policy platform_settings_read on public.platform_settings
  for select to anon, authenticated using (true);
create policy platform_settings_admin on public.platform_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy session_types_read on public.session_types
  for select to anon, authenticated using (true);
create policy session_types_admin on public.session_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy mentor_session_types_read on public.mentor_session_types
  for select to anon, authenticated using (true);
create policy mentor_session_types_own on public.mentor_session_types
  for all to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin())
  with check (mentor_id = (select auth.uid()) or public.is_admin());

create policy mentor_exceptions_read on public.mentor_availability_exceptions
  for select to anon, authenticated using (true);
create policy mentor_exceptions_own on public.mentor_availability_exceptions
  for all to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin())
  with check (mentor_id = (select auth.uid()) or public.is_admin());

-- A student only ever sees the methods an admin turned on. Account numbers are
-- payable details, not secrets, but a disabled method must not leak at all.
create policy payment_methods_read_enabled on public.payment_methods
  for select to authenticated using (is_enabled or public.is_admin());
create policy payment_methods_admin on public.payment_methods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy booking_review_items_parties on public.booking_review_items
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.student_id = (select auth.uid())
           or b.mentor_id = (select auth.uid())
           or public.is_admin()
           or (b.team_id is not null and public.is_team_member(b.team_id)))
  ));

create policy booking_events_parties on public.booking_events
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.student_id = (select auth.uid())
           or b.mentor_id = (select auth.uid())
           or public.is_admin()
           or (b.team_id is not null and public.is_team_member(b.team_id)))
  ));

-- Bookings are created by create_booking_request(), which is what reads the
-- price from the mentor's level. Dropping the direct INSERT policy is the
-- whole point: a client that could insert its own row could set its own price.
drop policy bookings_create on public.bookings;

-- Payments are likewise created and advanced by functions only.
drop policy payments_write_payer on public.payments;
drop policy payments_update_payer on public.payments;

-- ---------------------------------------------------------------------------
-- Receipts: enforce type and size at the storage layer, not just in the form
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg']
 where id = 'payment-proofs';

-- ---------------------------------------------------------------------------
-- Grants for the new callable surface
-- ---------------------------------------------------------------------------
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- setting_int and expire_stale_bookings stay ungranted: one is an internal
-- helper, the other is a scheduled job that no client should be able to run.
grant execute on function public.mentor_available_slots(uuid, date, date)               to anon, authenticated;
grant execute on function public.create_booking_request(uuid, uuid, timestamptz, text, text, jsonb) to authenticated;
grant execute on function public.submit_payment_proof(uuid, text, text)                 to authenticated;
