-- =============================================================================
-- 0099 — A market TechMood vouches for: reviewed before it shows, delivered
--        only once paid, sold as often as the licence allows
--
-- The founder's market rules, on top of 0057:
--
--   * **Reviewed first.** A new or edited listing waits "under review"; an
--     admin checks it — including the delivery link — and either verifies it
--     (it shows, with a "verified" mark) or refuses it with a reason. A refused
--     listing is gone from the market, and the seller receives a formal
--     warning on their record (0084), which is what counts against them.
--     Because every listing is now checked by a person, the 0057 rule that
--     only exhibited work may be listed is lifted: anyone can sell finished
--     work they own.
--   * **The link is hidden.** The seller gives the delivery link (repository,
--     files, download) when listing it. Nobody reads it — not the market, not
--     the project page — except the seller, the admins, and a buyer whose
--     payment TechMood has confirmed. A demo or preview link is public.
--   * **Sold again.** A "usage rights" listing stays on the shelf after a sale
--     and can be bought by many people, each once; a "full transfer" is still
--     sold once, as 0057 did.
--   * **Offers.** A seller may put a listing on discount (up to 90%), for a
--     while or until they end it. The price charged is the price shown.
--   * **Numbers.** The market shows how many times a listing has sold, and the
--     seller's mentor rating when they are a mentor.
--
-- Commission stays compute_commission('project_sale', …) — 15% since 0090.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. What a listing carries now
-- ---------------------------------------------------------------------------
alter table public.project_listings
  add column delivery_url     text,
  add column demo_url         text,
  add column discount_pct     smallint not null default 0 check (discount_pct between 0 and 90),
  add column discount_ends_at timestamptz,
  add column verified_at      timestamptz,
  add column verified_by      uuid references public.profiles (id) on delete set null,
  add column review_note_ar   text,
  add column reviewed_at      timestamptz,
  add constraint project_listings_delivery_is_link check (delivery_url is null or delivery_url ~* '^https?://'),
  add constraint project_listings_demo_is_link check (demo_url is null or demo_url ~* '^https?://');

alter table public.project_listings alter column status set default 'pending_review';

