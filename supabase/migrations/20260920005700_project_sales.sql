-- =============================================================================
-- 0057 — A finished project can be sold, and authorship is not what is sold
--
-- A learner or a team finishes something real, it is evaluated, it goes into
-- the exhibition — and then it sits there. Somebody would pay for it: a shop
-- that needs exactly that dashboard, a company that wants that prototype. So a
-- finished project can be listed, and bought.
--
-- One decision shapes the whole thing, and it is worth stating plainly because
-- every other marketplace gets it wrong:
--
--   **A sale transfers the work, never the authorship.**
--
-- The buyer gets the deliverables, the code, the rights the licence names, and
-- a permanent, readable record that they bought it. What they do not get is the
-- claim to have built it. The exhibition entry, the mentor's evaluation, the
-- skills the work proved and the credit on the maker's passport all stay with
-- whoever made it — because those are statements about a person, and a person's
-- record is not for sale on this platform.
--
-- The money moves the same way market work does: escrow, commission, release.
-- Nothing here invents a second way to pay.
-- =============================================================================

create type public.listing_status as enum ('listed', 'reserved', 'sold', 'withdrawn');

create type public.sale_licence as enum (
  -- the buyer may use it; the maker may still show and reuse it
  'usage_rights',
  -- the buyer takes it over: the maker will not sell or reuse it elsewhere
  'full_transfer'
);

