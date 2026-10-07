-- ============================================================================
-- 0149 — offers in the market (design lab 4)
--
-- Two kinds, both decided by the seller and both charged by the database, so
-- the price on the page and the price paid are the same number:
--
--   * A timed discount: 0099 already stores `discount_ends_at` and stops the
--     discount when it passes; the page now lets the seller set it and shows
--     the time left. Nothing new is needed here for it.
--   * A returning buyer's discount (`repeat_buyer_pct`, 0–50%): somebody who
--     already bought from this seller and received it — the money released —
--     pays that much less, on top of any running discount. It is how a seller
--     rewards a second purchase, so it is a «bundle» that needs no basket.
--
-- `listing_price_for()` is the one place the two meet; `buy_project()` now
-- charges it, and `my_listing_price()` tells a buyer what they would pay and
-- why before they press buy.
-- ============================================================================

alter table public.project_listings
  add column if not exists repeat_buyer_pct smallint not null default 0
    check (repeat_buyer_pct between 0 and 50);

grant select (repeat_buyer_pct) on public.project_listings to anon, authenticated;

-- Has this person already bought something from this seller and received it?
create or replace function public.is_returning_buyer(p_seller uuid, p_buyer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_buyer is not null and exists (
    select 1 from public.project_sales s
      join public.escrows e on e.id = s.escrow_id
     where s.seller_id = p_seller and s.buyer_id = p_buyer and e.status = 'released');
$$;

revoke execute on function public.is_returning_buyer(uuid, uuid) from public, anon, authenticated;

-- What this buyer pays for this listing today.
create or replace function public.listing_price_for(p_listing uuid, p_buyer uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when l.repeat_buyer_pct > 0 and public.is_returning_buyer(l.seller_id, p_buyer)
             then round(public.listing_price(l.price_usd, l.discount_pct, l.discount_ends_at)
                        * (100 - l.repeat_buyer_pct) / 100.0, 2)
           else public.listing_price(l.price_usd, l.discount_pct, l.discount_ends_at)
         end
    from public.project_listings l
   where l.id = p_listing;
$$;

revoke execute on function public.listing_price_for(uuid, uuid) from public, anon, authenticated;

-- The signed-in buyer's own price, and whether the returning-buyer discount is in it.
create or replace function public.my_listing_price(p_listing uuid)
returns table (price numeric, list_price numeric, returning_buyer boolean, repeat_buyer_pct smallint, discount_ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select public.listing_price_for(l.id, (select auth.uid())),
         l.price_usd,
         l.repeat_buyer_pct > 0 and public.is_returning_buyer(l.seller_id, (select auth.uid())),
         l.repeat_buyer_pct,
         case when l.discount_pct > 0 and l.discount_ends_at > now() then l.discount_ends_at end
    from public.project_listings l
   where l.id = p_listing and l.status = 'listed';
$$;

revoke execute on function public.my_listing_price(uuid) from public, anon;
grant execute on function public.my_listing_price(uuid) to authenticated;

-- The seller sets the returning buyer's discount like the running one: it
-- changes what is charged, not what is sold, so it does not go back to review.
create or replace function public.set_repeat_buyer_discount(p_listing uuid, p_pct integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.project_listings l
                  where l.id = p_listing and l.seller_id = (select auth.uid())) then
    raise exception 'صاحب العرض فقط من يغيّر خصمه';
  end if;
  if coalesce(p_pct, 0) not between 0 and 50 then
    raise exception 'خصم المشتري العائد بين 0 و50%%';
  end if;
  update public.project_listings set repeat_buyer_pct = coalesce(p_pct, 0) where id = p_listing;
end;
$$;

revoke execute on function public.set_repeat_buyer_discount(uuid, integer) from public, anon;
grant execute on function public.set_repeat_buyer_discount(uuid, integer) to authenticated;

-- A timed discount must end in the future, and not more than 60 days out.
create or replace function public.check_discount_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.discount_ends_at is not null
     and (tg_op = 'INSERT' or new.discount_ends_at is distinct from old.discount_ends_at)
     and (new.discount_ends_at <= now() or new.discount_ends_at > now() + interval '60 days') then
    raise exception 'موعد انتهاء الخصم بين الآن و60 يوماً';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_discount_window() from public, anon, authenticated;

drop trigger if exists project_listings_discount_window on public.project_listings;
create trigger project_listings_discount_window before insert or update of discount_ends_at on public.project_listings
  for each row execute function public.check_discount_window();

-- Buying charges the buyer's own price (0121's body, one line changed).
create or replace function public.buy_project(
  p_listing      uuid,
  p_method_key   text,
  p_offer        uuid default null,
  p_accept_terms boolean default false
)
returns public.project_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_listing public.project_listings%rowtype;
  v_offer   public.listing_offers%rowtype;
  v_escrow  public.escrows%rowtype;
  v_sale    public.project_sales%rowtype;
  v_price   numeric;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'الموافقة على شروط البيع والشراء مطلوبة';
  end if;
  perform public.expire_listing_offers();

  select * into v_listing from public.project_listings where id = p_listing for update;
  if not found then
    raise exception 'العرض غير موجود';
  end if;
  if v_listing.status <> 'listed' then
    raise exception 'هذا العرض غير متاح للشراء';
  end if;
  if v_listing.seller_id = v_me then
    raise exception 'لا يمكنك شراء مشروعك';
  end if;

  -- Each buyer buys a listing once; an abandoned hold does not count.
  if exists (
    select 1 from public.project_sales s
      join public.escrows e on e.id = s.escrow_id
     where s.listing_id = p_listing and s.buyer_id = v_me
       and e.status not in ('cancelled', 'refunded')
  ) then
    raise exception 'اشتريت هذا العرض من قبل، أو لديك شراء جارٍ عليه';
  end if;

  -- the running discount, and the returning buyer's on top (0149)
  v_price := public.listing_price_for(p_listing, v_me);

  if p_offer is not null then
    select * into v_offer from public.listing_offers where id = p_offer for update;
    if not found or v_offer.buyer_id <> v_me or v_offer.listing_id <> p_listing
       or v_offer.status <> 'accepted' then
      raise exception 'لا اتفاق سعر صالح على هذا المشروع';
    end if;
    v_price := least(v_price, v_offer.agreed_usd);
    update public.listing_offers set status = 'used' where id = p_offer;
  end if;

  v_escrow := public.open_escrow('project_sale', v_listing.project_id, v_listing.seller_id,
                                 v_price, p_method_key);

  insert into public.project_sales
    (listing_id, project_id, buyer_id, seller_id, escrow_id, amount_usd, licence, offer_id, terms_version)
  values (p_listing, v_listing.project_id, v_me, v_listing.seller_id, v_escrow.id,
          v_price, v_listing.licence, p_offer, public.market_terms_version())
  returning * into v_sale;

  -- A full transfer is sold once; usage rights stay on the shelf.
  if v_listing.licence = 'full_transfer' then
    update public.project_listings set status = 'reserved' where id = p_listing;
  end if;

  perform public.notify(
    v_listing.seller_id, 'system', 'طلب شراء لمشروعك',
    'المشتري يدفع الآن — يُحتجز المبلغ، ويصله رابط التسليم حين تؤكد TechMood الدفع.',
    '/marketplace?tab=money');

  return v_sale;
end;
$$;
