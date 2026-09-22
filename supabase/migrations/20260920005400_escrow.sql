-- =============================================================================
-- 0054 — Money that is held, and a commission that is written down
--
-- Until now the market moved no money at all: an opening was posted, somebody
-- was accepted, and what happened after that was between two people and a bank
-- transfer the platform knew nothing about. That is the one part of a market
-- that cannot be left to good faith on either side — the client fears paying
-- for nothing, and the freelancer fears working for nothing.
--
-- Escrow is the answer both sides can check:
--
--   client pays TechMood ──> held ──> work delivered ──> released to the freelancer
--                                 └─> not delivered ──> refunded to the client
--
-- Three things make this honest rather than a promise:
--
--   * **The money is real money, through the path that already exists.** An
--     escrow is funded through `payments` — the same receipt, the same admin
--     verification, the same queue as a booking. No second payment system.
--   * **The freelancer sees it the moment it lands.** Funding writes a pending
--     earning into their wallet: visible, not spendable. Releasing makes the
--     same row available. Nothing is invented at release time.
--   * **The commission is a rule, not a number somebody typed.** Rates live in
--     a table, in brackets, and `compute_commission()` is the only thing that
--     reads them — so every screen quotes the same figure, and changing a rate
--     is one row and not a search through the code.
-- =============================================================================

