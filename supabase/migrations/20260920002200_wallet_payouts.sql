-- =============================================================================
-- TechMood — 0022 Wallet, payouts and refunds
--
-- Fixes a latent accounting bug and builds the missing half of the wallet.
--
-- THE BUG: a completed session credited the mentor their share AND debited them
-- the platform commission. But mentor_share_usd is already net of that cut —
-- L1 is a $15 session paid out as $5 platform + $10 mentor — so the commission
-- row double-counted. It was invisible only because available_usd counted the
-- 'available' status alone and the commission row was written as 'paid'. The
-- moment a payout needs the balance to move through statuses, the mentor would
-- have quietly lost the platform's cut a second time. The platform's revenue is
-- already recorded on the booking itself; it does not belong in the mentor's
-- ledger as a debit.
-- =============================================================================

create type public.payout_status as enum ('requested', 'approved', 'paid', 'rejected');

-- Not every rail TechMood collects money through is one it can send money out on.
alter table public.payment_methods
  add column supports_payout boolean not null default false;

update public.payment_methods
   set supports_payout = true
 where key in ('bank_of_palestine', 'palpay', 'jawwal_pay', 'western_union', 'moneygram', 'international_transfer');

insert into public.platform_settings (key, value, description_ar) values
  ('payout_minimum_usd', '20', 'أقل مبلغ يمكن طلب سحبه');

-- ---------------------------------------------------------------------------
-- Where a member's money goes. Their own account details, not TechMood's.
-- ---------------------------------------------------------------------------
create table public.payout_accounts (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  method_key     text not null references public.payment_methods (key) on delete restrict,
  label_ar       text,
  holder_name    text not null,
  account_number text,
  wallet_number  text,
  iban           text,
  swift          text,
  bank_name      text,
  country        text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),

  -- a rail with neither an account nor a wallet number cannot receive anything
  constraint payout_accounts_has_destination check (
    coalesce(account_number, wallet_number, iban) is not null
  )
);

create index payout_accounts_profile_idx on public.payout_accounts (profile_id);
create unique index payout_accounts_one_default on public.payout_accounts (profile_id)
  where is_default;

comment on table public.payout_accounts is
  'A member''s own receiving details. Personal financial data: readable by its '
  'owner and by an admin processing a payout, and by nobody else.';

-- ---------------------------------------------------------------------------
-- Payout requests, verified by hand like everything else in the MVP
-- ---------------------------------------------------------------------------
create table public.payout_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  request_code  text not null unique default ('TMW-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  account_id    uuid not null references public.payout_accounts (id) on delete restrict,
  amount_usd    numeric(10,2) not null check (amount_usd > 0),
  status        public.payout_status not null default 'requested',
  -- the ledger row that holds the money while the request is open
  ledger_entry_id uuid references public.wallet_entries (id) on delete set null,
  note_ar       text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  paid_reference text,
  created_at    timestamptz not null default now()
);

create index payout_requests_review_idx on public.payout_requests (status)
  where status in ('requested', 'approved');
create index payout_requests_profile_idx on public.payout_requests (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The corrected ledger: the mentor keeps their share, full stop.
-- ---------------------------------------------------------------------------
create or replace function public.on_booking_completed_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  -- mentor_share_usd is already net of the platform cut; the platform's revenue
  -- lives on bookings.platform_share_usd and is not a debit against the mentor.
  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (
    new.mentor_id, 'earning', new.mentor_share_usd, 'available',
    'أرباح جلسة إرشاد ' || new.booking_code, 'bookings', new.id
  );

  return new;
end;
$$;

-- Remove the double-counted commission rows written before this migration.
delete from public.wallet_entries where kind = 'commission';

-- ---------------------------------------------------------------------------
-- Balance. A payout has to reduce the balance and STAY reduced once paid, so
-- 'paid' counts alongside 'available'; only a cancelled row returns the money.
-- ---------------------------------------------------------------------------
create or replace view public.wallet_balance
with (security_invoker = true) as
  select p.id as profile_id,
         coalesce(sum(w.amount_usd) filter (where w.status in ('available', 'paid')), 0)::numeric(10,2) as available_usd,
         coalesce(sum(w.amount_usd) filter (where w.status = 'pending'), 0)::numeric(10,2)              as pending_usd,
         coalesce(sum(w.amount_usd) filter (where w.kind = 'earning' and w.status <> 'cancelled'), 0)::numeric(10,2) as total_earned_usd,
         coalesce(-sum(w.amount_usd) filter (where w.kind = 'payout' and w.status = 'paid'), 0)::numeric(10,2)       as total_paid_out_usd
  from public.profiles p
  left join public.wallet_entries w on w.profile_id = p.id
  group by p.id;

-- ---------------------------------------------------------------------------
-- Requesting a payout holds the money immediately, so the same balance cannot
-- be requested twice while an earlier request is still open.
-- ---------------------------------------------------------------------------
create or replace function public.request_payout(p_account uuid, p_amount numeric)
returns public.payout_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me        uuid := (select auth.uid());
  v_available numeric;
  v_minimum   numeric;
  v_account   public.payout_accounts%rowtype;
  v_entry     uuid;
  v_request   public.payout_requests%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_account from public.payout_accounts where id = p_account;
  if v_account.profile_id is distinct from v_me then
    raise exception 'that payout account does not belong to you';
  end if;

  v_minimum := coalesce(public.setting_int('payout_minimum_usd'), 20);
  if p_amount < v_minimum then
    raise exception 'the minimum payout is %', v_minimum;
  end if;

  select available_usd into v_available from public.wallet_balance where profile_id = v_me;

  if coalesce(v_available, 0) < p_amount then
    raise exception 'requested % but only % is available', p_amount, coalesce(v_available, 0);
  end if;

  -- Held, not spent: the row counts against the balance right away and only
  -- becomes final when an admin marks the transfer done.
  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar)
  values (v_me, 'payout', -p_amount, 'available', 'طلب سحب رصيد')
  returning id into v_entry;

  insert into public.payout_requests (profile_id, account_id, amount_usd, ledger_entry_id)
  values (v_me, p_account, p_amount, v_entry)
  returning * into v_request;

  update public.wallet_entries
     set description_ar = 'طلب سحب ' || v_request.request_code, ref_table = 'payout_requests', ref_id = v_request.id
   where id = v_entry;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin review. Rejecting cancels the held row, which returns the money.
