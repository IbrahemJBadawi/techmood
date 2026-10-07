-- ============================================================================
-- 0152 — session packages with a discount (design lab 4: «باقات بخصم»)
--
-- A member buys several sessions of one kind with one mentor at once, paid
-- from their balance (0151), for less: 3 sessions 10% off, 5 sessions 15%
-- off. Each booking with that mentor and that kind of session can then be
-- paid from the package instead of a transfer.
--
-- The mentor's side does not change: a session paid from a package earns the
-- mentor the same share as any other, from the booking's own price. The
-- discount is the platform's, taken from its commission. An instant booking
-- (priced above the usual, 0125) is not paid from a package.
--
-- A refunded session paid from a package gives the session back.
-- ============================================================================

create table public.session_packages (
  id              uuid primary key default extensions.gen_random_uuid(),
  package_code    text not null unique
                  default 'TMPKG-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8)),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  mentor_id       uuid not null references public.profiles (id) on delete cascade,
  session_type_id uuid not null references public.session_types (id) on delete restrict,
  sessions_total  integer not null check (sessions_total in (3, 5)),
  sessions_used   integer not null default 0,
  unit_list_usd   numeric(8,2) not null check (unit_list_usd > 0),
  discount_pct    integer not null check (discount_pct between 0 and 50),
  paid_usd        numeric(10,2) not null check (paid_usd > 0),
  created_at      timestamptz not null default now(),
  constraint session_packages_used_range check (sessions_used between 0 and sessions_total)
);

create index session_packages_profile_idx on public.session_packages (profile_id, created_at desc);

alter table public.session_packages enable row level security;
create policy session_packages_read on public.session_packages
  for select to authenticated
  using (profile_id = (select auth.uid()) or mentor_id = (select auth.uid()) or public.is_admin());
revoke all on public.session_packages from anon, authenticated;
grant select on public.session_packages to authenticated;

-- How a package is paid, so a payment says so.
insert into public.payment_methods
  (key, name_ar, name_en, icon, category, is_enabled, sort_order, use_for, display_fields,
   requires_receipt, requires_reference, instructions_ar)
values ('session_package', 'باقة جلسات', 'Session package', '🎟️', 'local', false, -1, '{}', '{}',
        false, false, 'جلسة من باقة مدفوعة مسبقاً.')
on conflict (key) do nothing;

-- The packages on offer for one mentor and one kind of session.
create or replace function public.package_quote(p_mentor uuid, p_session_type uuid)
returns table (sessions integer, discount_pct integer, unit_usd numeric, total_usd numeric, saves_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select price_usd from public.session_quote(p_mentor, p_session_type) limit 1),
  tiers (n, pct) as (values (3, 10), (5, 15))
  select t.n, t.pct, q.price_usd,
         round(q.price_usd * t.n * (100 - t.pct) / 100.0, 2),
         round(q.price_usd * t.n * t.pct / 100.0, 2)
    from tiers t, q
   where q.price_usd > 0
   order by t.n;
$$;

revoke execute on function public.package_quote(uuid, uuid) from public, anon;
grant execute on function public.package_quote(uuid, uuid) to authenticated;

