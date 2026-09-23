-- =============================================================================
-- 0076 — Each method shows what it takes to pay with it, and nothing else
--
-- A payer transfers the money themselves, so the page has one job: give them
-- exactly the fields their chosen method needs, each one copyable. Until now
-- it showed every filled field of the method — which works while an admin
-- fills only the right ones, and quietly leaks the IBAN onto a wallet payment
-- the day somebody fills one field too many.
--
-- So each method now says which of its fields a payer sees (`display_fields`),
-- and which of those only matter from abroad (`international_fields`, shown
-- under their own heading). `payment_instructions()` returns only those — the
-- rest never leave the database, not even for the person paying.
--
-- The account details themselves are still not here. They are typed in by an
-- admin on Admin → Finance → Receiving accounts, never into code or a
-- migration: this repository is not where TechMood's bank account lives.
-- =============================================================================

alter table public.payment_methods
  -- PayPal and the like pay to an address, not a number
  add column account_email text check (account_email is null or account_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column display_fields text[] not null default '{}',
  add column international_fields text[] not null default '{}';

alter table public.payment_methods
  add constraint payment_methods_display_fields_known check (
    display_fields <@ array['recipient_name', 'bank_name', 'account_number', 'iban', 'swift',
                            'bank_address', 'wallet_number', 'account_email', 'city', 'country']
  ),
  add constraint payment_methods_international_within_display check (
    international_fields <@ display_fields
  );

-- The email is as private as the account number: column-locked like the rest.
-- (Column grants are additive, so nothing to revoke — it was never granted.)
grant select (display_fields, international_fields) on public.payment_methods to authenticated;

-- What each method needs, as the spec laid out.
update public.payment_methods
   set display_fields = array['recipient_name', 'bank_name', 'account_number', 'iban', 'swift', 'bank_address'],
       international_fields = array['swift', 'bank_address']
 where key = 'bank_of_palestine';

update public.payment_methods
   set display_fields = array['wallet_number', 'recipient_name']
 where key in ('jawwal_pay', 'palpay');

update public.payment_methods
   set display_fields = array['recipient_name', 'city', 'country']
 where key in ('western_union', 'moneygram');

update public.payment_methods
   set display_fields = array['recipient_name', 'bank_name', 'account_number', 'iban', 'swift', 'bank_address'],
       international_fields = array['swift', 'bank_address']
 where key = 'international_transfer';

update public.payment_methods
   set display_fields = array['recipient_name', 'account_email']
 where key = 'furlanso';

-- PayPal, off until an admin gives it an address. The address is not seeded.
insert into public.payment_methods
  (key, name_ar, name_en, icon, category, is_enabled, sort_order,
   requires_receipt, requires_reference, reference_label_ar, instructions_ar,
   display_fields, use_for)
values
  ('paypal', 'PayPal', 'PayPal', '🅿️', 'international', false, 4,
   false, true, 'رقم العملية في PayPal (Transaction ID)',
   'أرسل المبلغ إلى بريد PayPal الظاهر كدفعة لسلع وخدمات، ثم أدخل رقم العملية من إيصال PayPal.',
   array['account_email'], array['mentoring', 'projects', 'sales'])
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The payer's view: only the fields their method shows
-- ---------------------------------------------------------------------------
drop function public.payment_instructions(uuid);

create function public.payment_instructions(p_payment uuid)
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
  account_email   text,
  display_fields  text[],
  international_fields text[],
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

-- ---------------------------------------------------------------------------
-- Choosing the method on the payment page itself
--
-- The method used to be fixed at booking time, and a rejected payer was told
-- to "choose a different method" with no way to. A payment that is still open
-- can now switch to any method that is on, collects for this kind of payment,
-- and has every field it shows filled in.
-- ---------------------------------------------------------------------------
create or replace function public.payment_purpose(p_payment uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.booking_id is not null then 'mentoring'
    when e.kind = 'project_sale' then 'sales'
    else 'projects'
  end
    from public.payments p
    left join public.escrows e on e.id = p.escrow_id
   where p.id = p_payment;
$$;

-- Every field this method shows a payer is filled in. Whether it is switched
-- on is a separate question, asked by the callers that care.
create or replace function public.method_is_complete(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payment_methods m
     where m.key = p_key
       and cardinality(m.display_fields) > 0
       and not exists (
         select 1 from unnest(m.display_fields) f
          where case f
                  when 'recipient_name' then m.recipient_name
                  when 'bank_name'      then m.bank_name
                  when 'account_number' then m.account_number
                  when 'iban'           then m.iban
                  when 'swift'          then m.swift
                  when 'bank_address'   then m.bank_address
                  when 'wallet_number'  then m.wallet_number
                  when 'account_email'  then m.account_email
                  when 'city'           then m.city
                  when 'country'        then m.country
                end is null
       )
  );
$$;

-- On, and not showing a payer a blank where a number should be.
create or replace function public.method_is_ready(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.method_is_complete(p_key)
     and exists (select 1 from public.payment_methods m where m.key = p_key and m.is_enabled);
$$;

create or replace function public.payment_options(p_payment uuid)
returns table (key text, name_ar text, name_en text, icon text, category text, is_current boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.key, m.name_ar, m.name_en, m.icon, m.category, m.key = p.method_key
    from public.payments p
    left join public.bookings b on b.id = p.booking_id
    left join public.escrows e on e.id = p.escrow_id
    join public.payment_methods m
      on public.payment_purpose(p.id) = any (m.use_for)
     and public.method_is_ready(m.key)
   where p.id = p_payment
     and (b.student_id = (select auth.uid()) or e.payer_id = (select auth.uid()))
   order by m.sort_order;
$$;

grant execute on function public.payment_options(uuid) to authenticated;

create or replace function public.choose_payment_method(p_payment uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments%rowtype;
begin
  select * into v_row from public.payments where id = p_payment;

  if not exists (
    select 1 from public.bookings b where b.id = v_row.booking_id and b.student_id = (select auth.uid())
    union all
    select 1 from public.escrows e where e.id = v_row.escrow_id and e.payer_id = (select auth.uid())
  ) then
    raise exception 'الدافع فقط من يختار طريقة الدفع';
  end if;

  -- once a receipt is with an admin, the method it was sent by is a fact
  if v_row.status not in ('pending', 'rejected') then
    raise exception 'لا يمكن تغيير الطريقة بعد إرسال الدفعة للمراجعة';
  end if;

  if not exists (
    select 1 from public.payment_methods m
     where m.key = p_method
       and public.payment_purpose(p_payment) = any (m.use_for)
       and public.method_is_ready(m.key)
  ) then
    raise exception 'طريقة الدفع هذه غير متاحة لهذه الدفعة';
  end if;

  update public.payments set method_key = p_method where id = p_payment;
end;
$$;

grant execute on function public.choose_payment_method(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The admin side learns the new fields
-- ---------------------------------------------------------------------------
drop function public.save_payment_account(
  text, boolean, text, text, text, text, text, text, text, text[], boolean
);

create function public.save_payment_account(
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
  p_supports_payout boolean default null,
  p_account_email  text default null,
  p_bank_address   text default null,
  p_display_fields text[] default null,
  p_international_fields text[] default null
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
     set recipient_name  = nullif(btrim(coalesce(p_recipient_name, '')), ''),
         account_number  = nullif(btrim(coalesce(p_account_number, '')), ''),
         wallet_number   = nullif(btrim(coalesce(p_wallet_number, '')), ''),
         iban            = nullif(replace(btrim(coalesce(p_iban, '')), ' ', ''), ''),
         swift           = nullif(upper(btrim(coalesce(p_swift, ''))), ''),
         bank_name       = nullif(btrim(coalesce(p_bank_name, '')), ''),
         bank_address    = nullif(btrim(coalesce(p_bank_address, '')), ''),
         account_email   = nullif(lower(btrim(coalesce(p_account_email, ''))), ''),
         instructions_ar = coalesce(nullif(btrim(coalesce(p_instructions, '')), ''), instructions_ar),
         use_for         = coalesce(p_use_for, use_for),
         supports_payout = coalesce(p_supports_payout, supports_payout),
         display_fields  = coalesce(p_display_fields, display_fields),
         international_fields = coalesce(
           (select array_agg(f) from unnest(p_international_fields) f
             where f = any (coalesce(p_display_fields, display_fields))),
           case when p_international_fields is null then international_fields else '{}' end)
   where key = p_key;

  if not found then
    raise exception 'طريقة الدفع غير موجودة';
  end if;

  -- Switched on only when every field it shows a payer is filled, so a
  -- half-typed account is never live. The whole save is refused, not half of
  -- it: the admin fixes the missing field and saves again.
  if p_enabled and not public.method_is_complete(p_key)
     and not exists (select 1 from public.payment_methods m
                      where m.key = p_key and m.supports_automatic_payment) then
    raise exception 'لا يمكن تفعيل طريقة ينقصها حقل من الحقول التي تظهر للدافع';
  end if;

  update public.payment_methods set is_enabled = p_enabled where key = p_key;
end;
$$;

grant execute on function public.save_payment_account(
  text, boolean, text, text, text, text, text, text, text, text[], boolean, text, text, text[], text[]
) to authenticated;
