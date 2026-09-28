-- =============================================================================
-- 0097 — An invoice for every payment, and the account it was paid from
--
-- The founder's rules:
--
--   * Every payment that TechMood confirms produces an invoice: numbered, kept
--     in the payer's wallet history, printable (and savable as a PDF from the
--     print dialog). A refund marks it refunded; it is never deleted.
--   * Each payment records the account the payer paid from — their bank
--     account, wallet number or email — so a refund goes back to where the
--     money came from. The payer types it with the payment, or saves a default
--     in Settings → Payment accounts and it is used for them.
--
-- The account is personal financial data. It lives on the payment as a
-- snapshot (a later edit in Settings never rewrites history), readable only by
-- the payer and the admins, and shown masked everywhere except to them.
--
-- The platform's own details on an invoice (the issuer's name and a line of
-- details) are platform settings the admin edits — never written in code.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The accounts a person pays from
-- ---------------------------------------------------------------------------
create table public.payer_accounts (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  method_key  text references public.payment_methods (key) on delete set null,
  holder_name text not null check (char_length(btrim(holder_name)) between 2 and 120),
  account_ref text not null check (char_length(btrim(account_ref)) between 3 and 120),
  label       text check (label is null or char_length(label) <= 60),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index payer_accounts_profile_idx on public.payer_accounts (profile_id);
create unique index payer_accounts_one_default on public.payer_accounts (profile_id) where is_default;

alter table public.payer_accounts enable row level security;

create policy payer_accounts_read on public.payer_accounts
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy payer_accounts_own on public.payer_accounts
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.payer_accounts to authenticated;

comment on table public.payer_accounts is
  'Accounts a person pays TechMood from (bank account, wallet number, email), so refunds go back to them. Owner and admins only.';

-- ---------------------------------------------------------------------------
-- 2. On every payment, the account it came from
-- ---------------------------------------------------------------------------
alter table public.payments
  add column payer_account_id uuid references public.payer_accounts (id) on delete set null,
  add column payer_holder     text,
  add column payer_account    text;

comment on column public.payments.payer_account is
  'Snapshot of the account the payer paid from, as they gave it with this payment (0097). Payer and admins only.';

-- Who pays a payment: the learner who booked, the leader of a team that
-- booked, or the payer of an escrow.
create or replace function public.payment_payer(p_payment uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.student_id, t.leader_id, e.payer_id)
    from public.payments p
    left join public.bookings b on b.id = p.booking_id
    left join public.teams t on t.id = b.team_id
    left join public.escrows e on e.id = p.escrow_id
   where p.id = p_payment;
$$;

revoke execute on function public.payment_payer(uuid) from public, anon, authenticated;

-- The payer says which account they paid from — a saved one, or typed now
-- (and saved as their default if they ask). Only while the payment is still
-- theirs to change: before TechMood has confirmed it.
create or replace function public.set_payment_payer(
  p_payment     uuid,
  p_account     uuid default null,
  p_holder      text default null,
  p_account_ref text default null,
  p_method_key  text default null,
  p_save        boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_payment public.payments%rowtype;
  v_acc     public.payer_accounts%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment;
  if not found or public.payment_payer(p_payment) is distinct from v_me then
    raise exception 'هذه الدفعة ليست لك';
  end if;

  if v_payment.status not in ('pending', 'rejected', 'failed', 'under_review', 'needs_info') then
    raise exception 'لا يمكن تغيير حساب الدفع بعد تأكيد الدفعة';
  end if;

  if p_account is not null then
    select * into v_acc from public.payer_accounts where id = p_account and profile_id = v_me;
    if not found then
      raise exception 'الحساب غير موجود';
    end if;
  else
    if char_length(coalesce(btrim(p_holder), '')) < 2 or char_length(coalesce(btrim(p_account_ref), '')) < 3 then
      raise exception 'اكتب اسم صاحب الحساب ورقم الحساب أو المحفظة الذي دفعت منه';
    end if;

    v_acc.holder_name := btrim(p_holder);
    v_acc.account_ref := btrim(p_account_ref);

    if p_save then
      update public.payer_accounts set is_default = false where profile_id = v_me and is_default;
      insert into public.payer_accounts (profile_id, method_key, holder_name, account_ref, is_default)
      values (v_me, coalesce(p_method_key, v_payment.method_key), v_acc.holder_name, v_acc.account_ref, true)
      returning * into v_acc;
    end if;
  end if;

  update public.payments
     set payer_account_id = v_acc.id,
         payer_holder     = v_acc.holder_name,
         payer_account    = v_acc.account_ref
   where id = p_payment;
end;
$$;

revoke execute on function public.set_payment_payer(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.set_payment_payer(uuid, uuid, text, text, text, boolean) to authenticated;

-- Handing a payment in without saying where it came from uses the payer's
-- default account; with neither, it is refused. (An admin or a scheduled job
-- moving a payment is not a hand-in.)
create or replace function public.require_payer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_acc public.payer_accounts%rowtype;
begin
  if new.status <> 'under_review' or old.status = 'under_review'
     or v_me is null or public.is_admin()
     or new.payer_account is not null then
    return new;
  end if;

  select * into v_acc from public.payer_accounts
   where profile_id = v_me and is_default
   limit 1;

  if not found then
    raise exception 'اكتب الحساب الذي دفعت منه، أو احفظ حساباً افتراضياً في الإعدادات — لإرجاع المبلغ إليه عند الحاجة';
  end if;

  new.payer_account_id := v_acc.id;
  new.payer_holder     := v_acc.holder_name;
  new.payer_account    := v_acc.account_ref;
  return new;
end;
$$;

create trigger payments_require_payer_account
  before update of status on public.payments
  for each row execute function public.require_payer_account();

-- ---------------------------------------------------------------------------
-- 3. The invoice
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('invoice_issuer_name',    'TechMood', 'اسم الجهة المُصدِرة كما يظهر على الفواتير'),
  ('invoice_issuer_details', '',         'سطر تفاصيل الجهة المُصدِرة على الفواتير (عنوان، رقم تسجيل…) — يُكتب من الإدارة')
on conflict (key) do nothing;

create sequence public.invoice_seq;

create table public.invoices (
  id             uuid primary key default extensions.gen_random_uuid(),
  invoice_no     text not null unique,
  payment_id     uuid not null unique references public.payments (id) on delete restrict,
  profile_id     uuid references public.profiles (id) on delete set null,
  payer_name     text not null,
  payer_account  text,
  description_ar text not null,
  amount_usd     numeric(10,2) not null check (amount_usd >= 0),
  paid_currency  text not null default 'USD',
  paid_amount    numeric(12,2),
  method_label   text,
  reference      text,
  payment_code   text,
  status         text not null default 'issued' check (status in ('issued', 'refunded')),
  issued_at      timestamptz not null default now(),
  refunded_at    timestamptz
);

create index invoices_profile_idx on public.invoices (profile_id, issued_at desc);

alter table public.invoices enable row level security;

create policy invoices_read on public.invoices
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

grant select on public.invoices to authenticated;

comment on table public.invoices is
  'One invoice per confirmed payment (0097). Issued by the database when the payment is verified; marked refunded, never deleted.';

create or replace function public.issue_invoice_for_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payer   uuid;
  v_name    text;
  v_desc    text;
  v_method  text;
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    v_payer := public.payment_payer(new.id);
    select coalesce(p.full_name, 'عميل TechMood') into v_name from public.profiles p where p.id = v_payer;

    select case
             when b.id is not null then
               'جلسة إرشاد ' || b.booking_code
               || coalesce(' مع ' || mp.full_name, '')
               || ' — ' || to_char(b.scheduled_start at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
               || case when b.seats > 1 then ' — ' || b.seats || ' مقاعد' else '' end
             when e.id is not null then
               case e.kind when 'project_sale' then 'شراء مشروع جاهز ' else 'عمل عبر السوق ' end
               || e.escrow_code || coalesce(' — ' || pr.title_ar, '')
             else 'دفعة ' || coalesce(new.payment_code, '')
           end
      into v_desc
      from (select 1) x
      left join public.bookings b on b.id = new.booking_id
      left join public.profiles mp on mp.id = b.mentor_id
      left join public.escrows e on e.id = new.escrow_id
      left join public.projects pr on pr.id = e.project_id;

    select m.name_ar into v_method from public.payment_methods m where m.key = new.method_key;

    insert into public.invoices (
      invoice_no, payment_id, profile_id, payer_name, payer_account, description_ar,
      amount_usd, paid_currency, paid_amount, method_label, reference, payment_code
    )
    values (
      'TM-INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0'),
      new.id, v_payer, coalesce(new.payer_holder, v_name),
      public.mask_account(new.payer_account), v_desc,
      new.amount_usd, coalesce(new.paid_currency, 'USD'), new.paid_amount,
      v_method, new.reference, new.payment_code
    )
    on conflict (payment_id) do nothing;

    if v_payer is not null then
      perform public.notify(v_payer, 'payment', 'فاتورتك جاهزة',
        'تأكدت دفعتك وصدرت فاتورتها في محفظتك.', '/wallet');
    end if;
  elsif new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.invoices
       set status = 'refunded', refunded_at = now()
     where payment_id = new.id and status = 'issued';
  end if;

  return new;
end;
$$;

create trigger payments_issue_invoice
  after update of status on public.payments
  for each row execute function public.issue_invoice_for_payment();

-- Payments verified before invoices existed get theirs now.
do $backfill$
declare
  r record;
begin
  for r in select p.id from public.payments p
            where p.status in ('verified', 'refunded')
              and not exists (select 1 from public.invoices i where i.payment_id = p.id)
            order by coalesce(p.verified_at, p.created_at)
  loop
    insert into public.invoices (
      invoice_no, payment_id, profile_id, payer_name, payer_account, description_ar,
      amount_usd, paid_currency, paid_amount, method_label, reference, payment_code,
      status, issued_at, refunded_at
    )
    select 'TM-INV-' || to_char(coalesce(p.verified_at, p.created_at), 'YYYY') || '-'
             || lpad(nextval('public.invoice_seq')::text, 6, '0'),
           p.id, public.payment_payer(p.id),
           coalesce(p.payer_holder, pf.full_name, 'عميل TechMood'),
           public.mask_account(p.payer_account),
           coalesce('جلسة إرشاد ' || b.booking_code, 'دفعة ' || p.payment_code),
           p.amount_usd, coalesce(p.paid_currency, 'USD'), p.paid_amount,
           m.name_ar, p.reference, p.payment_code,
           case when p.status = 'refunded' then 'refunded' else 'issued' end,
           coalesce(p.verified_at, p.created_at),
           case when p.status = 'refunded' then p.updated_at end
      from public.payments p
      left join public.bookings b on b.id = p.booking_id
      left join public.profiles pf on pf.id = public.payment_payer(p.id)
      left join public.payment_methods m on m.key = p.method_key
     where p.id = r.id;
  end loop;
end
$backfill$;

-- The issuer lines, for the printed invoice.
create or replace function public.invoice_issuer()
returns table (name text, details text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.platform_settings where key = 'invoice_issuer_name'), 'TechMood'),
         coalesce((select value from public.platform_settings where key = 'invoice_issuer_details'), '');
$$;

revoke execute on function public.invoice_issuer() from public, anon;
grant execute on function public.invoice_issuer() to authenticated;
