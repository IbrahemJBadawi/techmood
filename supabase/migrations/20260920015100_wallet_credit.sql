-- ============================================================================
-- 0151 — رصيد TechMood: top it up by transfer, pay from it (design lab 4)
--
-- A member's balance is its own ledger, apart from the earnings ledger
-- (wallet_entries): money put in to spend on the platform is not earnings and
-- cannot be withdrawn. That keeps payouts what they were — a mentor or a
-- seller withdraws what they earned — and a top-up can never be a way to move
-- money through TechMood.
--
--   * Topping up: the member picks an amount and a method, gets the same
--     transfer details a booking shows, sends the money and uploads the
--     receipt; an admin approves it and the balance grows. Nothing is credited
--     before a person has checked the receipt.
--   * Paying from it: any open payment — a session, a market purchase, a
--     service — can be paid from the balance instead of a transfer. The amount
--     comes off the balance and the payment is settled at once, exactly as an
--     admin's approval would settle it: `settle_payment()` is that approval,
--     taken out of `verify_payment()` so both paths run the same steps.
--   * A refund of a payment made from the balance goes back to the balance.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The balance
-- ---------------------------------------------------------------------------
create table public.credit_entries (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  amount_usd     numeric(10,2) not null check (amount_usd <> 0),
  kind           text not null check (kind in ('topup', 'spend', 'refund', 'adjust')),
  description_ar text not null,
  ref_table      text,
  ref_id         uuid,
  created_at     timestamptz not null default now()
);

create index credit_entries_profile_idx on public.credit_entries (profile_id, created_at desc);

alter table public.credit_entries enable row level security;
create policy credit_entries_own on public.credit_entries
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.credit_entries from anon, authenticated;
grant select on public.credit_entries to authenticated;

-- A refund of the same thing is credited once.
create unique index credit_entries_one_refund on public.credit_entries (ref_table, ref_id)
  where kind = 'refund';

create or replace function public.credit_balance_of(p_profile uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_usd), 0)::numeric(10,2) from public.credit_entries where profile_id = p_profile;
$$;

revoke execute on function public.credit_balance_of(uuid) from public, anon, authenticated;

create or replace function public.my_credit_balance()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select public.credit_balance_of((select auth.uid()));
$$;

revoke execute on function public.my_credit_balance() from public, anon;
grant execute on function public.my_credit_balance() to authenticated;

