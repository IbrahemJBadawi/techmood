-- ============================================================================
-- 0153 — open auctions with an end time (design lab 4: «مزاد مفتوح بموعد»)
--
-- A seller can put a listed project up for auction: a starting price, the
-- smallest step a bid must rise by, and how long it runs (a day, three days,
-- a week). While it runs:
--   * any member but the seller bids; each bid beats the top one by the step;
--   * everyone sees the top bid, how many bids there were and the time left,
--     and the bidders appear as initials only;
--   * a bid in the last two minutes adds two minutes, so nobody wins by
--     bidding in the final second;
--   * the project cannot be bought outright.
-- When it ends (pg_cron, every minute), the top bidder wins: they get an
-- agreed price — the same kind an accepted offer gives (0121) — and 48 hours
-- to pay it through the usual purchase, by transfer or from their balance.
-- Nothing changes hands before that payment.
-- ============================================================================

create table public.listing_auctions (
  id          uuid primary key default extensions.gen_random_uuid(),
  listing_id  uuid not null references public.project_listings (id) on delete cascade,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  start_usd   numeric(10,2) not null check (start_usd >= 1),
  step_usd    numeric(10,2) not null check (step_usd >= 1),
  ends_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'won', 'no_bids', 'cancelled')),
  winner_id   uuid references public.profiles (id) on delete set null,
  winning_usd numeric(10,2),
  offer_id    uuid references public.listing_offers (id) on delete set null,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create unique index listing_auctions_one_open on public.listing_auctions (listing_id) where status = 'open';
create index listing_auctions_due_idx on public.listing_auctions (ends_at) where status = 'open';

alter table public.listing_auctions enable row level security;
-- an auction is public, like the listing it is on; its bidders are not
create policy listing_auctions_read on public.listing_auctions for select to anon, authenticated using (true);
revoke all on public.listing_auctions from anon, authenticated;
grant select (id, listing_id, start_usd, step_usd, ends_at, status, winning_usd, created_at, closed_at)
  on public.listing_auctions to anon, authenticated;

create table public.auction_bids (
  id         uuid primary key default extensions.gen_random_uuid(),
  auction_id uuid not null references public.listing_auctions (id) on delete cascade,
  bidder_id  uuid not null references public.profiles (id) on delete cascade,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  created_at timestamptz not null default now()
);

create index auction_bids_auction_idx on public.auction_bids (auction_id, amount_usd desc);

alter table public.auction_bids enable row level security;
create policy auction_bids_own on public.auction_bids
  for select to authenticated using (bidder_id = (select auth.uid()) or public.is_admin());
revoke all on public.auction_bids from anon, authenticated;
grant select on public.auction_bids to authenticated;