create table public.project_listings (
  id           uuid primary key default extensions.gen_random_uuid(),
  listing_code text not null unique
                 default ('TML-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))),
  project_id   uuid not null references public.projects (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  team_id      uuid references public.teams (id) on delete set null,
  price_usd    numeric(10,2) not null check (price_usd > 0),
  licence      public.sale_licence not null default 'usage_rights',
  summary_ar   text not null,
  includes     text[] not null default '{}',
  status       public.listing_status not null default 'listed',
  created_at   timestamptz not null default now(),
  sold_at      timestamptz,

  unique (project_id)
);

create index project_listings_status_idx on public.project_listings (status, created_at desc);

create table public.project_sales (
  id          uuid primary key default extensions.gen_random_uuid(),
  listing_id  uuid not null references public.project_listings (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  buyer_id    uuid not null references public.profiles (id) on delete restrict,
  seller_id   uuid not null references public.profiles (id) on delete restrict,
  escrow_id   uuid references public.escrows (id) on delete set null,
  amount_usd  numeric(10,2) not null check (amount_usd > 0),
  licence     public.sale_licence not null,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

create index project_sales_buyer_idx on public.project_sales (buyer_id);
create index project_sales_project_idx on public.project_sales (project_id);

alter table public.project_listings enable row level security;
alter table public.project_sales    enable row level security;

-- A listing is an advertisement: it is meant to be seen.
create policy project_listings_read on public.project_listings
  for select to anon, authenticated
  using (status in ('listed', 'reserved', 'sold') or seller_id = (select auth.uid()) or public.is_admin());

-- A sale is between two people and the platform.
create policy project_sales_read on public.project_sales
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or public.is_admin());

grant select on public.project_listings to anon, authenticated;
grant select on public.project_sales to authenticated;

-- The buyer can read the work they bought, and its deliverables, for good.
create policy projects_buyer_read on public.projects
  for select to authenticated
  using (exists (
    select 1 from public.project_sales s
     where s.project_id = projects.id
       and s.buyer_id = (select auth.uid())
       and s.completed_at is not null
  ));

create policy project_evidence_buyer_read on public.project_evidence
  for select to authenticated
  using (exists (
    select 1 from public.project_sales s
     where s.project_id = project_evidence.project_id
       and s.buyer_id = (select auth.uid())
       and s.completed_at is not null
  ));

-- ---------------------------------------------------------------------------
-- Listing something
-- ---------------------------------------------------------------------------
-- Only finished, judged work goes on sale. A project that was never completed
-- and never survived a review is not a product, and a market full of those is
-- a market nobody trusts.
create or replace function public.list_project_for_sale(
  p_project  uuid,
  p_price    numeric,
  p_summary  text,
  p_licence  public.sale_licence default 'usage_rights',
  p_includes text[] default '{}'
)
returns public.project_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_listing public.project_listings%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if v_project.owner_id <> v_me
     and not (v_project.team_id is not null and public.is_team_leader(v_project.team_id)) then
    raise exception 'صاحب المشروع أو قائد الفريق فقط من يعرضه للبيع';
  end if;

  if v_project.status not in ('completed', 'sold') then
    raise exception 'يُعرض المشروع للبيع بعد اكتماله فقط';
  end if;

  -- Work somebody paid to have built is theirs; it is not the builder's to sell.
  if v_project.client_id is not null then
    raise exception 'هذا العمل نُفّذ لعميل، ولا يُعاد بيعه';
  end if;

  if not exists (
    select 1 from public.exhibition_entries e
     where e.project_id = p_project and e.status = 'exhibited'
  ) then
    raise exception 'يُعرض للبيع العمل الذي مرّ بالتقييم وعُرض في المعرض';
  end if;

  if coalesce(p_price, 0) <= 0 then
    raise exception 'السعر يجب أن يكون أكبر من صفر';
  end if;

  if length(coalesce(trim(p_summary), '')) < 20 then
    raise exception 'اكتب وصفاً واضحاً لما يشتريه المشتري';
  end if;

  insert into public.project_listings
    (project_id, seller_id, team_id, price_usd, licence, summary_ar, includes)
  values (p_project, v_me, v_project.team_id, p_price, p_licence, trim(p_summary), coalesce(p_includes, '{}'))
  on conflict (project_id) do update
    set price_usd = excluded.price_usd,
        licence = excluded.licence,
        summary_ar = excluded.summary_ar,
        includes = excluded.includes,
        status = 'listed',
        seller_id = excluded.seller_id
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.list_project_for_sale(uuid, numeric, text, public.sale_licence, text[]) to authenticated;

create or replace function public.withdraw_listing(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.project_listings%rowtype;
begin
  select * into v_listing from public.project_listings where id = p_listing;
  if not found then
    raise exception 'العرض غير موجود';
  end if;

  if v_listing.seller_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'صاحب العرض فقط من يسحبه';
  end if;

  if v_listing.status = 'sold' then
    raise exception 'لا يُسحب عرض بيع تمّ';
  end if;

  if v_listing.status = 'reserved' then
    raise exception 'هناك شراء جارٍ على هذا العرض';
  end if;

  update public.project_listings set status = 'withdrawn' where id = p_listing;
end;
$$;

grant execute on function public.withdraw_listing(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Buying it
-- ---------------------------------------------------------------------------
-- Buying opens an escrow like any other work: the money is held, the seller
-- hands over what the listing promised, and the buyer releases. Nothing changes
-- hands on a click.
create or replace function public.buy_project(p_listing uuid, p_method_key text)
returns public.project_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_listing public.project_listings%rowtype;
  v_escrow  public.escrows%rowtype;
  v_sale    public.project_sales%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

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

  v_escrow := public.open_escrow('project_sale', v_listing.project_id, v_listing.seller_id,
                                 v_listing.price_usd, p_method_key);

  insert into public.project_sales
    (listing_id, project_id, buyer_id, seller_id, escrow_id, amount_usd, licence)
  values (p_listing, v_listing.project_id, v_me, v_listing.seller_id, v_escrow.id,
          v_listing.price_usd, v_listing.licence)
  returning * into v_sale;

  update public.project_listings set status = 'reserved' where id = p_listing;

  perform public.notify(
    v_listing.seller_id, 'system', 'طلب شراء لمشروعك',
    'المشتري يدفع الآن — سيُحتجز المبلغ حتى تسليم ما وعد به العرض.',
    '/marketplace?tab=selling');

  return v_sale;
end;
$$;

grant execute on function public.buy_project(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- What a released escrow means for a sale
-- ---------------------------------------------------------------------------
-- The buyer releasing the money is the moment the sale is done. The project is
-- marked sold and the buyer gets permanent read access — and the maker keeps
-- the exhibition entry, the evaluation, the skills and the credit, because the
-- record of who built something is not part of the goods.
create or replace function public.complete_sale_on_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.project_sales%rowtype;
begin
  if new.status <> 'released' or old.status = 'released' then
    return new;
  end if;

  select * into v_sale from public.project_sales where escrow_id = new.id;
  if not found then
    return new;
  end if;

  update public.project_sales set completed_at = now() where id = v_sale.id;
  update public.project_listings set status = 'sold', sold_at = now() where id = v_sale.listing_id;
  update public.projects set status = 'sold' where id = v_sale.project_id;

  perform public.notify(
    v_sale.buyer_id, 'system', 'تمّ الشراء',
    'المشروع متاح لك الآن بكل تسليماته.',
    '/projects/' || v_sale.project_id::text);

  return new;
end;
$$;

create trigger escrows_complete_sale
  after update of status on public.escrows
  for each row execute function public.complete_sale_on_release();

-- ---------------------------------------------------------------------------
-- The shelf
-- ---------------------------------------------------------------------------
create or replace function public.market_listings(p_search text default null, p_limit integer default 24)
returns table (
  id uuid, listing_code text, project_id uuid, project_title text,
  seller_name text, team_title text, price_usd numeric,
  licence public.sale_licence, summary_ar text, includes text[],
  status public.listing_status, entry_code text, technologies text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.listing_code, l.project_id,
         (select p.title_ar from public.projects p where p.id = l.project_id),
         (select pr.full_name from public.profiles pr where pr.id = l.seller_id),
         (select t.title_ar from public.teams t where t.id = l.team_id),
         l.price_usd, l.licence, l.summary_ar, l.includes, l.status,
         (select e.entry_code from public.exhibition_entries e where e.project_id = l.project_id),
         coalesce((select e.technologies from public.exhibition_entries e where e.project_id = l.project_id), '{}')
    from public.project_listings l
   where l.status = 'listed'
     and (p_search is null or p_search = ''
          or l.summary_ar ilike '%' || p_search || '%'
          or exists (select 1 from public.projects p
                      where p.id = l.project_id and p.title_ar ilike '%' || p_search || '%'))
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

grant execute on function public.market_listings(text, integer) to anon, authenticated;

comment on function public.market_listings is
  'Finished, exhibited work that is for sale. The listing carries its exhibition code, so a buyer can check the work was judged before it was priced.';