-- Taking from the balance: one at a time per person, and never below zero.
create or replace function public.spend_credit(
  p_profile uuid, p_amount numeric, p_description text, p_ref_table text, p_ref_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'مبلغ غير صحيح';
  end if;
  perform pg_advisory_xact_lock(hashtext('credit:' || p_profile::text));
  if public.credit_balance_of(p_profile) < p_amount then
    raise exception 'رصيدك لا يكفي — اشحن رصيدك أولاً';
  end if;
  insert into public.credit_entries (profile_id, amount_usd, kind, description_ar, ref_table, ref_id)
  values (p_profile, -p_amount, 'spend', p_description, p_ref_table, p_ref_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.spend_credit(uuid, numeric, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Topping up by transfer, reviewed by an admin
-- ---------------------------------------------------------------------------
create table public.credit_topups (
  id               uuid primary key default extensions.gen_random_uuid(),
  topup_code       text not null unique
                   default 'TMTOP-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8)),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  amount_usd       numeric(8,2) not null check (amount_usd between 5 and 500),
  method_key       text not null references public.payment_methods (key) on delete restrict,
  reference        text check (reference is null or char_length(reference) <= 120),
  proof_path       text,
  status           text not null default 'pending'
                   check (status in ('pending', 'under_review', 'approved', 'rejected', 'cancelled')),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz
);

create index credit_topups_review_idx on public.credit_topups (status, submitted_at) where status = 'under_review';
create index credit_topups_profile_idx on public.credit_topups (profile_id, created_at desc);

alter table public.credit_topups enable row level security;
create policy credit_topups_own on public.credit_topups
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.credit_topups from anon, authenticated;
grant select on public.credit_topups to authenticated;

create or replace function public.request_topup(p_amount numeric, p_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if coalesce(p_amount, 0) not between 5 and 500 then
    raise exception 'الشحن بين 5$ و500$';
  end if;
  if not exists (select 1 from public.payment_methods m
                  where m.key = p_method and 'mentoring' = any (m.use_for) and public.method_is_ready(m.key)) then
    raise exception 'طريقة الدفع هذه غير متاحة للشحن';
  end if;
  if (select count(*) from public.credit_topups
       where profile_id = v_me and status in ('pending', 'under_review')) >= 3 then
    raise exception 'لديك طلبات شحن مفتوحة — أكملها أو ألغها أولاً';
  end if;
  insert into public.credit_topups (profile_id, amount_usd, method_key)
  values (v_me, round(p_amount, 2), p_method)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.request_topup(numeric, text) from public, anon;
grant execute on function public.request_topup(numeric, text) to authenticated;

-- What to send and where — the same fields a booking's payment shows, for the
-- person who asked for this top-up, while it is open.
create or replace function public.topup_instructions(p_topup uuid)
returns table (
  method_key text, name_ar text, name_en text, icon text, instructions_ar text,
  recipient_name text, account_number text, wallet_number text, iban text, swift text,
  bank_name text, bank_address text, city text, country text, account_email text,
  display_fields text[], international_fields text[], requires_receipt boolean,
  requires_reference boolean, reference_label_ar text, amount_usd numeric, payment_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.key, m.name_ar, m.name_en, m.icon, m.instructions_ar,
         case when 'recipient_name' = any (m.display_fields) then m.recipient_name end,
         case when 'account_number' = any (m.display_fields) then m.account_number end,
         case when 'wallet_number'  = any (m.display_fields) then m.wallet_number end,
         case when 'iban'           = any (m.display_fields) then m.iban end,
         case when 'swift'          = any (m.display_fields) then m.swift end,
         case when 'bank_name'      = any (m.display_fields) then m.bank_name end,
         case when 'bank_address'   = any (m.display_fields) then m.bank_address end,
         case when 'city'           = any (m.display_fields) then m.city end,
         case when 'country'        = any (m.display_fields) then m.country end,
         case when 'account_email'  = any (m.display_fields) then m.account_email end,
         m.display_fields, m.international_fields,
         m.requires_receipt, m.requires_reference, m.reference_label_ar,
         t.amount_usd, t.topup_code
    from public.credit_topups t
    join public.payment_methods m on m.key = t.method_key
   where t.id = p_topup
     and t.profile_id = (select auth.uid())
     and t.status in ('pending', 'rejected', 'under_review');
$$;

revoke execute on function public.topup_instructions(uuid) from public, anon;
grant execute on function public.topup_instructions(uuid) to authenticated;

create or replace function public.submit_topup_proof(p_topup uuid, p_proof_path text, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_t  public.credit_topups%rowtype;
  v_m  public.payment_methods%rowtype;
begin
  select * into v_t from public.credit_topups where id = p_topup for update;
  if not found or v_t.profile_id is distinct from v_me then
    raise exception 'طلب الشحن غير موجود';
  end if;
  if v_t.status not in ('pending', 'rejected') then
    raise exception 'هذا الطلب أُرسل للمراجعة بالفعل';
  end if;
  select * into v_m from public.payment_methods where key = v_t.method_key;
  if v_m.requires_receipt and nullif(btrim(p_proof_path), '') is null then
    raise exception 'ارفع صورة الإيصال';
  end if;
  if v_m.requires_reference and nullif(btrim(p_reference), '') is null then
    raise exception 'اكتب الرقم المرجعي للتحويل';
  end if;
  if nullif(btrim(p_proof_path), '') is not null and split_part(p_proof_path, '/', 1) <> v_me::text then
    raise exception 'ملف الإيصال غير صالح';
  end if;

  update public.credit_topups
     set status = 'under_review', proof_path = nullif(btrim(p_proof_path), ''),
         reference = nullif(btrim(p_reference), ''), submitted_at = now(), rejection_reason = null
   where id = p_topup;

  perform public.notify_admins('💳 طلب شحن رصيد ' || v_t.amount_usd || '$ — ' || v_t.topup_code,
    'راجع الإيصال وأكّد الشحن.', '/admin/topups', 'credit_topup', p_topup, 'important');
end;
$$;

revoke execute on function public.submit_topup_proof(uuid, text, text) from public, anon;
grant execute on function public.submit_topup_proof(uuid, text, text) to authenticated;

create or replace function public.cancel_topup(p_topup uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.credit_topups set status = 'cancelled'
   where id = p_topup and profile_id = (select auth.uid()) and status in ('pending', 'rejected');
  if not found then
    raise exception 'لا يمكن إلغاء هذا الطلب';
  end if;
end;
$$;

revoke execute on function public.cancel_topup(uuid) from public, anon;
grant execute on function public.cancel_topup(uuid) to authenticated;

-- The admin's decision: only an approval puts money in the balance, and only once.
create or replace function public.review_topup(p_topup uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.credit_topups%rowtype;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  select * into v_t from public.credit_topups where id = p_topup for update;
  if not found then
    raise exception 'طلب الشحن غير موجود';
  end if;
  if v_t.status <> 'under_review' then
    raise exception 'هذا الطلب رُوجع بالفعل أو لم يُرسل بعد';
  end if;

  if p_approve then
    update public.credit_topups
       set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = p_topup;
    insert into public.credit_entries (profile_id, amount_usd, kind, description_ar, ref_table, ref_id)
    values (v_t.profile_id, v_t.amount_usd, 'topup', 'شحن رصيد ' || v_t.topup_code, 'credit_topups', p_topup);
    perform public.notify(v_t.profile_id, 'payment', '✓ شُحن رصيدك بـ ' || v_t.amount_usd || '$',
      'أصبح بإمكانك الدفع من رصيدك للجلسات والسوق.', '/wallet', 'credit_topup', p_topup);
  else
    if nullif(btrim(p_reason), '') is null then
      raise exception 'اكتب سبب الرفض ليعرفه العضو';
    end if;
    update public.credit_topups
       set status = 'rejected', rejection_reason = btrim(p_reason),
           reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = p_topup;
    perform public.notify(v_t.profile_id, 'payment', 'لم يُقبل إيصال الشحن ' || v_t.topup_code,
      btrim(p_reason) || ' — يمكنك رفع إيصال جديد.', '/wallet/topup/' || p_topup::text, 'credit_topup', p_topup);
  end if;
end;
$$;

revoke execute on function public.review_topup(uuid, boolean, text) from public, anon;
grant execute on function public.review_topup(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Paying from the balance
-- ---------------------------------------------------------------------------
-- A method of its own, so a payment says how it was paid; never offered as a
-- transfer (not enabled, used for nothing), never shown with account details.
insert into public.payment_methods
  (key, name_ar, name_en, icon, category, is_enabled, sort_order, use_for, display_fields,
   requires_receipt, requires_reference, instructions_ar)
values ('techmood_credit', 'رصيد TechMood', 'TechMood balance', '◎', 'local', false, -1, '{}', '{}',
        false, false, 'يُخصم من رصيدك في TechMood فوراً.')
on conflict (key) do nothing;

-- The admin's approval, without the admin check: what happens when a payment
-- is settled. `verify_payment()` calls it after checking the caller is an
-- admin; `pay_with_credit()` calls it after taking the money off the balance.
create or replace function public.settle_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
  v_escrow  uuid;
  v_status  public.payment_status;
  v_row     public.escrows%rowtype;
  v_b       public.bookings%rowtype;
  v_hold    integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
begin
  -- Locked: a second click, or a second admin at the same moment, waits here
  -- and then finds the payment already decided (0136).
  select booking_id, escrow_id, status into v_booking, v_escrow, v_status
    from public.payments where id = p_payment_id
     for update;

  if v_booking is null and v_escrow is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  if v_status not in ('pending', 'under_review', 'needs_info') then
    raise exception 'هذه الدفعة رُوجعت بالفعل — لا تُقبل أو تُرفض مرتين';
  end if;

  -- ----- an escrow, as 0054 -----
  if v_escrow is not null then
    select * into v_row from public.escrows where id = v_escrow for update;

    if p_approve then
      update public.payments
         set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
             rejection_reason = null
       where id = p_payment_id;

      update public.escrows set status = 'funded', funded_at = now() where id = v_escrow;

      insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
      values (v_row.payee_id, 'earning', v_row.net_usd, 'pending',
              'مبلغ محتجز لعمل عبر السوق', 'escrows', v_escrow);

      perform public.notify(
        v_row.payee_id, 'payment', 'وصل المبلغ وحُجز',
        'ابدأ العمل — يُفرج عن المبلغ عند قبول التسليم.',
        '/projects/' || coalesce(v_row.project_id::text, ''));
    else
      update public.payments
         set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
             rejection_reason = p_reason
       where id = p_payment_id;

      perform public.notify(
        v_row.payer_id, 'payment', 'لم يُقبل إثبات الدفع', p_reason,
        '/projects/' || coalesce(v_row.project_id::text, ''));
    end if;

    return;
  end if;

  -- ----- a booking -----
  if p_approve then
    update public.payments
       set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = null
     where id = p_payment_id;

    update public.bookings set status = 'payment_verified' where id = v_booking;
    update public.bookings set status = 'mentor_pending' where id = v_booking;

    if public.in_mvp() then
      -- The MVP: the approval is the confirmation.
      update public.bookings set status = 'confirmed', mentor_decided_at = now() where id = v_booking;
      select * into v_b from public.bookings where id = v_booking;

      perform public.notify(v_b.mentor_id, 'booking', 'حجز جديد مؤكّد',
        'جلسة ' || v_b.booking_code || ' — أضف رابط الاجتماع (Zoom أو Google Meet) من صفحة الحجز.',
        '/bookings/' || v_booking::text);
      if v_b.student_id is not null then
        perform public.notify(v_b.student_id, 'booking', 'تأكّد حجزك',
          'تأكّد الدفع وأصبحت الجلسة ' || v_b.booking_code || ' مؤكّدة. يظهر رابط الاجتماع في صفحة الحجز وقت الجلسة.',
          '/bookings/' || v_booking::text);
      end if;
    end if;
  else
    update public.payments
       set status = 'rejected', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = p_reason
     where id = p_payment_id;

    if public.in_mvp() then
      -- The MVP: a rejected payment releases the slot.
      update public.bookings
         set status = 'rejected',
             cancelled_reason = 'لم يُقبل إثبات الدفع' || coalesce(': ' || nullif(btrim(p_reason), ''), '')
       where id = v_booking;
      select * into v_b from public.bookings where id = v_booking;
      if v_b.student_id is not null then
        perform public.notify(v_b.student_id, 'payment', 'لم يُقبل إثبات الدفع',
          coalesce(nullif(btrim(p_reason), ''), 'راجع الدفعة وأعد الحجز.') || ' — تحرّر الموعد، ويمكنك الحجز من جديد.',
          '/bookings/' || v_booking::text);
      end if;
    else
      update public.bookings
         set status = 'payment_pending',
             reserved_until = greatest(coalesce(reserved_until, now()), now() + (v_hold || ' minutes')::interval)
       where id = v_booking;
    end if;
  end if;
end;
$$;

revoke execute on function public.settle_payment(uuid, boolean, text) from public, anon, authenticated;

create or replace function public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;
  perform public.settle_payment(p_payment_id, p_approve, p_reason);
end;
$$;

-- Pay an open payment from the balance: taken off the balance and settled now.
create or replace function public.pay_with_credit(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_p   public.payments%rowtype;
  v_b   public.bookings%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_p from public.payments where id = p_payment for update;
  if not found or not exists (
    select 1 from public.bookings b where b.id = v_p.booking_id and b.student_id = v_me
    union all
    select 1 from public.escrows e where e.id = v_p.escrow_id and e.payer_id = v_me
  ) then
    raise exception 'الدافع فقط من يدفع هذه الدفعة';
  end if;
  if v_p.status not in ('pending', 'rejected') then
    raise exception 'هذه الدفعة أُرسلت أو رُوجعت بالفعل';
  end if;
  if v_p.booking_id is not null then
    select * into v_b from public.bookings where id = v_p.booking_id;
    if v_b.status <> 'payment_pending' or (v_b.reserved_until is not null and v_b.reserved_until < now()) then
      raise exception 'انتهت مهلة هذا الحجز — احجز موعداً جديداً';
    end if;
  end if;

  perform public.spend_credit(v_me, v_p.amount_usd, 'دفع ' || v_p.payment_code, 'payments', p_payment);

  update public.payments
     set method_key = 'techmood_credit', reference = 'TechMood balance', submitted_at = now(),
         payer_holder = 'TechMood balance', payer_account = 'TechMood balance',
         status = 'under_review'
   where id = p_payment;
  -- the booking takes the same steps as with a receipt: submitted, then verified
  if v_p.booking_id is not null then
    update public.bookings set status = 'payment_submitted' where id = v_p.booking_id;
  end if;

  perform public.settle_payment(p_payment, true, null);
end;
$$;

revoke execute on function public.pay_with_credit(uuid) from public, anon;
grant execute on function public.pay_with_credit(uuid) to authenticated;

-- A refund of a payment made from the balance goes back to the balance.
create or replace function public.refund_credit_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.status = 'refunded' and old.status <> 'refunded' and new.method_key = 'techmood_credit' then
    select coalesce(b.student_id, e.payer_id) into v_owner
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.escrows e on e.id = p.escrow_id
     where p.id = new.id;
    if v_owner is not null then
      insert into public.credit_entries (profile_id, amount_usd, kind, description_ar, ref_table, ref_id)
      values (v_owner, new.amount_usd, 'refund', 'استرداد ' || new.payment_code || ' إلى رصيدك', 'payments', new.id)
      on conflict do nothing;
      perform public.notify(v_owner, 'payment', 'أُعيد ' || new.amount_usd || '$ إلى رصيدك',
        'استرداد الدفعة ' || new.payment_code || '.', '/wallet');
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.refund_credit_payment() from public, anon, authenticated;

drop trigger if exists payments_refund_to_credit on public.payments;
create trigger payments_refund_to_credit after update of status on public.payments
  for each row execute function public.refund_credit_payment();

-- What the wallet page shows of the balance: the number and its history.
create or replace function public.my_credit_history(p_limit integer default 30)
returns table (id uuid, amount_usd numeric, kind text, description_ar text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.amount_usd, c.kind, c.description_ar, c.created_at
    from public.credit_entries c
   where c.profile_id = (select auth.uid())
   order by c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 200));
$$;

revoke execute on function public.my_credit_history(integer) from public, anon;
grant execute on function public.my_credit_history(integer) to authenticated;