create or replace function public.buy_session_package(p_mentor uuid, p_session_type uuid, p_sessions integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_quote record;
  v_id    uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if v_me = p_mentor then
    raise exception 'لا تشترِ باقة من نفسك';
  end if;
  if not exists (select 1 from public.profile_roles pr
                  where pr.profile_id = p_mentor and pr.role = 'mentor' and pr.status = 'approved') then
    raise exception 'المنتور غير متاح';
  end if;
  select * into v_quote from public.package_quote(p_mentor, p_session_type) q where q.sessions = p_sessions;
  if not found then
    raise exception 'الباقات 3 أو 5 جلسات';
  end if;

  v_id := extensions.gen_random_uuid();
  perform public.spend_credit(v_me, v_quote.total_usd, 'باقة ' || p_sessions || ' جلسات', 'session_packages', v_id);
  insert into public.session_packages
    (id, profile_id, mentor_id, session_type_id, sessions_total, unit_list_usd, discount_pct, paid_usd)
  values (v_id, v_me, p_mentor, p_session_type, p_sessions, v_quote.unit_usd, v_quote.discount_pct, v_quote.total_usd);

  perform public.notify(p_mentor, 'booking', '🎟️ اشترى عضو باقة ' || p_sessions || ' جلسات معك',
    'ستصلك حجوزاتها كالمعتاد.', '/bookings', 'session_package', v_id);
  return v_id;
end;
$$;

revoke execute on function public.buy_session_package(uuid, uuid, integer) from public, anon;
grant execute on function public.buy_session_package(uuid, uuid, integer) to authenticated;

-- My packages, with what is left in each.
create or replace function public.my_session_packages()
returns table (
  id uuid, package_code text, mentor_id uuid, mentor_name text, session_type_id uuid, session_name text,
  sessions_total integer, sessions_left integer, discount_pct integer, paid_usd numeric, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.package_code, k.mentor_id, p.full_name, k.session_type_id, st.name_ar,
         k.sessions_total, k.sessions_total - k.sessions_used, k.discount_pct, k.paid_usd, k.created_at
    from public.session_packages k
    join public.profiles p on p.id = k.mentor_id
    join public.session_types st on st.id = k.session_type_id
   where k.profile_id = (select auth.uid())
   order by (k.sessions_total - k.sessions_used) > 0 desc, k.created_at desc;
$$;

revoke execute on function public.my_session_packages() from public, anon;
grant execute on function public.my_session_packages() to authenticated;

-- Pay a booking's open payment with one session of a package.
create or replace function public.pay_with_package(p_payment uuid, p_package uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_p  public.payments%rowtype;
  v_b  public.bookings%rowtype;
  v_k  public.session_packages%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_p from public.payments where id = p_payment for update;
  if not found or v_p.booking_id is null then
    raise exception 'الباقة لجلسات الإرشاد فقط';
  end if;
  select * into v_b from public.bookings where id = v_p.booking_id;
  if v_b.student_id is distinct from v_me then
    raise exception 'الدافع فقط من يدفع هذه الدفعة';
  end if;
  if v_p.status not in ('pending', 'rejected') then
    raise exception 'هذه الدفعة أُرسلت أو رُوجعت بالفعل';
  end if;
  if v_b.status <> 'payment_pending' or (v_b.reserved_until is not null and v_b.reserved_until < now()) then
    raise exception 'انتهت مهلة هذا الحجز — احجز موعداً جديداً';
  end if;

  select * into v_k from public.session_packages where id = p_package for update;
  if not found or v_k.profile_id <> v_me then
    raise exception 'الباقة غير موجودة';
  end if;
  if v_k.mentor_id <> v_b.mentor_id or v_k.session_type_id is distinct from v_b.session_type_id then
    raise exception 'هذه الباقة لمنتور أو نوع جلسة آخر';
  end if;
  if v_k.sessions_used >= v_k.sessions_total then
    raise exception 'انتهت جلسات هذه الباقة';
  end if;
  if v_p.amount_usd > v_k.unit_list_usd then
    raise exception 'الحجز الفوري لا يُدفع من الباقة — ادفعه من الرصيد أو بتحويل';
  end if;

  update public.session_packages set sessions_used = sessions_used + 1 where id = p_package;

  update public.payments
     set method_key = 'session_package', reference = v_k.package_code, submitted_at = now(),
         payer_holder = 'TechMood package', payer_account = v_k.package_code,
         status = 'under_review'
   where id = p_payment;
  update public.bookings set status = 'payment_submitted' where id = v_p.booking_id;

  perform public.settle_payment(p_payment, true, null);
end;
$$;

revoke execute on function public.pay_with_package(uuid, uuid) from public, anon;
grant execute on function public.pay_with_package(uuid, uuid) to authenticated;

-- A refunded session paid from a package gives the session back.
create or replace function public.refund_package_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'refunded' and old.status <> 'refunded' and new.method_key = 'session_package' then
    update public.session_packages
       set sessions_used = greatest(sessions_used - 1, 0)
     where package_code = new.reference;
  end if;
  return new;
end;
$$;

revoke execute on function public.refund_package_session() from public, anon, authenticated;

drop trigger if exists payments_refund_to_package on public.payments;
create trigger payments_refund_to_package after update of status on public.payments
  for each row execute function public.refund_package_session();
