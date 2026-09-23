-- =============================================================================
-- 0075 — One financial system, read in one place
--
-- The spec asked for a wallet that is "a financial record, not money held":
-- what a person paid, what became owed to them, what was transferred, and what
-- is still under review — with the admin as the one point of financial control.
--
-- Most of that was built across 0007, 0015, 0016, 0022 and 0054: manual
-- payments with a receipt and an admin's verdict, a ledger the balance is
-- computed from, payout accounts and requests settled by an admin, escrow for
-- market work, and commission brackets in a table. What this migration adds is
-- the rest of the spec, and three corrections found while reading the old code.
--
-- The corrections come first, because they are about money that was wrong:
--
--   1. **Market work was charged its commission twice.** Funding an escrow wrote
--      the payee's earning at `net_usd` — already the amount after commission —
--      and releasing it then debited `commission_usd` again. On a $400 job at
--      15% the freelancer was owed $340 and the ledger gave them $280. The
--      release no longer debits anything; the platform's share lives on the
--      escrow, the way a session's lives on the booking.
--   2. **Every signed-in person could read every receiving account in full.**
--      `payment_methods` was readable column by column by anybody logged in,
--      account and wallet numbers and IBANs included. The spec is right that
--      those must not be public. They are now readable only through a function
--      that shows them to somebody with a payment to make on that method, and
--      to admins.
--   3. **A mentor saw nothing between payment and payout.** The earning was
--      written only when the session completed, so a confirmed $35 session was
--      invisible in the mentor's wallet until afterwards. It is now written as
--      pending when the session is confirmed, and becomes available when it
--      happens — the same shape market work always had.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The commission, once
-- ---------------------------------------------------------------------------
create or replace function public.release_escrow(p_escrow uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_row public.escrows%rowtype;
begin
  select * into v_row from public.escrows where id = p_escrow;
  if not found then
    raise exception 'الحجز المالي غير موجود';
  end if;

  if v_row.status not in ('funded', 'disputed') then
    raise exception 'لا يمكن الإفراج عن حجز في هذه الحالة';
  end if;

  if v_row.payer_id is distinct from v_me and not public.is_admin() then
    raise exception 'الدافع فقط من يفرج عن المبلغ';
  end if;

  if v_row.status = 'disputed' and not public.is_admin() then
    raise exception 'الحجز في نزاع — القرار للإدارة';
  end if;

  update public.escrows
     set status = 'released', released_at = now(), resolution_ar = coalesce(p_note, resolution_ar)
   where id = p_escrow;

  -- The earning was written at net_usd when the money arrived: it is already
  -- the payee's share after commission. Making it spendable is the whole of
  -- the release — there is nothing left to deduct.
  perform public.distribute_escrow_release(p_escrow);

  perform public.notify(
    v_row.payee_id, 'payment', 'أُفرج عن مستحقاتك',
    'المبلغ متاح الآن في محفظتك.', '/wallet', 'escrow', p_escrow);
end;
$$;

-- Correct whatever the old release wrote. Idempotent, and a no-op on a
-- database that never ran it.
update public.wallet_entries
   set status = 'cancelled',
       description_ar = description_ar || ' — أُلغيت: خُصمت العمولة مرتين (0075)'
 where kind = 'commission'
   and ref_table = 'escrows'
   and status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- A payment gets a name a person can read out, and a currency
--
-- Bookings, escrows and payouts have had human codes since they were built; a
-- payment never did, so a receipt could only be quoted by its uuid. And every
-- amount was dollars, although PalPay and bank transfers here move shekels and
-- dinars too. The ledger stays in USD — no automatic conversion in the MVP —
-- but a payment now records what was actually sent, in what, at what rate.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column payment_code text unique
    default ('TMPAY-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  add column paid_currency text not null default 'USD' check (paid_currency in ('USD', 'ILS', 'JOD')),
  add column paid_amount   numeric(12,2) check (paid_amount is null or paid_amount > 0),
  add column exchange_rate numeric(12,6) not null default 1 check (exchange_rate > 0),
  -- the admin's question, and the payer's answer, when a receipt raises one
  add column info_request_ar text,
  add column payer_note_ar   text;

alter table public.payments alter column payment_code set not null;

-- ---------------------------------------------------------------------------
-- 2. Receiving accounts are not public
-- ---------------------------------------------------------------------------
-- Which purposes an account collects for. The spec's "Active for Mentoring /
-- Projects / Course payments"; withdrawals were already `supports_payout`.
alter table public.payment_methods
  add column use_for text[] not null default array['mentoring', 'projects', 'sales']
    check (use_for <@ array['mentoring', 'projects', 'sales', 'courses']);

-- Column privileges, not a policy: a policy decides which rows, and every row
-- here is meant to be listed. What must not be listed is four of its columns.
-- NB: several older migrations end with `grant select on all tables … to
-- authenticated`; running that line again would undo this. Section 56 of the
-- tests reads `account_number` as an ordinary user precisely so that it fails
-- loudly if that ever happens.
revoke select on public.payment_methods from anon, authenticated;

grant select (
  key, name_ar, name_en, icon, category, is_enabled, sort_order, instructions_ar,
  requires_receipt, requires_reference, reference_label_ar,
  supports_automatic_payment, supports_payout, use_for, created_at, updated_at
) on public.payment_methods to authenticated;

-- The last four characters, which is all a list or a receipt ever needs.
create or replace function public.mask_account(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when length(p_value) <= 4 then repeat('•', length(p_value))
    else repeat('•', least(length(p_value) - 4, 8)) || right(p_value, 4)
  end;
$$;

grant execute on function public.mask_account(text) to anon, authenticated;

-- Where to send the money — shown in full only to the person who owes it, on
-- the method they chose, while the payment is still open.
create or replace function public.payment_instructions(p_payment uuid)
returns table (
  method_key      text,
  name_ar         text,
  name_en         text,
  icon            text,
  instructions_ar text,
  recipient_name  text,
  account_number  text,
  wallet_number   text,
  iban            text,
  swift           text,
  bank_name       text,
  bank_address    text,
  city            text,
  country         text,
  requires_receipt   boolean,
  requires_reference boolean,
  reference_label_ar text,
  amount_usd      numeric,
  payment_code    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.key, m.name_ar, m.name_en, m.icon, m.instructions_ar,
         m.recipient_name, m.account_number, m.wallet_number, m.iban, m.swift,
         m.bank_name, m.bank_address, m.city, m.country,
         m.requires_receipt, m.requires_reference, m.reference_label_ar,
         p.amount_usd, p.payment_code
    from public.payments p
    join public.payment_methods m on m.key = p.method_key
    left join public.bookings b on b.id = p.booking_id
    left join public.escrows e on e.id = p.escrow_id
   where p.id = p_payment
     and p.status in ('pending', 'rejected', 'needs_info', 'under_review')
     and (b.student_id = (select auth.uid()) or e.payer_id = (select auth.uid()));
$$;

grant execute on function public.payment_instructions(uuid) to authenticated;

-- The admin's view: everything, because an admin is who types it in.
create or replace function public.admin_payment_accounts()
returns setof public.payment_methods
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'حسابات الاستلام للإدارة فقط';
  end if;
  return query select * from public.payment_methods order by sort_order;
end;
$$;

grant execute on function public.admin_payment_accounts() to authenticated;

create or replace function public.save_payment_account(
  p_key            text,
  p_enabled        boolean,
  p_recipient_name text default null,
  p_account_number text default null,
  p_wallet_number  text default null,
  p_iban           text default null,
  p_swift          text default null,
  p_bank_name      text default null,
  p_instructions   text default null,
  p_use_for        text[] default null,
  p_supports_payout boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'حسابات الاستلام للإدارة فقط';
  end if;

  update public.payment_methods
     set is_enabled      = p_enabled,
         recipient_name  = nullif(btrim(coalesce(p_recipient_name, '')), ''),
         account_number  = nullif(btrim(coalesce(p_account_number, '')), ''),
         wallet_number   = nullif(btrim(coalesce(p_wallet_number, '')), ''),
         iban            = nullif(btrim(coalesce(p_iban, '')), ''),
         swift           = nullif(btrim(coalesce(p_swift, '')), ''),
         bank_name       = nullif(btrim(coalesce(p_bank_name, '')), ''),
         instructions_ar = coalesce(nullif(btrim(coalesce(p_instructions, '')), ''), instructions_ar),
         use_for         = coalesce(p_use_for, use_for),
         supports_payout = coalesce(p_supports_payout, supports_payout)
   where key = p_key;

  if not found then
    raise exception 'طريقة الدفع غير موجودة';
  end if;

  -- An account that is switched on must have somewhere to send money to, or a
  -- payer is shown instructions that end in a blank.
  if p_enabled and not exists (
    select 1 from public.payment_methods m
     where m.key = p_key
       and (m.supports_automatic_payment
            or coalesce(m.account_number, m.wallet_number, m.iban) is not null
            or (m.recipient_name is not null and m.key in ('western_union', 'moneygram')))
  ) then
    raise exception 'لا يمكن تفعيل حساب استلام بلا رقم حساب أو محفظة';
  end if;
end;
$$;

grant execute on function public.save_payment_account(
  text, boolean, text, text, text, text, text, text, text, text[], boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A question instead of a rejection
-- ---------------------------------------------------------------------------
create or replace function public.request_payment_info(p_payment uuid, p_question text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.payments%rowtype;
  v_hold integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
  v_to   uuid;
  v_link text;
begin
  if not public.is_admin() then
    raise exception 'مراجعة المدفوعات للإدارة فقط';
  end if;

  if coalesce(btrim(p_question), '') = '' then
    raise exception 'اكتب ما الذي تحتاج معرفته';
  end if;

  select * into v_row from public.payments where id = p_payment;
  if not found then
    raise exception 'الدفعة غير موجودة';
  end if;

  if v_row.status <> 'under_review' then
    raise exception 'السؤال يكون عن دفعة قيد المراجعة';
  end if;

  update public.payments
     set status = 'needs_info', info_request_ar = btrim(p_question)
   where id = p_payment;

  if v_row.booking_id is not null then
    -- The slot stays theirs while they answer; a question is not a reason to
    -- lose it.
    update public.bookings
       set status = 'payment_pending',
           reserved_until = greatest(coalesce(reserved_until, now()), now() + (v_hold || ' minutes')::interval)
     where id = v_row.booking_id;

    select b.student_id into v_to from public.bookings b where b.id = v_row.booking_id;
    v_link := '/bookings/' || v_row.booking_id::text || '/pay';
  else
    select e.payer_id, '/projects/' || coalesce(e.project_id::text, '')
      into v_to, v_link
      from public.escrows e where e.id = v_row.escrow_id;
  end if;

  perform public.notify(
    v_to, 'payment', 'سؤال عن دفعتك ' || v_row.payment_code, p_question,
    v_link, 'payment', p_payment, 'important');
end;
$$;

grant execute on function public.request_payment_info(uuid, text) to authenticated;

create or replace function public.answer_payment_info(
  p_payment    uuid,
  p_note       text,
  p_proof_path text default null,
  p_reference  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments%rowtype;
  v_me  uuid := (select auth.uid());
begin
  select * into v_row from public.payments where id = p_payment;
  if not found then
    raise exception 'الدفعة غير موجودة';
  end if;

  if not exists (
    select 1 from public.bookings b where b.id = v_row.booking_id and b.student_id = v_me
    union all
    select 1 from public.escrows e where e.id = v_row.escrow_id and e.payer_id = v_me
  ) then
    raise exception 'الدافع فقط من يجيب عن دفعته';
  end if;

  if v_row.status <> 'needs_info' then
    raise exception 'لا سؤال مفتوح على هذه الدفعة';
  end if;

  if coalesce(btrim(p_note), '') = '' then
    raise exception 'اكتب جوابك';
  end if;

  update public.payments
     set status        = 'under_review',
         payer_note_ar = btrim(p_note),
         proof_path    = coalesce(nullif(btrim(coalesce(p_proof_path, '')), ''), proof_path),
         reference     = coalesce(nullif(btrim(coalesce(p_reference, '')), ''), reference),
         submitted_at  = now()
   where id = p_payment;

  if v_row.booking_id is not null then
    update public.bookings set status = 'payment_submitted' where id = v_row.booking_id;
  end if;
end;
$$;

grant execute on function public.answer_payment_info(uuid, text, text, text) to authenticated;

-- What was actually sent, in what. Recorded, never converted: the admin sees
-- "₪130 at 3.71" beside the $35 owed, and decides.
create or replace function public.report_payment_currency(
  p_payment  uuid,
  p_currency text,
  p_amount   numeric,
  p_rate     numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments%rowtype;
  v_me  uuid := (select auth.uid());
begin
  select * into v_row from public.payments where id = p_payment;

  if not exists (
    select 1 from public.bookings b where b.id = v_row.booking_id and b.student_id = v_me
    union all
    select 1 from public.escrows e where e.id = v_row.escrow_id and e.payer_id = v_me
  ) then
    raise exception 'الدافع فقط من يسجّل ما دفعه';
  end if;

  if v_row.status not in ('pending', 'rejected', 'needs_info') then
    raise exception 'لا يمكن تعديل دفعة بعد تسليمها للمراجعة';
  end if;

  update public.payments
     set paid_currency = upper(p_currency),
         paid_amount   = p_amount,
         exchange_rate = coalesce(p_rate, case when upper(p_currency) = 'USD' then 1 else exchange_rate end)
   where id = p_payment;
end;
$$;

grant execute on function public.report_payment_currency(uuid, text, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. A withdrawal says where it is: requested → processing → completed
-- ---------------------------------------------------------------------------
alter table public.payout_requests
  add column processing_at timestamptz,
  -- the admin's own receipt for the transfer, optional, never a public url
  add column proof_path text;

create or replace function public.start_payout_transfer(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payout_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'التحويل للإدارة فقط';
  end if;

  select * into v_row from public.payout_requests where id = p_request;
  if not found then
    raise exception 'طلب السحب غير موجود';
  end if;

  if v_row.status <> 'requested' then
    raise exception 'هذا الطلب ليس بانتظار التحويل';
  end if;

  -- 'approved' has been the in-between state since 0022; this is the moment it
  -- means something — somebody is sending the money now.
  update public.payout_requests
     set status = 'approved', processing_at = now(), reviewed_by = (select auth.uid())
   where id = p_request;

  perform public.notify(
    v_row.profile_id, 'payment', 'جارٍ تحويل مستحقاتك ' || v_row.request_code, null,
    '/wallet?tab=withdrawals', 'payout', p_request);
end;
$$;

grant execute on function public.start_payout_transfer(uuid) to authenticated;

create or replace function public.attach_payout_proof(p_request uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'إثبات التحويل للإدارة فقط';
  end if;

  update public.payout_requests set proof_path = p_path where id = p_request;
  if not found then
    raise exception 'طلب السحب غير موجود';
  end if;
end;
$$;

grant execute on function public.attach_payout_proof(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('payout-proofs', 'payout-proofs', false)
on conflict (id) do nothing;

-- Filed under the payee's own folder: they can read the receipt for money sent
-- to them, an admin can read and write all of them, nobody else sees any.
create policy payout_proofs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payout-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

create policy payout_proofs_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payout-proofs' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. A timeline for every payment, withdrawal and hold
--
-- Written by triggers, so no code path can move money without leaving a line:
-- the status column changes, the trigger writes what it changed to and who
-- changed it. Read only through `finance_timeline()`, which asks whether the
-- reader is a party to it.
-- ---------------------------------------------------------------------------
create table public.finance_events (
  id          uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null check (entity_type in ('payment', 'payout', 'escrow')),
  entity_id   uuid not null,
  event_key   text not null,
  note_ar     text,
  actor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default clock_timestamp()
);

create index finance_events_entity_idx on public.finance_events (entity_type, entity_id, created_at);

alter table public.finance_events enable row level security;
-- no policies: append-only, and read through the function below

create or replace function public.log_finance_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := case tg_table_name
                   when 'payments' then 'payment'
                   when 'payout_requests' then 'payout'
                   else 'escrow' end;
  v_key  text;
  v_note text;
  v_row  jsonb;
begin
  if tg_op = 'INSERT' then
    v_key := case v_type when 'payout' then 'requested' when 'escrow' then 'opened' else 'created' end;
  elsif new.status is distinct from old.status then
    v_key := new.status::text;
  else
    return new;
  end if;

  -- One trigger serves three tables with different columns, so the row is read
  -- as json: naming `new.paid_reference` on a payment would not compile.
  v_row := to_jsonb(new);
  v_note := case
    when v_type = 'payment' and v_key = 'rejected'   then v_row ->> 'rejection_reason'
    when v_type = 'payment' and v_key = 'needs_info' then v_row ->> 'info_request_ar'
    when v_type = 'payment' and v_key = 'under_review' and tg_op = 'UPDATE'
         and old.status::text = 'needs_info'         then v_row ->> 'payer_note_ar'
    when v_type = 'payout'  and v_key = 'paid'       then v_row ->> 'paid_reference'
    when v_type = 'payout'  and v_key = 'rejected'   then v_row ->> 'note_ar'
    when v_type = 'escrow'  and v_key = 'disputed'   then v_row ->> 'dispute_reason_ar'
    else null
  end;

  insert into public.finance_events (entity_type, entity_id, event_key, note_ar, actor_id)
  values (v_type, new.id, v_key, v_note, (select auth.uid()));

  return new;
end;
$$;

create trigger payments_finance_log
  after insert or update of status on public.payments
  for each row execute function public.log_finance_event();

create trigger payout_requests_finance_log
  after insert or update of status on public.payout_requests
  for each row execute function public.log_finance_event();

create trigger escrows_finance_log
  after insert or update of status on public.escrows
  for each row execute function public.log_finance_event();

-- The rows that existed before this migration get their present state as
-- their first line, rather than an empty history that implies nothing happened.
insert into public.finance_events (entity_type, entity_id, event_key, note_ar, created_at)
select 'payment', p.id, p.status::text, 'حالة سابقة لبدء السجلّ', coalesce(p.updated_at, p.created_at)
  from public.payments p;
insert into public.finance_events (entity_type, entity_id, event_key, note_ar, created_at)
select 'payout', r.id, r.status::text, 'حالة سابقة لبدء السجلّ', r.created_at
  from public.payout_requests r;
insert into public.finance_events (entity_type, entity_id, event_key, note_ar, created_at)
select 'escrow', e.id, e.status::text, 'حالة سابقة لبدء السجلّ', e.created_at
  from public.escrows e;

-- Who is a party to a money movement: whoever pays, whoever is paid, an admin.
create or replace function public.is_finance_party(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or case p_type
    when 'payment' then exists (
      select 1 from public.payments p
        left join public.bookings b on b.id = p.booking_id
        left join public.escrows e on e.id = p.escrow_id
       where p.id = p_id
         and (select auth.uid()) in (b.student_id, b.mentor_id, e.payer_id, e.payee_id))
    when 'payout' then exists (
      select 1 from public.payout_requests r
       where r.id = p_id and r.profile_id = (select auth.uid()))
    when 'escrow' then exists (
      select 1 from public.escrows e
       where e.id = p_id and (select auth.uid()) in (e.payer_id, e.payee_id))
    else false
  end;
$$;

create or replace function public.finance_timeline(p_type text, p_id uuid)
returns table (
  event_key  text,
  note_ar    text,
  actor_name text,
  actor_is_admin boolean,
  at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select fe.event_key, fe.note_ar,
         coalesce(pr.display_name, pr.full_name),
         exists (select 1 from public.profile_roles r
                  where r.profile_id = fe.actor_id and r.role = 'admin' and r.status = 'approved'),
         fe.created_at
    from public.finance_events fe
    left join public.profiles pr on pr.id = fe.actor_id
   where fe.entity_type = p_type and fe.entity_id = p_id
     and public.is_finance_party(p_type, p_id)

  union all

  -- a booking's own events belong in its payment's story: the mentor told,
  -- the mentor accepting, the session happening
  select 'booking:' || be.event_key, be.note_ar,
         coalesce(pr.display_name, pr.full_name), false, be.created_at
    from public.payments p
    join public.booking_events be on be.booking_id = p.booking_id
    left join public.profiles pr on pr.id = be.actor_id
   where p_type = 'payment' and p.id = p_id
     and public.is_finance_party(p_type, p_id)

  order by 5;
$$;

grant execute on function public.finance_timeline(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. A mentor's share is visible from the moment it is owed
-- ---------------------------------------------------------------------------
create or replace function public.on_booking_completed_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Confirmed: the student paid and the mentor said yes. The share is owed,
  -- not yet earned — the session has not happened.
  if new.status = 'confirmed' and not exists (
    select 1 from public.wallet_entries w
     where w.ref_table = 'bookings' and w.ref_id = new.id and w.kind = 'earning'
  ) then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (new.mentor_id, 'earning', new.mentor_share_usd, 'pending',
            'أرباح جلسة إرشاد ' || new.booking_code || ' — بعد انعقادها', 'bookings', new.id);
  end if;

  -- Completed: it happened. The same row becomes spendable; a booking that
  -- skipped straight here (an admin correction) still gets its row.
  if new.status = 'completed' then
    update public.wallet_entries
       set status = 'available',
           description_ar = 'أرباح جلسة إرشاد ' || new.booking_code
     where ref_table = 'bookings' and ref_id = new.id and kind = 'earning' and status = 'pending';

    if not found and not exists (
      select 1 from public.wallet_entries w
       where w.ref_table = 'bookings' and w.ref_id = new.id and w.kind = 'earning'
    ) then
      insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
      values (new.mentor_id, 'earning', new.mentor_share_usd, 'available',
              'أرباح جلسة إرشاد ' || new.booking_code, 'bookings', new.id);
    end if;
  end if;

  -- Called off before it happened: nothing was earned.
  if new.status in ('cancelled', 'rejected', 'refunded', 'expired') then
    update public.wallet_entries
       set status = 'cancelled'
     where ref_table = 'bookings' and ref_id = new.id and kind = 'earning' and status = 'pending';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. A team's share, split the way the team agreed
--
-- Until now the escrow's payee was one person — whoever owned the project —
-- and a team's work paid its owner. The split is now written down before the
-- money is released: suggested from the work each member actually finished on
-- the board (`project_contributions()`), adjusted by whoever leads, visible to
-- every member, and fixed the moment money is released against it.
-- ---------------------------------------------------------------------------
create table public.project_splits (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  percent    numeric(5,2) not null check (percent > 0 and percent <= 100),
  set_by     uuid references public.profiles (id) on delete set null,
  set_at     timestamptz not null default now(),

  primary key (project_id, profile_id)
);

alter table public.project_splits enable row level security;

-- Every member sees what every member gets. A split kept from the people it
-- divides is the start of an argument, not the end of one.
create policy project_splits_read on public.project_splits
  for select to authenticated
  using (public.is_project_party(project_id));

grant select on public.project_splits to authenticated;

create or replace function public.suggested_project_split(p_project uuid)
returns table (profile_id uuid, full_name text, tasks_done integer, percent numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with work as (
    select c.profile_id, c.full_name, c.tasks_done
      from public.project_contributions(p_project) c
  ),
  total as (select sum(tasks_done) as n, count(*) as people from work)
  select w.profile_id, w.full_name, w.tasks_done,
         case when t.n > 0 then round(w.tasks_done * 100.0 / t.n, 2)
              else round(100.0 / nullif(t.people, 0), 2) end
    from work w cross join total t
   where public.is_project_party(p_project)
   order by w.tasks_done desc;
$$;

grant execute on function public.suggested_project_split(uuid) to authenticated;

create or replace function public.set_project_split(p_project uuid, p_splits jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_total   numeric;
  v_row     jsonb;
begin
  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if v_project.team_id is null then
    raise exception 'التقسيم لمشاريع الفرق فقط';
  end if;

  if not (v_project.owner_id = v_me or public.is_team_leader(v_project.team_id) or public.is_admin()) then
    raise exception 'قائد الفريق أو صاحب المشروع فقط من يضع التقسيم';
  end if;

  if exists (select 1 from public.escrows e
              where e.project_id = p_project and e.status = 'released') then
    raise exception 'التقسيم ثابت بعد الإفراج عن أول مبلغ';
  end if;

  select coalesce(sum((r ->> 'percent')::numeric), 0) into v_total
    from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) r;

  if v_total <> 100 then
    raise exception 'مجموع النسب يجب أن يكون 100%%، وهو الآن %', v_total;
  end if;

  for v_row in select * from jsonb_array_elements(p_splits)
  loop
    if not exists (
      select 1 from public.team_members tm
       where tm.team_id = v_project.team_id and tm.is_active
         and tm.profile_id = (v_row ->> 'profile_id')::uuid
    ) and (v_row ->> 'profile_id')::uuid <> v_project.owner_id then
      raise exception 'التقسيم لأعضاء الفريق فقط';
    end if;
  end loop;

  delete from public.project_splits where project_id = p_project;

  insert into public.project_splits (project_id, profile_id, percent, set_by)
  select p_project, (r ->> 'profile_id')::uuid, (r ->> 'percent')::numeric, v_me
    from jsonb_array_elements(p_splits) r;

  -- every member hears what they are getting, from the database, not a rumour
  perform public.notify(
    s.profile_id, 'team', 'تقسيم مستحقات ' || v_project.title_ar,
    'نصيبك ' || s.percent::text || '%', '/projects/' || p_project::text, 'project', p_project)
    from public.project_splits s
   where s.project_id = p_project and s.profile_id <> v_me;
end;
$$;

grant execute on function public.set_project_split(uuid, jsonb) to authenticated;

-- Releasing an escrow: one payee, or the team as agreed.
create or replace function public.distribute_escrow_release(p_escrow uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    public.escrows%rowtype;
  v_given  numeric := 0;
  v_share  numeric;
  v_split  record;
begin
  select * into v_row from public.escrows where id = p_escrow;

  if v_row.kind <> 'market_work' or v_row.project_id is null
     or not exists (select 1 from public.project_splits s where s.project_id = v_row.project_id) then
    update public.wallet_entries
       set status = 'available'
     where ref_table = 'escrows' and ref_id = p_escrow and kind = 'earning' and status = 'pending';
    return;
  end if;

  -- The held row was the payee's whole share; it is replaced by one row per
  -- member. Cancelled rather than deleted, so the ledger still shows it existed.
  update public.wallet_entries
     set status = 'cancelled',
         description_ar = description_ar || ' — وُزّع على الفريق'
   where ref_table = 'escrows' and ref_id = p_escrow and kind = 'earning' and status = 'pending';

  for v_split in
    select s.profile_id, s.percent from public.project_splits s
     where s.project_id = v_row.project_id
     order by (s.profile_id = v_row.payee_id), s.percent
  loop
    -- the last row, the payee's, takes whatever rounding left over, so the
    -- shares always add up to the net exactly
    if v_split.profile_id = v_row.payee_id then
      v_share := v_row.net_usd - v_given;
    else
      -- truncated, never rounded up, so the shares can never exceed the net
      v_share := trunc(v_row.net_usd * v_split.percent / 100, 2);
      v_given := v_given + v_share;
    end if;

    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (v_split.profile_id, 'earning', v_share, 'available',
            'نصيبك (' || v_split.percent::text || '%) من عمل الفريق', 'escrows', p_escrow);
  end loop;

  -- a split that does not name the payee still pays out the rounding to them
  if not exists (select 1 from public.project_splits s
                  where s.project_id = v_row.project_id and s.profile_id = v_row.payee_id)
     and v_row.net_usd - v_given > 0 then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (v_row.payee_id, 'earning', v_row.net_usd - v_given, 'available',
            'فرق التقريب من توزيع عمل الفريق', 'escrows', p_escrow);
  end if;
end;
$$;

revoke execute on function public.distribute_escrow_release(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Reading it: one wallet, whose contents follow what a person does
--
-- The spec's point, and the right one: a learner who only pays has no
-- "balance" worth showing, and a mentor who only earns has no "spending". So
-- the overview returns both halves and the screen shows the one that has
-- anything in it — Payment History, Earnings & Withdrawals, or both.
-- ---------------------------------------------------------------------------
create or replace function public.wallet_overview()
returns table (
  -- as somebody who pays
  paid_usd            numeric,
  under_review_usd    numeric,
  refunded_usd        numeric,
  open_payments       integer,
  -- as somebody who is paid
  pending_usd         numeric,
  available_usd       numeric,
  withdrawal_pending_usd numeric,
  withdrawn_usd       numeric,
  total_earned_usd    numeric,
  open_withdrawals    integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  my_payments as (
    select p.*
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.escrows e on e.id = p.escrow_id
      cross join me
     where b.student_id = me.id or e.payer_id = me.id
  ),
  mine as (select w.* from public.wallet_entries w, me where w.profile_id = me.id)
  select
    coalesce((select sum(amount_usd) from my_payments where status = 'verified'), 0),
    coalesce((select sum(amount_usd) from my_payments where status in ('under_review', 'needs_info')), 0),
    coalesce((select sum(amount_usd) from my_payments where status = 'refunded'), 0),
    (select count(*)::int from my_payments where status in ('pending', 'under_review', 'needs_info', 'rejected')),

    coalesce((select sum(amount_usd) from mine where kind = 'earning' and status = 'pending'), 0),
    coalesce((select sum(amount_usd) from mine where status in ('available', 'paid')), 0),
    -- a request that is open still sits in the ledger as a held negative row;
    -- this is that row, named for what it is
    coalesce((select -sum(w.amount_usd) from mine w
               join public.payout_requests r on r.ledger_entry_id = w.id
              where r.status in ('requested', 'approved')), 0),
    coalesce((select -sum(amount_usd) from mine where kind = 'payout' and status = 'paid'), 0),
    coalesce((select sum(amount_usd) from mine where kind = 'earning' and status <> 'cancelled'), 0),
    (select count(*)::int from public.payout_requests r, me
      where r.profile_id = me.id and r.status in ('requested', 'approved'));
$$;

grant execute on function public.wallet_overview() to authenticated;

-- Every movement, as one statement. `p_filter` is the spec's tabs.
create or replace function public.wallet_transactions(p_filter text default 'all', p_limit integer default 100)
returns table (
  entity_type text,
  entity_id   uuid,
  code        text,
  kind        text,
  label_ar    text,
  amount_usd  numeric,
  status      text,
  at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  rows as (
    -- what I paid
    select 'payment'::text as entity_type, p.id as entity_id, p.payment_code as code,
           'payment'::text as kind,
           coalesce(
             case when b.id is not null then 'جلسة إرشاد ' || b.booking_code end,
             (select pr.title_ar from public.projects pr where pr.id = e.project_id),
             'دفعة') as label_ar,
           -p.amount_usd as amount_usd,
           p.status::text as status,
           coalesce(p.verified_at, p.submitted_at, p.created_at) as at
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.escrows e on e.id = p.escrow_id
      cross join me
     where b.student_id = me.id or e.payer_id = me.id

    union all

    -- what the ledger says is mine
    select case when w.kind = 'payout' then 'payout' else 'ledger' end,
           coalesce(case when w.kind = 'payout' then w.ref_id end, w.id),
           (select r.request_code from public.payout_requests r where r.ledger_entry_id = w.id),
           w.kind::text, w.description_ar, w.amount_usd,
           coalesce((select r.status::text from public.payout_requests r where r.ledger_entry_id = w.id),
                    w.status::text),
           w.created_at
      from public.wallet_entries w, me
     where w.profile_id = me.id
  )
  select * from rows
   where case coalesce(p_filter, 'all')
     when 'income'      then kind = 'earning'
     when 'payments'    then kind = 'payment'
     when 'withdrawals' then kind = 'payout'
     when 'refunds'     then kind = 'refund' or status = 'refunded'
     when 'fees'        then kind in ('fee', 'commission')
     when 'pending'     then status in ('pending', 'under_review', 'needs_info', 'requested', 'approved')
     when 'completed'   then status in ('verified', 'available', 'paid')
     else true
   end
   order by at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.wallet_transactions(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. The admin's picture: GMV, revenue and user earnings, never confused
--
-- The spec's most important accounting sentence: 100 sessions at $35 is $3,500
-- of volume, not $3,500 of revenue. TechMood's revenue is its share and only
-- its share; what it owes the people who did the work is theirs.
-- ---------------------------------------------------------------------------
create or replace function public.finance_overview(p_from date default null, p_to date default null)
returns table (
  gmv_usd                 numeric,
  platform_revenue_usd    numeric,
  user_earnings_usd       numeric,
  refunded_usd            numeric,
  pending_verification_usd numeric,
  pending_verification    integer,
  needs_info              integer,
  pending_withdrawals_usd numeric,
  pending_withdrawals     integer,
  held_in_escrow_usd      numeric,
  disputes                integer,
  owed_to_users_usd       numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_from, date '2000-01-01')::timestamptz;
  v_to   timestamptz := (coalesce(p_to, current_date) + 1)::timestamptz;
begin
  if not public.is_admin() then
    raise exception 'الصورة المالية للإدارة فقط';
  end if;

  return query
  select
    -- everything customers paid that TechMood confirmed, in the window
    coalesce((select sum(p.amount_usd) from public.payments p
               where p.status in ('verified', 'refunded')
                 and p.verified_at >= v_from and p.verified_at < v_to), 0),
    -- TechMood's share: sessions that were not refunded, commission on market
    -- work that was released
    coalesce((select sum(b.platform_share_usd) from public.bookings b
               join public.payments p on p.booking_id = b.id and p.status = 'verified'
              where p.verified_at >= v_from and p.verified_at < v_to), 0)
    + coalesce((select sum(e.commission_usd) from public.escrows e
                 where e.status = 'released'
                   and e.released_at >= v_from and e.released_at < v_to), 0),
    -- what became owed to people, in the window
    coalesce((select sum(w.amount_usd) from public.wallet_entries w
               where w.kind = 'earning' and w.status <> 'cancelled'
                 and w.created_at >= v_from and w.created_at < v_to), 0),
    coalesce((select sum(p.amount_usd) from public.payments p
               where p.status = 'refunded'
                 and p.updated_at >= v_from and p.updated_at < v_to), 0),
    -- right now, whatever the window
    coalesce((select sum(p.amount_usd) from public.payments p where p.status = 'under_review'), 0),
    (select count(*)::int from public.payments p where p.status = 'under_review'),
    (select count(*)::int from public.payments p where p.status = 'needs_info'),
    coalesce((select sum(r.amount_usd) from public.payout_requests r
               where r.status in ('requested', 'approved')), 0),
    (select count(*)::int from public.payout_requests r where r.status in ('requested', 'approved')),
    coalesce((select sum(e.amount_usd) from public.escrows e where e.status in ('funded', 'disputed')), 0),
    (select count(*)::int from public.escrows e where e.status = 'disputed'),
    -- every available balance, summed: what TechMood would owe if everyone
    -- asked for their money today
    coalesce((select sum(greatest(b.available_usd, 0)) from public.wallet_balance b), 0);
end;
$$;

grant execute on function public.finance_overview(date, date) to authenticated;

-- An escrow payer answers a question the way they first paid: a receipt and a
-- reference. `needs_info` is therefore an open payment here too.
create or replace function public.submit_escrow_proof(
  p_escrow    uuid,
  p_proof_path text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_escrow  public.escrows%rowtype;
  v_payment public.payments%rowtype;
  v_method  public.payment_methods%rowtype;
begin
  select * into v_escrow from public.escrows where id = p_escrow;
  if not found then
    raise exception 'الحجز المالي غير موجود';
  end if;

  if v_escrow.payer_id is distinct from (select auth.uid()) then
    raise exception 'الدافع فقط من يرفع الإيصال';
  end if;

  select * into v_payment from public.payments
   where escrow_id = p_escrow and status in ('pending', 'rejected', 'needs_info')
   order by created_at desc limit 1;

  if v_payment.id is null then
    raise exception 'لا يوجد دفع مفتوح لهذا الحجز';
  end if;

  select * into v_method from public.payment_methods where key = v_payment.method_key;

  -- On an answer, the receipt already on file still counts.
  if v_method.requires_receipt
     and coalesce(p_proof_path, '') = ''
     and not (v_payment.status = 'needs_info' and v_payment.proof_path is not null) then
    raise exception 'هذه الطريقة تتطلب إيصالاً';
  end if;

  if v_method.requires_reference and coalesce(p_reference, v_payment.reference, '') = '' then
    raise exception 'هذه الطريقة تتطلب رقم عملية';
  end if;

  update public.payments
     set status = 'under_review',
         proof_path = coalesce(nullif(p_proof_path, ''), proof_path),
         reference = coalesce(nullif(p_reference, ''), reference),
         submitted_at = now(), rejection_reason = null
   where id = v_payment.id;
end;
$$;

-- The payee is told when the money is sent, or when it is not — the spec's
-- "Withdrawal Completed … Reference … Completed by TechMood" as a message,
-- not only as a row they would have to go looking for.
create or replace function public.review_payout(
  p_request   uuid,
  p_approve   boolean,
  p_reference text default null,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.payout_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'only an admin may review a payout request';
  end if;

  select * into v_request from public.payout_requests where id = p_request;
  if not found then
    raise exception 'payout request % not found', p_request;
  end if;

  if v_request.status in ('paid', 'rejected') then
    raise exception 'this payout request was already settled';
  end if;

  if p_approve then
    update public.payout_requests
       set status = 'paid', reviewed_by = (select auth.uid()), reviewed_at = now(),
           paid_reference = p_reference, note_ar = p_note
     where id = p_request;

    update public.wallet_entries
       set status = 'paid', description_ar = 'سحب رصيد ' || v_request.request_code
     where id = v_request.ledger_entry_id;

    perform public.notify(
      v_request.profile_id, 'payment', 'تمّ تحويل مستحقاتك ' || v_request.request_code,
      case when p_reference is not null then 'مرجع التحويل: ' || p_reference end,
      '/wallet/timeline/payout/' || p_request::text, 'payout', p_request, 'important');
  else
    update public.payout_requests
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
           note_ar = p_note
     where id = p_request;

    update public.wallet_entries
       set status = 'cancelled', description_ar = 'طلب سحب مرفوض ' || v_request.request_code
     where id = v_request.ledger_entry_id;

    perform public.notify(
      v_request.profile_id, 'payment', 'لم يُنفَّذ طلب السحب ' || v_request.request_code,
      p_note, '/wallet?tab=withdrawals', 'payout', p_request, 'important');
  end if;
end;
$$;