-- ---------------------------------------------------------------------------
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
  else
    update public.payout_requests
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
           note_ar = p_note
     where id = p_request;

    -- cancelling the held row is what gives the money back
    update public.wallet_entries
       set status = 'cancelled', description_ar = 'طلب سحب مرفوض ' || v_request.request_code
     where id = v_request.ledger_entry_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Refunds. The booking spec leaves the policy to TechMood but does require the
-- path to exist — a mentor who declines a paid session must not leave the
-- student out of pocket with no route back.
-- ---------------------------------------------------------------------------
create or replace function public.refund_booking(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'only an admin may refund a booking';
  end if;

  select * into v_booking from public.bookings where id = p_booking;
  if not found then
    raise exception 'booking % not found', p_booking;
  end if;

  if not exists (
    select 1 from public.payments p where p.booking_id = p_booking and p.status = 'verified'
  ) then
    raise exception 'there is no verified payment on this booking to refund';
  end if;

  update public.bookings
     set status = 'refunded', cancelled_reason = coalesce(p_reason, cancelled_reason)
   where id = p_booking;

  update public.payments set status = 'refunded' where booking_id = p_booking and status = 'verified';

  -- Credited to the student's TechMood wallet, where it is traceable, rather
  -- than disappearing into an untracked manual transfer.
  if v_booking.student_id is not null then
    insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
    values (
      v_booking.student_id, 'refund', v_booking.price_usd, 'available',
      'استرداد قيمة الجلسة ' || v_booking.booking_code, 'bookings', v_booking.id
    );
  end if;

  -- A session that was refunded was not earned.
  update public.wallet_entries
     set status = 'cancelled'
   where ref_table = 'bookings' and ref_id = p_booking and kind = 'earning';
end;
$$;

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------
alter table public.payout_accounts enable row level security;
alter table public.payout_requests enable row level security;

create policy payout_accounts_own on public.payout_accounts
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

create policy payout_requests_own on public.payout_requests
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.request_payout(uuid, numeric)               to authenticated;
grant execute on function public.review_payout(uuid, boolean, text, text)    to authenticated;
grant execute on function public.refund_booking(uuid, text)                  to authenticated;

-- Payout requests join the queue admins already work from.
create or replace view public.admin_review_queue
with (security_invoker = true) as
      select 'role_application' as item_kind, pr.id as item_id,
             p.full_name as subject, pr.role::text as detail, pr.created_at
      from public.profile_roles pr
      join public.profiles p on p.id = pr.profile_id
      where pr.status = 'pending_review'
  union all
      select 'submission', s.id, p.full_name, a.title_ar, s.updated_at
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      join public.profiles p on p.id = s.profile_id
      where s.status in ('submitted', 'under_review')
  union all
      select 'payment', pay.id, coalesce(p.full_name, t.title_ar),
             pm.name_ar || ' · $' || pay.amount_usd::text, pay.submitted_at
      from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      join public.payment_methods pm on pm.key = pay.method_key
      left join public.profiles p on p.id = b.student_id
      left join public.teams t on t.id = b.team_id
      where pay.status = 'under_review'
  union all
      select 'incubator_application', ia.id, s.name_ar, s.stage::text, ia.created_at
      from public.incubator_applications ia
      join public.startups s on s.id = ia.startup_id
      where ia.status = 'pending_review'
  union all
      select 'reevaluation_request', rr.id, p.full_name, rr.reason_ar, rr.created_at
      from public.reevaluation_requests rr
      join public.profiles p on p.id = rr.requested_by
      where rr.status = 'open'
  union all
      select 'exhibition_entry', e.id, pr.title_ar, e.summary_ar, e.created_at
      from public.exhibition_entries e
      join public.projects pr on pr.id = e.project_id
      where e.status = 'submitted'
  union all
      select 'payout_request', po.id, p.full_name, '$' || po.amount_usd::text, po.created_at
      from public.payout_requests po
      join public.profiles p on p.id = po.profile_id
      where po.status in ('requested', 'approved');