-- The delivery link is the goods: no column-level read for anyone. It is read
-- only through listing_delivery_url(), admin_pending_listings() and my_purchases().
revoke select on public.project_listings from anon, authenticated;
grant select (
  id, listing_code, project_id, seller_id, team_id, price_usd, licence, summary_ar, includes,
  status, created_at, sold_at, demo_url, discount_pct, discount_ends_at, verified_at,
  review_note_ar, reviewed_at
) on public.project_listings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The price charged is the price shown
-- ---------------------------------------------------------------------------
create or replace function public.listing_price(p_price numeric, p_discount smallint, p_ends timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when coalesce(p_discount, 0) > 0 and (p_ends is null or p_ends > now())
              then round(p_price * (100 - p_discount) / 100.0, 2)
              else p_price end;
$$;

grant execute on function public.listing_price(numeric, smallint, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Listing it — for review
-- ---------------------------------------------------------------------------
drop function if exists public.list_project_for_sale(uuid, numeric, text, public.sale_licence, text[]);

create or replace function public.list_project_for_sale(
  p_project          uuid,
  p_price            numeric,
  p_summary          text,
  p_delivery_url     text,
  p_licence          public.sale_licence default 'usage_rights',
  p_includes         text[] default '{}',
  p_demo_url         text default null,
  p_discount_pct     integer default 0,
  p_discount_ends_at timestamptz default null
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

  if v_project.client_id is not null then
    raise exception 'هذا العمل نُفّذ لعميل، ولا يُعاد بيعه';
  end if;

  if exists (select 1 from public.project_listings l
              where l.project_id = p_project and l.status in ('reserved', 'sold')) then
    raise exception 'هناك بيع جارٍ أو تمّ بنقل كامل على هذا المشروع';
  end if;

  if coalesce(p_price, 0) <= 0 then
    raise exception 'السعر يجب أن يكون أكبر من صفر';
  end if;

  if length(coalesce(trim(p_summary), '')) < 20 then
    raise exception 'اكتب وصفاً واضحاً لما يشتريه المشتري';
  end if;

  if coalesce(btrim(p_delivery_url), '') !~* '^https?://' then
    raise exception 'رابط التسليم مطلوب (يبقى مخفياً حتى يتأكد الدفع)';
  end if;

  if nullif(btrim(p_demo_url), '') !~* '^https?://' then
    raise exception 'رابط العرض التجريبي يجب أن يبدأ بـ https://';
  end if;

  if coalesce(p_discount_pct, 0) not between 0 and 90 then
    raise exception 'الخصم بين 0 و90%%';
  end if;

  insert into public.project_listings
    (project_id, seller_id, team_id, price_usd, licence, summary_ar, includes,
     delivery_url, demo_url, discount_pct, discount_ends_at, status)
  values (p_project, v_me, v_project.team_id, p_price, p_licence, trim(p_summary), coalesce(p_includes, '{}'),
          btrim(p_delivery_url), nullif(btrim(p_demo_url), ''), coalesce(p_discount_pct, 0),
          p_discount_ends_at, 'pending_review')
  on conflict (project_id) do update
    set price_usd        = excluded.price_usd,
        licence          = excluded.licence,
        summary_ar       = excluded.summary_ar,
        includes         = excluded.includes,
        delivery_url     = excluded.delivery_url,
        demo_url         = excluded.demo_url,
        discount_pct     = excluded.discount_pct,
        discount_ends_at = excluded.discount_ends_at,
        seller_id        = excluded.seller_id,
        -- an edit is checked again before it shows
        status           = 'pending_review',
        verified_at      = null,
        verified_by      = null,
        review_note_ar   = null,
        reviewed_at      = null
  returning * into v_listing;

  perform public.notify_admins('عرض في السوق بانتظار المراجعة',
    trim(p_summary), '/admin/market', 'listing', v_listing.id, 'normal');

  return v_listing;
end;
$$;

revoke execute on function public.list_project_for_sale(uuid, numeric, text, text, public.sale_licence, text[], text, integer, timestamptz) from public, anon;
grant execute on function public.list_project_for_sale(uuid, numeric, text, text, public.sale_licence, text[], text, integer, timestamptz) to authenticated;

-- A discount on a live listing is not a new listing: it changes the price
-- charged, not what is sold, so it does not go back to review.
create or replace function public.set_listing_discount(p_listing uuid, p_pct integer, p_ends_at timestamptz default null)
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
  if coalesce(p_pct, 0) not between 0 and 90 then
    raise exception 'الخصم بين 0 و90%%';
  end if;
  update public.project_listings
     set discount_pct = coalesce(p_pct, 0), discount_ends_at = p_ends_at
   where id = p_listing;
end;
$$;

revoke execute on function public.set_listing_discount(uuid, integer, timestamptz) from public, anon;
grant execute on function public.set_listing_discount(uuid, integer, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The admin's review
-- ---------------------------------------------------------------------------
create or replace function public.review_listing(p_listing uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_listing public.project_listings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'مراجعة السوق للإدارة فقط';
  end if;

  select * into v_listing from public.project_listings where id = p_listing for update;
  if not found then
    raise exception 'العرض غير موجود';
  end if;
  if v_listing.status <> 'pending_review' then
    raise exception 'هذا العرض لا ينتظر مراجعة';
  end if;

  if p_approve then
    update public.project_listings
       set status = 'listed', verified_at = now(), verified_by = v_me,
           review_note_ar = nullif(btrim(p_note), ''), reviewed_at = now()
     where id = p_listing;

    perform public.notify(v_listing.seller_id, 'system', 'تمّ التحقق من عرضك',
      'عرضك في السوق ظاهر الآن بعلامة «تم التحقق».', '/marketplace?tab=selling');
  else
    if char_length(coalesce(btrim(p_note), '')) < 10 then
      raise exception 'سبب الرفض مطلوب — يصل للبائع ويُسجَّل في ملفه';
    end if;

    update public.project_listings
       set status = 'rejected', review_note_ar = btrim(p_note), reviewed_at = now(),
           verified_at = null, verified_by = null
     where id = p_listing;

    insert into public.user_warnings (profile_id, reason_ar, issued_by)
    values (v_listing.seller_id, 'عرض في السوق رُفض: ' || btrim(p_note), v_me);

    perform public.notify(v_listing.seller_id, 'system', 'رُفض عرضك في السوق',
      btrim(p_note), '/marketplace?tab=selling');
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values (v_me, case when p_approve then 'listing_verified' else 'listing_rejected' end,
          'project_listings', p_listing, jsonb_build_object('status', v_listing.status),
          jsonb_build_object('approved', p_approve, 'note', btrim(p_note)));
end;
$$;

revoke execute on function public.review_listing(uuid, boolean, text) from public, anon;
grant execute on function public.review_listing(uuid, boolean, text) to authenticated;

-- The hidden link, for whoever may see it: its seller and the admins.
create or replace function public.listing_delivery_url(p_listing uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.delivery_url from public.project_listings l
   where l.id = p_listing
     and (l.seller_id = (select auth.uid()) or public.is_admin());
$$;

revoke execute on function public.listing_delivery_url(uuid) from public, anon;
grant execute on function public.listing_delivery_url(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Buying it — as often as the licence allows
-- ---------------------------------------------------------------------------
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
  v_price   numeric;
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

  -- Each buyer buys a listing once; an abandoned hold does not count.
  if exists (
    select 1 from public.project_sales s
      join public.escrows e on e.id = s.escrow_id
     where s.listing_id = p_listing and s.buyer_id = v_me
       and e.status not in ('cancelled', 'refunded')
  ) then
    raise exception 'اشتريت هذا العرض من قبل، أو لديك شراء جارٍ عليه';
  end if;

  v_price := public.listing_price(v_listing.price_usd, v_listing.discount_pct, v_listing.discount_ends_at);

  v_escrow := public.open_escrow('project_sale', v_listing.project_id, v_listing.seller_id,
                                 v_price, p_method_key);

  insert into public.project_sales
    (listing_id, project_id, buyer_id, seller_id, escrow_id, amount_usd, licence)
  values (p_listing, v_listing.project_id, v_me, v_listing.seller_id, v_escrow.id,
          v_price, v_listing.licence)
  returning * into v_sale;

  -- A full transfer is sold once; usage rights stay on the shelf.
  if v_listing.licence = 'full_transfer' then
    update public.project_listings set status = 'reserved' where id = p_listing;
  end if;

  perform public.notify(
    v_listing.seller_id, 'system', 'طلب شراء لمشروعك',
    'المشتري يدفع الآن — يُحتجز المبلغ، ويصله رابط التسليم حين تؤكد TechMood الدفع.',
    '/marketplace?tab=selling');

  return v_sale;
end;
$$;

-- An abandoned full-transfer hold puts the listing back on the shelf.
create or replace function public.release_listing_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('cancelled', 'refunded') and old.status is distinct from new.status then
    update public.project_listings l
       set status = 'listed'
      from public.project_sales s
     where s.escrow_id = new.id and l.id = s.listing_id
       and l.status = 'reserved' and s.completed_at is null;
  end if;
  return new;
end;
$$;

create trigger escrows_release_listing
  after update of status on public.escrows
  for each row execute function public.release_listing_on_cancel();

-- Paid is delivered: the moment TechMood confirms the money, the buyer is told
-- their link is ready.
create or replace function public.notify_delivery_on_funding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.project_sales%rowtype;
begin
  if new.status = 'funded' and old.status is distinct from 'funded' and new.kind = 'project_sale' then
    select * into v_sale from public.project_sales where escrow_id = new.id;
    if found then
      perform public.notify(v_sale.buyer_id, 'system', 'رابط التسليم جاهز',
        'تأكد دفعك — افتح مشترياتك لتستلم المشروع، ثم أفرج عن المبلغ أو افتح نزاعاً.',
        '/marketplace?tab=buying');
    end if;
  end if;
  return new;
end;
$$;

create trigger escrows_notify_delivery
  after update of status on public.escrows
  for each row execute function public.notify_delivery_on_funding();

-- What a buyer bought, with the link once it is theirs.
create or replace function public.my_purchases()
returns table (
  sale_id       uuid,
  listing_code  text,
  project_title text,
  seller_name   text,
  amount_usd    numeric,
  licence       public.sale_licence,
  escrow_id     uuid,
  escrow_status public.escrow_status,
  delivery_url  text,
  bought_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, l.listing_code, p.title_ar, pr.full_name, s.amount_usd, s.licence,
         e.id, e.status,
         case when e.status in ('funded', 'released', 'disputed') then l.delivery_url end,
         s.created_at
    from public.project_sales s
    join public.project_listings l on l.id = s.listing_id
    join public.projects p on p.id = s.project_id
    join public.profiles pr on pr.id = s.seller_id
    left join public.escrows e on e.id = s.escrow_id
   where s.buyer_id = (select auth.uid())
   order by s.created_at desc;
$$;

revoke execute on function public.my_purchases() from public, anon;
grant execute on function public.my_purchases() to authenticated;

-- A released usage-rights sale is complete; only a full transfer marks the
-- listing and the project sold.
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

  if v_sale.licence = 'full_transfer' then
    update public.project_listings set status = 'sold', sold_at = now() where id = v_sale.listing_id;
    update public.projects set status = 'sold' where id = v_sale.project_id;
  end if;

  perform public.notify(
    v_sale.buyer_id, 'system', 'تمّ الشراء',
    'اكتمل الشراء، ويبقى رابط التسليم في مشترياتك.',
    '/marketplace?tab=buying');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The shelf, with its numbers
-- ---------------------------------------------------------------------------
drop function if exists public.market_listings(text, integer);

create or replace function public.market_listings(p_search text default null, p_limit integer default 24)
returns table (
  id uuid, listing_code text, project_id uuid, project_title text,
  seller_id uuid, seller_name text, team_title text,
  price_usd numeric, effective_price numeric, discount_pct smallint, discount_ends_at timestamptz,
  licence public.sale_licence, summary_ar text, includes text[],
  status public.listing_status, entry_code text, technologies text[],
  demo_url text, verified boolean, sales_count integer, seller_rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.listing_code, l.project_id,
         (select p.title_ar from public.projects p where p.id = l.project_id),
         l.seller_id,
         (select pr.full_name from public.profiles pr where pr.id = l.seller_id),
         (select t.title_ar from public.teams t where t.id = l.team_id),
         l.price_usd,
         public.listing_price(l.price_usd, l.discount_pct, l.discount_ends_at),
         case when l.discount_pct > 0 and (l.discount_ends_at is null or l.discount_ends_at > now())
              then l.discount_pct else 0::smallint end,
         l.discount_ends_at,
         l.licence, l.summary_ar, l.includes, l.status,
         (select e.entry_code from public.exhibition_entries e
           where e.project_id = l.project_id and e.status = 'exhibited' limit 1),
         coalesce((select e.technologies from public.exhibition_entries e
                    where e.project_id = l.project_id limit 1), '{}'),
         l.demo_url,
         l.verified_at is not null,
         (select count(*)::int from public.project_sales s
            join public.escrows e on e.id = s.escrow_id
           where s.listing_id = l.id and e.status in ('funded', 'released')),
         (select mp.rating_avg from public.mentor_profiles mp
           where mp.profile_id = l.seller_id and mp.approved_at is not null)
    from public.project_listings l
   where l.status = 'listed'
     and (p_search is null or p_search = ''
          or l.summary_ar ilike '%' || p_search || '%'
          or exists (select 1 from public.projects p
                      where p.id = l.project_id and p.title_ar ilike '%' || p_search || '%'))
   order by l.verified_at desc nulls last, l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

grant execute on function public.market_listings(text, integer) to anon, authenticated;

-- What waits for the admin.
create or replace function public.admin_pending_listings()
returns table (
  id uuid, listing_code text, project_id uuid, project_title text, seller_id uuid, seller_name text,
  price_usd numeric, licence public.sale_licence, summary_ar text, includes text[],
  demo_url text, delivery_url text, seller_warnings integer, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.listing_code, l.project_id, p.title_ar, l.seller_id, pr.full_name,
         l.price_usd, l.licence, l.summary_ar, l.includes, l.demo_url, l.delivery_url,
         (select count(*)::int from public.user_warnings w where w.profile_id = l.seller_id),
         l.created_at
    from public.project_listings l
    join public.projects p on p.id = l.project_id
    join public.profiles pr on pr.id = l.seller_id
   where public.is_admin() and l.status = 'pending_review'
   order by l.created_at;
$$;

revoke execute on function public.admin_pending_listings() from public, anon;
grant execute on function public.admin_pending_listings() to authenticated;