-- Starting one.
create or replace function public.start_auction(p_listing uuid, p_start numeric, p_step numeric, p_hours integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_l  public.project_listings%rowtype;
  v_id uuid;
begin
  select * into v_l from public.project_listings where id = p_listing for update;
  if not found or v_l.seller_id is distinct from v_me then
    raise exception 'صاحب العرض فقط من يبدأ المزاد';
  end if;
  if v_l.status <> 'listed' then
    raise exception 'المزاد لعرض منشور في السوق';
  end if;
  if coalesce(p_hours, 0) not in (24, 72, 168) then
    raise exception 'مدة المزاد يوم أو 3 أيام أو أسبوع';
  end if;
  if coalesce(p_start, 0) < 1 or coalesce(p_step, 0) < 1 then
    raise exception 'سعر البداية والزيادة دولار على الأقل';
  end if;
  if exists (select 1 from public.listing_auctions where listing_id = p_listing and status = 'open') then
    raise exception 'على هذا العرض مزاد مفتوح';
  end if;
  insert into public.listing_auctions (listing_id, seller_id, start_usd, step_usd, ends_at)
  values (p_listing, v_me, round(p_start, 2), round(p_step, 2), now() + make_interval(hours => p_hours))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.start_auction(uuid, numeric, numeric, integer) from public, anon;
grant execute on function public.start_auction(uuid, numeric, numeric, integer) to authenticated;

-- Cancelling one: only before the first bid.
create or replace function public.cancel_auction(p_auction uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.listing_auctions%rowtype;
begin
  select * into v_a from public.listing_auctions where id = p_auction for update;
  if not found or (v_a.seller_id is distinct from (select auth.uid()) and not public.is_admin()) then
    raise exception 'صاحب العرض فقط من يلغي المزاد';
  end if;
  if v_a.status <> 'open' then
    raise exception 'المزاد غير مفتوح';
  end if;
  if exists (select 1 from public.auction_bids where auction_id = p_auction) and not public.is_admin() then
    raise exception 'لا يُلغى مزاد بعد أول مزايدة';
  end if;
  update public.listing_auctions set status = 'cancelled', closed_at = now() where id = p_auction;
end;
$$;

revoke execute on function public.cancel_auction(uuid) from public, anon;
grant execute on function public.cancel_auction(uuid) to authenticated;

-- Bidding.
create or replace function public.place_bid(p_auction uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_a    public.listing_auctions%rowtype;
  v_top  public.auction_bids%rowtype;
  v_min  numeric;
  v_title text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_a from public.listing_auctions where id = p_auction for update;
  if not found or v_a.status <> 'open' or v_a.ends_at <= now() then
    raise exception 'المزاد انتهى أو غير موجود';
  end if;
  if v_a.seller_id = v_me then
    raise exception 'لا تزايد على مشروعك';
  end if;

  select * into v_top from public.auction_bids where auction_id = p_auction
   order by amount_usd desc, created_at asc limit 1;
  v_min := case when v_top.id is null then v_a.start_usd else v_top.amount_usd + v_a.step_usd end;
  if coalesce(p_amount, 0) < v_min then
    raise exception 'أقل مزايدة الآن %$', v_min;
  end if;
  if v_top.bidder_id = v_me then
    raise exception 'مزايدتك هي الأعلى بالفعل';
  end if;

  insert into public.auction_bids (auction_id, bidder_id, amount_usd) values (p_auction, v_me, round(p_amount, 2));

  -- the last two minutes stretch, so the last second wins nothing
  if v_a.ends_at - now() < interval '2 minutes' then
    update public.listing_auctions set ends_at = now() + interval '2 minutes' where id = p_auction;
  end if;

  select pr.title_ar into v_title from public.project_listings l join public.projects pr on pr.id = l.project_id
   where l.id = v_a.listing_id;
  if v_top.id is not null then
    perform public.notify(v_top.bidder_id, 'work', '⚡ زايد أحدهم أعلى منك على «' || coalesce(v_title, 'مشروع') || '»',
      'المزايدة الأعلى الآن ' || round(p_amount, 2) || '$.', '/marketplace', 'auction', p_auction);
  else
    perform public.notify(v_a.seller_id, 'work', '🔨 أول مزايدة على «' || coalesce(v_title, 'مشروعك') || '»',
      round(p_amount, 2) || '$.', '/marketplace', 'auction', p_auction);
  end if;
end;
$$;

revoke execute on function public.place_bid(uuid, numeric) from public, anon;
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- What a page shows: the auction on a listing, its top bid, and whether I lead.
create or replace function public.auction_state(p_listing uuid)
returns table (
  id uuid, start_usd numeric, step_usd numeric, ends_at timestamptz, status text,
  top_usd numeric, bids integer, next_min_usd numeric, i_lead boolean, i_won boolean,
  is_seller boolean, winning_usd numeric, my_offer_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select * from public.listing_auctions where listing_id = p_listing
     order by (status = 'open') desc, created_at desc limit 1
  ),
  top as (
    select b.bidder_id, b.amount_usd from public.auction_bids b, a
     where b.auction_id = a.id order by b.amount_usd desc, b.created_at asc limit 1
  )
  select a.id, a.start_usd, a.step_usd, a.ends_at, a.status,
         (select amount_usd from top),
         (select count(*)::int from public.auction_bids b where b.auction_id = a.id),
         coalesce((select amount_usd from top) + a.step_usd, a.start_usd),
         coalesce((select bidder_id from top) = (select auth.uid()), false),
         a.status = 'won' and a.winner_id = (select auth.uid()),
         a.seller_id = (select auth.uid()),
         a.winning_usd,
         -- the winner's agreed price, to pay it; nobody else's business
         case when a.status = 'won' and a.winner_id = (select auth.uid()) then a.offer_id end
    from a;
$$;

revoke execute on function public.auction_state(uuid) from public;
grant execute on function public.auction_state(uuid) to anon, authenticated;

-- The last bids, bidders as initials only.
create or replace function public.auction_bids_public(p_auction uuid)
returns table (amount_usd numeric, bidder text, created_at timestamptz, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.amount_usd,
         upper(left(coalesce(nullif(btrim(p.full_name), ''), '?'), 1)) || '***',
         b.created_at,
         b.bidder_id = (select auth.uid())
    from public.auction_bids b
    join public.profiles p on p.id = b.bidder_id
   where b.auction_id = p_auction
   order by b.amount_usd desc
   limit 10;
$$;

revoke execute on function public.auction_bids_public(uuid) from public;
grant execute on function public.auction_bids_public(uuid) to anon, authenticated;

-- Closing the ones that are due: the top bidder gets an agreed price for 48 hours.
create or replace function public.close_due_auctions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a     public.listing_auctions%rowtype;
  v_top   public.auction_bids%rowtype;
  v_offer uuid;
  v_title text;
  v_done  integer := 0;
begin
  for v_a in
    select * from public.listing_auctions where status = 'open' and ends_at <= now()
     for update skip locked
  loop
    select pr.title_ar into v_title from public.project_listings l join public.projects pr on pr.id = l.project_id
     where l.id = v_a.listing_id;
    select * into v_top from public.auction_bids where auction_id = v_a.id
     order by amount_usd desc, created_at asc limit 1;

    if v_top.id is null then
      update public.listing_auctions set status = 'no_bids', closed_at = now() where id = v_a.id;
      perform public.notify(v_a.seller_id, 'work', 'انتهى مزاد «' || coalesce(v_title, 'مشروعك') || '» بلا مزايدات',
        'العرض باقٍ في السوق بسعره، ويمكنك بدء مزاد جديد.', '/marketplace', 'auction', v_a.id);
    else
      -- any open offer of the winner on this listing makes way for the auction's
      update public.listing_offers set status = 'expired', decided_at = now()
       where listing_id = v_a.listing_id and buyer_id = v_top.bidder_id
         and status in ('pending', 'countered', 'accepted');
      insert into public.listing_offers
        (listing_id, buyer_id, seller_id, amount_usd, agreed_usd, message_ar, status, expires_at, terms_version, decided_at)
      values (v_a.listing_id, v_top.bidder_id, v_a.seller_id, v_top.amount_usd, v_top.amount_usd,
              'فاز بالمزاد', 'accepted', now() + interval '48 hours', public.market_terms_version(), now())
      returning id into v_offer;
      update public.listing_auctions
         set status = 'won', winner_id = v_top.bidder_id, winning_usd = v_top.amount_usd,
             offer_id = v_offer, closed_at = now()
       where id = v_a.id;
      perform public.notify(v_top.bidder_id, 'work', '🏆 فزت بمزاد «' || coalesce(v_title, 'مشروع') || '» بـ ' || v_top.amount_usd || '$',
        'ادفع خلال 48 ساعة من صفحة المشروع — بتحويل أو من رصيدك.', '/marketplace', 'auction', v_a.id, 'important');
      perform public.notify(v_a.seller_id, 'work', '🔨 بيع «' || coalesce(v_title, 'مشروعك') || '» بالمزاد بـ ' || v_top.amount_usd || '$',
        'يدفع الفائز خلال 48 ساعة، ويصلك إشعار حين يتأكد الدفع.', '/marketplace', 'auction', v_a.id);
    end if;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

revoke execute on function public.close_due_auctions() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-close-auctions', '* * * * *', $$select public.close_due_auctions()$$);
  end if;
end
$migration$;

-- Buying: an auction's agreed price is the price (it may be above the list
-- price), and while an auction runs nobody buys around it.
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
  v_auction boolean := false;
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
  if p_offer is not null then
    v_auction := exists (select 1 from public.listing_auctions a where a.offer_id = p_offer and a.status = 'won');
  end if;
  if not v_auction and exists (select 1 from public.listing_auctions a where a.listing_id = p_listing and a.status = 'open') then
    raise exception 'هذا المشروع في مزاد مفتوح — زايد عليه';
  end if;

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
    -- an auction's price is what won it; a negotiated one never exceeds the price
    v_price := case when v_auction then v_offer.agreed_usd else least(v_price, v_offer.agreed_usd) end;
    update public.listing_offers set status = 'used' where id = p_offer;
  end if;

  v_escrow := public.open_escrow('project_sale', v_listing.project_id, v_listing.seller_id,
                                 v_price, p_method_key);

  insert into public.project_sales
    (listing_id, project_id, buyer_id, seller_id, escrow_id, amount_usd, licence, offer_id, terms_version)
  values (p_listing, v_listing.project_id, v_me, v_listing.seller_id, v_escrow.id,
          v_price, v_listing.licence, p_offer, public.market_terms_version())
  returning * into v_sale;

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
