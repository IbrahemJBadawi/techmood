-- =============================================================================
-- 0105 — Where members can receive money
--
-- The founder's payment setup for the MVP: learners pay one way, into
-- TechMood's Bank of Palestine account, and members receive their money into
-- one of three kinds of account: a bank account, a PalPay wallet or a Jawwal
-- Pay wallet.
--
-- Which rails are switched on is configuration, and stays with the admin
-- (Admin → Finance → Accounts): `is_enabled` is "learners may pay with it",
-- `supports_payout` is "members may receive with it". TechMood's own receiving
-- details are data in `payment_methods`, entered by the admin — never in a
-- migration or in the code.
--
-- What was missing were the rules behind those switches:
--   * a payout account could be saved on any rail, even one TechMood cannot
--     send money out on; it now has to be a payout rail, and it has to carry
--     what that rail needs (a wallet number for a wallet, an account number or
--     an IBAN for a bank);
--   * a payout could be requested to an account whose rail was later switched
--     off;
--   * a rail that is payout-only (a wallet learners do not pay with) was not
--     readable by members at all, so it could not be chosen.
-- =============================================================================

-- A wallet rail is one whose payment details are a wallet number.
create or replace function public.is_wallet_rail(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select 'wallet_number' = any (m.display_fields)
                     from public.payment_methods m where m.key = p_key), false);
$$;

revoke execute on function public.is_wallet_rail(text) from public, anon;
grant execute on function public.is_wallet_rail(text) to authenticated;

create or replace function public.check_payout_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.payment_methods m
                  where m.key = new.method_key and m.supports_payout) then
    raise exception 'هذه الطريقة غير متاحة لاستلام الأموال — اختر حساباً بنكياً أو محفظة PalPay أو Jawwal Pay'
      using errcode = 'check_violation';
  end if;

  new.holder_name    := btrim(new.holder_name);
  new.wallet_number  := nullif(btrim(new.wallet_number), '');
  new.account_number := nullif(btrim(new.account_number), '');
  new.iban           := nullif(upper(replace(btrim(new.iban), ' ', '')), '');

  if char_length(coalesce(new.holder_name, '')) < 3 then
    raise exception 'اكتب اسم صاحب الحساب كما هو مسجّل' using errcode = 'check_violation';
  end if;

  if public.is_wallet_rail(new.method_key) then
    if new.wallet_number is null or new.wallet_number !~ '^\+?[0-9 ]{7,20}$' then
      raise exception 'اكتب رقم المحفظة (أرقام فقط)' using errcode = 'check_violation';
    end if;
  elsif new.account_number is null and new.iban is null then
    raise exception 'اكتب رقم الحساب البنكي أو الـIBAN' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_payout_account() from public, anon, authenticated;

create trigger payout_accounts_rail
  before insert or update of method_key, holder_name, wallet_number, account_number, iban
  on public.payout_accounts
  for each row execute function public.check_payout_account();

-- A payout goes only to a rail TechMood still sends money on.
create or replace function public.check_payout_request_rail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.payout_accounts a
                   join public.payment_methods m on m.key = a.method_key
                  where a.id = new.account_id and m.supports_payout) then
    raise exception 'لم تعد طريقة الاستلام في هذا الحساب متاحة — أضف حساباً بنكياً أو محفظة PalPay أو Jawwal Pay'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_payout_request_rail() from public, anon, authenticated;

create trigger payout_requests_rail
  before insert on public.payout_requests
  for each row execute function public.check_payout_request_rail();

-- Members can list the rails they may receive on, not only the ones they pay with.
drop policy payment_methods_read_enabled on public.payment_methods;
create policy payment_methods_read_enabled on public.payment_methods
  for select to authenticated
  using (is_enabled or supports_payout or public.is_admin());