create type public.escrow_status as enum (
  'awaiting_payment', 'funded', 'released', 'refunded', 'disputed', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- The commission, in brackets
-- ---------------------------------------------------------------------------
-- Bigger work carries a smaller rate: the platform's cost per piece of work
-- does not grow with its price, and pretending otherwise pushes the biggest
-- work off the platform and into a private message.
create table public.commission_tiers (
  kind            text not null check (kind in ('market_work', 'project_sale')),
  min_amount_usd  numeric(10,2) not null check (min_amount_usd >= 0),
  rate_percent    numeric(5,2) not null check (rate_percent between 0 and 50),
  note_ar         text,

  primary key (kind, min_amount_usd)
);

alter table public.commission_tiers enable row level security;

-- Everybody may read what they will be charged; only an admin may change it.
create policy commission_tiers_read on public.commission_tiers
  for select to anon, authenticated using (true);

create policy commission_tiers_admin on public.commission_tiers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.commission_tiers to anon, authenticated;

insert into public.commission_tiers (kind, min_amount_usd, rate_percent, note_ar) values
  ('market_work',    0,    15.00, 'العمولة الأساسية على العمل عبر السوق'),
  ('market_work',  500,    12.00, 'من 500 دولار'),
  ('market_work', 2000,    10.00, 'من 2000 دولار'),
  ('project_sale',   0,    10.00, 'عمولة بيع مشروع جاهز'),
  ('project_sale', 1000,     8.00, 'من 1000 دولار');

create or replace function public.compute_commission(p_kind text, p_amount numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce(p_amount, 0) * coalesce((
      select ct.rate_percent / 100
        from public.commission_tiers ct
       where ct.kind = p_kind
         and ct.min_amount_usd <= coalesce(p_amount, 0)
       order by ct.min_amount_usd desc
       limit 1
    ), 0.15),
    2);
$$;

comment on function public.compute_commission is
  'The one place a commission is worked out. Every quote, every hold and every release reads it.';

grant execute on function public.compute_commission(text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The hold itself
-- ---------------------------------------------------------------------------
create table public.escrows (
  id            uuid primary key default extensions.gen_random_uuid(),
  escrow_code   text not null unique
                  default ('TME-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  kind          text not null check (kind in ('market_work', 'project_sale')),
  project_id    uuid references public.projects (id) on delete set null,
  payer_id      uuid not null references public.profiles (id) on delete restrict,
  payee_id      uuid not null references public.profiles (id) on delete restrict,
  amount_usd    numeric(10,2) not null check (amount_usd > 0),
  commission_usd numeric(10,2) not null check (commission_usd >= 0),
  net_usd       numeric(10,2) not null check (net_usd >= 0),
  status        public.escrow_status not null default 'awaiting_payment',
  dispute_reason_ar text,
  resolution_ar text,
  created_at    timestamptz not null default now(),
  funded_at     timestamptz,
  released_at   timestamptz,

  constraint escrow_shares_add_up check (commission_usd + net_usd = amount_usd),
  constraint escrow_two_sides check (payer_id <> payee_id)
);

create index escrows_payer_idx on public.escrows (payer_id, status);
create index escrows_payee_idx on public.escrows (payee_id, status);
create index escrows_project_idx on public.escrows (project_id);

alter table public.escrows enable row level security;

-- The two sides of the money, and the platform that holds it.
create policy escrows_read on public.escrows
  for select to authenticated
  using (payer_id = (select auth.uid()) or payee_id = (select auth.uid()) or public.is_admin());

grant select on public.escrows to authenticated;

-- A payment can now belong to an escrow instead of a booking. One table, one
-- receipt, one admin queue — a second payment system would be a second place
-- for money to go missing.
alter table public.payments
  alter column booking_id drop not null,
  add column escrow_id uuid references public.escrows (id) on delete cascade,
  add constraint payments_belongs_to_one check (
    (booking_id is not null and escrow_id is null) or
    (booking_id is null and escrow_id is not null)
  );

create unique index payments_one_active_per_escrow on public.payments (escrow_id)
  where status in ('pending', 'under_review', 'verified');

-- The payment timeline belongs to bookings: an escrow payment has no booking to
-- write a line on, so the trigger steps aside rather than failing.
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

  if new.booking_id is null then
    return new;
  end if;

  insert into public.booking_events (booking_id, event_key, actor_id, note_ar)
  values (new.booking_id, 'payment_' || new.status::text, (select auth.uid()), new.rejection_reason);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Opening a hold
-- ---------------------------------------------------------------------------
create or replace function public.open_escrow(
  p_kind       text,
  p_project    uuid,
  p_payee      uuid,
  p_amount     numeric,
  p_method_key text
)
returns public.escrows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me         uuid := (select auth.uid());
  v_commission numeric;
  v_escrow     public.escrows%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'المبلغ يجب أن يكون أكبر من صفر';
  end if;

  if p_payee = v_me then
    raise exception 'لا يمكنك أن تدفع لنفسك';
  end if;

  if not exists (
    select 1 from public.payment_methods pm where pm.key = p_method_key and pm.is_enabled
  ) then
    raise exception 'طريقة الدفع غير متاحة';
  end if;

  v_commission := public.compute_commission(p_kind, p_amount);

  insert into public.escrows (kind, project_id, payer_id, payee_id, amount_usd, commission_usd, net_usd)
  values (p_kind, p_project, v_me, p_payee, p_amount, v_commission, p_amount - v_commission)
  returning * into v_escrow;

  insert into public.payments (escrow_id, method_key, amount_usd, status)
  values (v_escrow.id, p_method_key, p_amount, 'pending');

  perform public.notify(
    p_payee, 'payment', 'فُتح حجز مالي لعملك',
    'سيُحتجز المبلغ لدى TechMood حتى تسليم العمل.',
    '/projects/' || coalesce(p_project::text, '')
  );

  return v_escrow;
end;
$$;

grant execute on function public.open_escrow(text, uuid, uuid, numeric, text) to authenticated;

-- The payer attaches the receipt, exactly as they would for a booking.
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
   where escrow_id = p_escrow and status in ('pending', 'rejected')
   order by created_at desc limit 1;

  if v_payment.id is null then
    raise exception 'لا يوجد دفع مفتوح لهذا الحجز';
  end if;

  select * into v_method from public.payment_methods where key = v_payment.method_key;

  if v_method.requires_receipt and coalesce(p_proof_path, '') = '' then
    raise exception 'هذه الطريقة تتطلب إيصالاً';
  end if;

  if v_method.requires_reference and coalesce(p_reference, '') = '' then
    raise exception 'هذه الطريقة تتطلب رقم عملية';
  end if;

  update public.payments
     set status = 'under_review', proof_path = p_proof_path, reference = p_reference,
         submitted_at = now(), rejection_reason = null
   where id = v_payment.id;
end;
$$;

grant execute on function public.submit_escrow_proof(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Verifying it: the same admin, the same queue
-- ---------------------------------------------------------------------------
-- Funding does not pay anybody. It writes the earning into the freelancer's
-- wallet as pending — visible, and not spendable until the work is accepted.
create or replace function public.verify_payment(p_payment_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking uuid;
  v_escrow  uuid;
  v_row     public.escrows%rowtype;
  v_hold    integer := coalesce(public.setting_int('booking_reservation_minutes'), 45);
begin
  if not public.is_admin() then
    raise exception 'only an admin may verify a payment';
  end if;

  select booking_id, escrow_id into v_booking, v_escrow
    from public.payments where id = p_payment_id;

  if v_booking is null and v_escrow is null then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- ----- an escrow -----
  if v_escrow is not null then
    select * into v_row from public.escrows where id = v_escrow;

    if p_approve then
      update public.payments
         set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
             rejection_reason = null
       where id = p_payment_id;

      update public.escrows set status = 'funded', funded_at = now() where id = v_escrow;

      -- The freelancer can see it, and cannot spend it yet.
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

  -- ----- a booking, exactly as before -----
  if p_approve then
    update public.payments
       set status = 'verified', verified_by = (select auth.uid()), verified_at = now(),
           rejection_reason = null
     where id = p_payment_id;

    update public.bookings set status = 'payment_verified' where id = v_booking;
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
-- Letting it go
-- ---------------------------------------------------------------------------
-- The payer releases, because they are the one who can say the work arrived.
-- An admin can too, and only for a hold that has been disputed — otherwise the
-- platform would be deciding a question it did not witness.
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

  -- The same row the freelancer has been looking at becomes spendable.
  update public.wallet_entries
     set status = 'available'
   where ref_table = 'escrows' and ref_id = p_escrow and kind = 'earning' and status = 'pending';

  if v_row.commission_usd > 0 then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (v_row.payee_id, 'commission', -v_row.commission_usd, 'available',
            'عمولة المنصة على عمل السوق', 'escrows', p_escrow);
  end if;

  perform public.notify(
    v_row.payee_id, 'payment', 'أُفرج عن مستحقاتك',
    'المبلغ متاح الآن في محفظتك.', '/wallet');
end;
$$;

grant execute on function public.release_escrow(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Taking it back
-- ---------------------------------------------------------------------------
-- Only an admin refunds, and only a disputed hold — a payer who could take the
-- money back at will is not an escrow, it is a promise.
create or replace function public.refund_escrow(p_escrow uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.escrows%rowtype;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;

  select * into v_row from public.escrows where id = p_escrow;
  if not found then
    raise exception 'الحجز المالي غير موجود';
  end if;

  if v_row.status not in ('funded', 'disputed') then
    raise exception 'لا يمكن استرداد حجز في هذه الحالة';
  end if;

  update public.escrows
     set status = 'refunded', released_at = now(), resolution_ar = p_reason
   where id = p_escrow;

  update public.wallet_entries
     set status = 'cancelled'
   where ref_table = 'escrows' and ref_id = p_escrow and kind = 'earning';

  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (v_row.payer_id, 'refund', v_row.amount_usd, 'available',
          'استرداد مبلغ محتجز', 'escrows', p_escrow);

  perform public.notify(v_row.payer_id, 'payment', 'أُعيد المبلغ إليك', p_reason, '/wallet');
  perform public.notify(v_row.payee_id, 'payment', 'أُعيد المبلغ للعميل', p_reason, '/wallet');
end;
$$;

grant execute on function public.refund_escrow(uuid, text) to authenticated;

-- Either side may say the two of them disagree. Saying so freezes the money
-- and hands the question to a human — it does not decide it.
create or replace function public.dispute_escrow(p_escrow uuid, p_reason text)
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

  if v_me not in (v_row.payer_id, v_row.payee_id) and not public.is_admin() then
    raise exception 'طرفا الحجز فقط من يفتحان نزاعاً';
  end if;

  if v_row.status <> 'funded' then
    raise exception 'النزاع يُفتح على مبلغ محتجز فقط';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'اكتب سبب النزاع';
  end if;

  update public.escrows
     set status = 'disputed', dispute_reason_ar = p_reason
   where id = p_escrow;
end;
$$;

grant execute on function public.dispute_escrow(uuid, text) to authenticated;

-- What a person is owed, and what is still held for them.
create or replace function public.my_escrows()
returns table (
  id uuid, escrow_code text, kind text, project_id uuid, project_title text,
  counterpart text, side text, amount_usd numeric, commission_usd numeric,
  net_usd numeric, status public.escrow_status, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select e.id, e.escrow_code, e.kind, e.project_id,
         (select p.title_ar from public.projects p where p.id = e.project_id),
         (select pr.full_name from public.profiles pr
           where pr.id = case when e.payer_id = me.id then e.payee_id else e.payer_id end),
         case when e.payer_id = me.id then 'paying' else 'earning' end,
         e.amount_usd, e.commission_usd, e.net_usd, e.status, e.created_at
    from public.escrows e cross join me
   where e.payer_id = me.id or e.payee_id = me.id
   order by e.created_at desc;
$$;

grant execute on function public.my_escrows() to authenticated;
