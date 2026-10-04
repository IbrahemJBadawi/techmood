-- =============================================================================
-- 0121 — The project showcase: one project page for the gallery and the
--        market, independent of the academy
--
-- The founder's model:
--
--   Submissions and evaluations  → learning: follow-up, judgement, proof.
--   The gallery (المعرض)         → a public portfolio of a member's work.
--   The market (السوق)           → some of that work sold as digital products.
--
-- So a project is a page of its own — title, short and long description,
-- screenshots, demo and video, links (GitHub, Behance, Figma…), technologies,
-- category and skills, what kind of product it is — and its owner chooses to
-- show it in the gallery, sell it in the market, or both. Nothing requires it
-- to have come from a course. When it did, the owner may say so ("built in the
-- Full Stack path"), and a mentor's approval of the linked hand-in appears as
-- a badge — a mark of quality, never a condition for publishing.
--
-- Decisions taken here, each stated because it changes something:
--
--   * **The gallery no longer waits for a mentor.** A complete page (a short
--     description, a proper description and at least one image) is published
--     by its owner at once. TechMood keeps the power to hide one (with a reason
--     the owner receives), and anyone can report one through support. The
--     mentor-reviewed exhibition (0037) stays as the "verified" route: its
--     entries keep their pages and verification links, and their projects are
--     put in the gallery.
--   * **The market stays reviewed.** Money changes hands, so a listing still
--     waits for an admin (0099) — and now also needs an image, the seller's
--     acceptance of the market terms, and says whether the price can be
--     negotiated.
--   * **Negotiation has rules** (the terms page quotes them): an offer is at
--     least `offer_min_pct`% of the price, a buyer makes at most
--     `offers_per_buyer` offers on one listing, the seller accepts, declines or
--     counters once, every answer has `offer_hours` hours, and an agreed price
--     is held for that long for the buyer to pay. The agreed price is charged
--     through the same escrow as any purchase.
--   * **Numbers belong to the platform.** Views and link clicks are counted by
--     functions (once per visitor per day, the owner's own visits excluded)
--     into a table no one writes to directly; likes (0106), purchases and
--     buyer ratings are counted from their own rows.
--   * **A buyer may rate what they bought**, once, after releasing the money.
--   * **Deleting follows the sale.** A project nobody bought can be deleted;
--     once a copy was sold, buyers keep their access, so it can only be hidden
--     from the gallery and taken off the market.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. What a project page carries
-- ---------------------------------------------------------------------------
create type public.product_type as enum (
  'full_project', 'template', 'design', 'code', 'file', 'digital_service'
);

alter table public.projects
  add column tagline_ar          text,
  add column category            text,
  add column product_type        public.product_type,
  add column skills              text[] not null default '{}',
  -- [{"kind": "github", "url": "https://…"}]
  add column links               jsonb not null default '[]'::jsonb,
  add column demo_url            text,
  add column video_url           text,
  -- object paths in the public project-media bucket: "<project id>/<file>"
  add column images              text[] not null default '{}',
  add column in_gallery          boolean not null default false,
  add column gallery_at          timestamptz,
  add column gallery_hidden_at   timestamptz,
  add column gallery_hidden_note text,
  -- the optional link to the academy
  add column course_id           uuid references public.courses (id) on delete set null,
  add column assignment_id       uuid references public.assignments (id) on delete set null,
  add column submission_id       uuid references public.submissions (id) on delete set null,

  add constraint projects_tagline_len  check (tagline_ar is null or char_length(tagline_ar) <= 200),
  add constraint projects_category_known check (category is null or category in
    ('web', 'mobile', 'design', 'data_ai', 'backend', 'game', 'desktop', 'other')),
  add constraint projects_demo_is_link  check (demo_url  is null or demo_url  ~* '^https?://'),
  add constraint projects_video_is_link check (video_url is null or video_url ~* '^https?://'),
  add constraint projects_images_max    check (cardinality(images) <= 8),
  add constraint projects_skills_max    check (cardinality(skills) <= 15),
  add constraint projects_links_array   check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10);

create index projects_gallery_idx on public.projects (gallery_at desc) where in_gallery;

comment on column public.projects.images is
  'Screenshots, first one is the cover: object paths "<project id>/<file>" in the public project-media bucket (0121).';

-- Who may edit a project's page: its owner, its team's leader, an admin.
create or replace function public.can_edit_showcase(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project
       and (p.owner_id = (select auth.uid())
            or (p.team_id is not null and public.is_team_leader(p.team_id))
            or public.is_admin())
  );
$$;

revoke execute on function public.can_edit_showcase(uuid) from public, anon;
grant execute on function public.can_edit_showcase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Screenshots: a public bucket, written only by who may edit the page
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-media', 'project-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The folder is the project's id; anything else is refused before a cast can fail.
create or replace function public.can_edit_showcase_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.can_edit_showcase(p_folder::uuid);
$$;

revoke execute on function public.can_edit_showcase_folder(text) from public, anon;
grant execute on function public.can_edit_showcase_folder(text) to authenticated;

create policy project_media_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-media' and public.can_edit_showcase_folder((storage.foldername(name))[1]));

-- Public links do not go through policies; listing a folder does.
create policy project_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'project-media' and public.can_edit_showcase_folder((storage.foldername(name))[1]));

create policy project_media_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-media' and public.can_edit_showcase_folder((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 3. The page is checked however it is written
-- ---------------------------------------------------------------------------
create or replace function public.guard_project_showcase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item  jsonb;
  v_links jsonb := '[]'::jsonb;
  v_sub   record;
begin
  -- Moderation is TechMood's: an owner cannot unhide what an admin hid.
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.gallery_hidden_at := null;
      new.gallery_hidden_note := null;
    else
      new.gallery_hidden_at := old.gallery_hidden_at;
      new.gallery_hidden_note := old.gallery_hidden_note;
    end if;
  end if;

  new.tagline_ar := nullif(btrim(coalesce(new.tagline_ar, '')), '');
  new.demo_url   := nullif(btrim(coalesce(new.demo_url, '')), '');
  new.video_url  := nullif(btrim(coalesce(new.video_url, '')), '');
  new.skills     := coalesce(array(select distinct btrim(s) from unnest(new.skills) s where btrim(s) <> ''), '{}');

  -- Screenshots live in this project's own folder of the media bucket.
  if exists (select 1 from unnest(new.images) i
              where i !~ ('^' || new.id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$')) then
    raise exception 'الصور تُرفع من صفحة المشروع نفسها';
  end if;

  -- Links: known kinds, web addresses only.
  for v_item in select * from jsonb_array_elements(coalesce(new.links, '[]'::jsonb)) loop
    continue when coalesce(btrim(v_item ->> 'url'), '') = '';
    if (v_item ->> 'url') !~* '^https?://[^[:space:]]+$' then
      raise exception 'الروابط يجب أن تبدأ بـ http أو https';
    end if;
    v_links := v_links || jsonb_build_array(jsonb_build_object(
      'kind', case when v_item ->> 'kind' in ('github', 'behance', 'figma', 'website', 'drive', 'dribbble', 'linkedin', 'youtube', 'other')
                   then v_item ->> 'kind' else 'other' end,
      'url', btrim(v_item ->> 'url')));
  end loop;
  new.links := v_links;

  -- The academy link, when given, has to be the owner's own.
  if new.submission_id is not null
     and (tg_op = 'INSERT' or new.submission_id is distinct from old.submission_id) then
    select s.profile_id, s.team_id, a.id as assignment_id,
           coalesce(a.course_id, (select m.course_id from public.lessons l
                                    join public.modules m on m.id = l.module_id
                                   where l.id = a.lesson_id)) as course_id,
           a.path_id
      into v_sub
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
     where s.id = new.submission_id;
    if not found or not (v_sub.profile_id = new.owner_id
                         or (new.team_id is not null and v_sub.team_id = new.team_id)) then
      raise exception 'اربط المشروع بتسليم من تسليماتك فقط';
    end if;
    new.assignment_id := v_sub.assignment_id;
    new.course_id := coalesce(v_sub.course_id, new.course_id);
    new.path_id := coalesce(v_sub.path_id, new.path_id);
  end if;

  if new.course_id is not null and new.submission_id is null and new.team_id is null
     and (tg_op = 'INSERT' or new.course_id is distinct from old.course_id)
     and not exists (
       select 1 from public.enrollments e
        where e.profile_id = new.owner_id
          and (e.course_id = new.course_id
               or e.path_id in (select pc.path_id from public.path_courses pc where pc.course_id = new.course_id)))
     and not exists (
       select 1 from public.lesson_progress lp
         join public.lessons l on l.id = lp.lesson_id
         join public.modules m on m.id = l.module_id
        where lp.profile_id = new.owner_id and m.course_id = new.course_id) then
    raise exception 'اربط المشروع بدورة سجّلت فيها';
  end if;

  if new.path_id is not null and new.submission_id is null and new.team_id is null
     and (tg_op = 'INSERT' or new.path_id is distinct from old.path_id)
     and not exists (select 1 from public.enrollments e
                      where e.profile_id = new.owner_id and e.path_id = new.path_id) then
    raise exception 'اربط المشروع بمسار سجّلت فيه';
  end if;

  -- Publishing to the gallery: a complete page, a finished project.
  if new.in_gallery then
    if new.gallery_hidden_at is not null then
      raise exception 'أخفت TechMood هذا المشروع من المعرض: %', coalesce(new.gallery_hidden_note, '');
    end if;
    if new.client_id is not null then
      raise exception 'عمل نُفّذ لعميل لا يُعرض في المعرض';
    end if;
    if new.status not in ('completed', 'sold') then
      raise exception 'يُعرض في المعرض المشروع المكتمل';
    end if;
    if char_length(coalesce(new.tagline_ar, '')) < 20 then
      raise exception 'اكتب وصفاً مختصراً للمشروع (20 حرفاً على الأقل)';
    end if;
    if char_length(btrim(coalesce(new.description_ar, ''))) < 40 then
      raise exception 'اكتب وصفاً تفصيلياً للمشروع (40 حرفاً على الأقل)';
    end if;
    if cardinality(new.images) = 0 then
      raise exception 'أضف صورة واحدة على الأقل للمشروع';
    end if;
    new.gallery_at := coalesce(case when tg_op = 'UPDATE' and old.in_gallery then old.gallery_at end, now());
  else
    new.gallery_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_project_showcase() from public, anon, authenticated;

create trigger projects_showcase_guard
  before insert or update on public.projects
  for each row execute function public.guard_project_showcase();

-- Work a mentor already exhibited is in the gallery.
update public.projects p
   set in_gallery = true, gallery_at = e.published_at
  from public.exhibition_entries e
 where e.project_id = p.id and e.status = 'exhibited' and not p.in_gallery
   and cardinality(p.images) > 0;

-- ---------------------------------------------------------------------------
-- 4. Views and link clicks: counted by the platform, once a visitor a day
-- ---------------------------------------------------------------------------
create table public.project_stats (
  project_id  uuid primary key references public.projects (id) on delete cascade,
  views       integer not null default 0,
  link_clicks integer not null default 0
);

create table public.project_hits (
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor    text not null,
  kind       text not null,          -- 'view', or the link's kind
  day        date not null default current_date,
  primary key (project_id, visitor, kind, day)
);

create index project_hits_day_idx on public.project_hits (day);

alter table public.project_stats enable row level security;
alter table public.project_hits  enable row level security;
-- read through functions only
revoke all on public.project_stats, public.project_hits from anon, authenticated;

-- p_visitor is the browser's own id for a signed-out visitor; a signed-in one
-- is counted as themselves.
create or replace function public.record_project_hit(p_project uuid, p_kind text default 'view', p_visitor uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_visitor text := coalesce(v_me::text, 'a:' || p_visitor::text);
  v_p       public.projects%rowtype;
  v_kind    text := case when p_kind = 'view' then 'view'
                         when p_kind in ('github', 'behance', 'figma', 'website', 'drive', 'dribbble',
                                         'linkedin', 'youtube', 'other', 'demo', 'video') then p_kind
                         else null end;
begin
  if v_visitor is null or v_kind is null then
    return;
  end if;
  select * into v_p from public.projects where id = p_project;
  if not found or v_p.owner_id = v_me
     or (v_p.team_id is not null and v_me is not null and public.is_team_member(v_p.team_id)) then
    return;
  end if;

  insert into public.project_hits (project_id, visitor, kind) values (p_project, v_visitor, v_kind)
  on conflict do nothing;
  if not found then
    return;
  end if;

  insert into public.project_stats (project_id, views, link_clicks)
  values (p_project, (v_kind = 'view')::int, (v_kind <> 'view')::int)
  on conflict (project_id) do update
    set views = public.project_stats.views + (v_kind = 'view')::int,
        link_clicks = public.project_stats.link_clicks + (v_kind <> 'view')::int;

  -- yesterday's visitors are no longer needed to tell today's apart
  if random() < 0.02 then
    delete from public.project_hits where day < current_date - 1;
  end if;
end;
$$;

revoke execute on function public.record_project_hit(uuid, text, uuid) from public;
grant execute on function public.record_project_hit(uuid, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The market: negotiable or not, and the terms accepted
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('market_terms_version', '2026-09-29', 'إصدار شروط البيع والشراء والمفاصلة الذي يوافق عليه البائع والمشتري'),
  ('offer_min_pct',        '50',  'أقل عرض سعر مسموح به كنسبة مئوية من سعر المشروع'),
  ('offer_hours',          '72',  'مهلة الردّ على عرض السعر، ومهلة الدفع بعد الاتفاق (بالساعات)'),
  ('offers_per_buyer',     '3',   'أقصى عدد عروض سعر يقدّمها مشترٍ واحد على المشروع نفسه')
on conflict (key) do nothing;

alter table public.project_listings
  add column negotiable        boolean not null default false,
  add column terms_version     text,
  add column terms_accepted_at timestamptz;

grant select (negotiable) on public.project_listings to anon, authenticated;

create type public.offer_status as enum (
  'pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired', 'used'
);

create table public.listing_offers (
  id             uuid primary key default extensions.gen_random_uuid(),
  listing_id     uuid not null references public.project_listings (id) on delete cascade,
  buyer_id       uuid not null references public.profiles (id) on delete cascade,
  seller_id      uuid not null references public.profiles (id) on delete cascade,
  amount_usd     numeric(10,2) not null check (amount_usd > 0),
  counter_usd    numeric(10,2) check (counter_usd is null or counter_usd > 0),
  agreed_usd     numeric(10,2) check (agreed_usd is null or agreed_usd > 0),
  message_ar     text check (message_ar is null or char_length(message_ar) <= 300),
  seller_note_ar text check (seller_note_ar is null or char_length(seller_note_ar) <= 300),
  status         public.offer_status not null default 'pending',
  -- pending/countered: the time to answer; accepted: the time to pay
  expires_at     timestamptz not null,
  terms_version  text not null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

create unique index listing_offers_one_open on public.listing_offers (listing_id, buyer_id)
  where status in ('pending', 'countered', 'accepted');
create index listing_offers_seller_idx on public.listing_offers (seller_id, created_at desc);
create index listing_offers_buyer_idx on public.listing_offers (buyer_id, created_at desc);

alter table public.listing_offers enable row level security;

create policy listing_offers_read on public.listing_offers
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or public.is_admin());

grant select on public.listing_offers to authenticated;
revoke insert, update, delete on public.listing_offers from anon, authenticated;

alter table public.project_sales
  add column offer_id      uuid references public.listing_offers (id) on delete set null,
  add column terms_version text;

create or replace function public.market_terms_version()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.platform_settings where key = 'market_terms_version'), '1');
$$;

revoke execute on function public.market_terms_version() from public;
grant execute on function public.market_terms_version() to anon, authenticated;

-- Answers that ran out of time, closed before anything reads them.
create or replace function public.expire_listing_offers()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listing_offers
     set status = 'expired', decided_at = coalesce(decided_at, now())
   where status in ('pending', 'countered', 'accepted') and expires_at < now();
$$;

revoke execute on function public.expire_listing_offers() from public, anon, authenticated;

-- Listing, now with an image, the negotiable flag and the terms.
drop function public.list_project_for_sale(uuid, numeric, text, text, public.sale_licence, text[], text, integer, timestamptz);

create function public.list_project_for_sale(
  p_project          uuid,
  p_price            numeric,
  p_summary          text,
  p_delivery_url     text,
  p_licence          public.sale_licence default 'usage_rights',
  p_includes         text[] default '{}',
  p_demo_url         text default null,
  p_discount_pct     integer default 0,
  p_discount_ends_at timestamptz default null,
  p_negotiable       boolean default false,
  p_accept_terms     boolean default false
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

  if coalesce(p_accept_terms, false) is not true then
    raise exception 'الموافقة على شروط البيع والشراء مطلوبة';
  end if;

  if v_project.status not in ('completed', 'sold') then
    raise exception 'يُعرض المشروع للبيع بعد اكتماله فقط';
  end if;

  if v_project.client_id is not null then
    raise exception 'هذا العمل نُفّذ لعميل، ولا يُعاد بيعه';
  end if;

  if v_project.gallery_hidden_at is not null then
    raise exception 'أخفت TechMood هذا المشروع، ولا يُعرض للبيع';
  end if;

  if cardinality(v_project.images) = 0 then
    raise exception 'أضف صورة واحدة على الأقل للمشروع قبل عرضه للبيع';
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
     delivery_url, demo_url, discount_pct, discount_ends_at, status,
     negotiable, terms_version, terms_accepted_at)
  values (p_project, v_me, v_project.team_id, p_price, p_licence, trim(p_summary), coalesce(p_includes, '{}'),
          btrim(p_delivery_url), nullif(btrim(p_demo_url), ''), coalesce(p_discount_pct, 0),
          p_discount_ends_at, 'pending_review',
          coalesce(p_negotiable, false), public.market_terms_version(), now())
  on conflict (project_id) do update
    set price_usd         = excluded.price_usd,
        licence           = excluded.licence,
        summary_ar        = excluded.summary_ar,
        includes          = excluded.includes,
        delivery_url      = excluded.delivery_url,
        demo_url          = excluded.demo_url,
        discount_pct      = excluded.discount_pct,
        discount_ends_at  = excluded.discount_ends_at,
        seller_id         = excluded.seller_id,
        negotiable        = excluded.negotiable,
        terms_version     = excluded.terms_version,
        terms_accepted_at = excluded.terms_accepted_at,
        -- an edit is checked again before it shows
        status            = 'pending_review',
        verified_at       = null,
        verified_by       = null,
        review_note_ar    = null,
        reviewed_at       = null
  returning * into v_listing;

  -- offers on the old terms do not bind the new listing
  update public.listing_offers
     set status = 'expired', decided_at = now()
   where listing_id = v_listing.id and status in ('pending', 'countered', 'accepted');

  perform public.notify_admins('عرض في السوق بانتظار المراجعة',
    trim(p_summary), '/admin/market', 'listing', v_listing.id, 'normal');

  return v_listing;
end;
$$;

revoke execute on function public.list_project_for_sale(uuid, numeric, text, text, public.sale_licence, text[], text, integer, timestamptz, boolean, boolean) from public, anon;
grant execute on function public.list_project_for_sale(uuid, numeric, text, text, public.sale_licence, text[], text, integer, timestamptz, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Negotiation (المفاصلة)
-- ---------------------------------------------------------------------------
create or replace function public.make_offer(
  p_listing      uuid,
  p_amount       numeric,
  p_message      text default null,
  p_accept_terms boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_listing public.project_listings%rowtype;
  v_price   numeric;
  v_min     numeric;
  v_id      uuid;
  v_title   text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  perform public.expire_listing_offers();

  select * into v_listing from public.project_listings where id = p_listing;
  if not found or v_listing.status <> 'listed' then
    raise exception 'هذا العرض غير متاح للشراء';
  end if;
  if not v_listing.negotiable then
    raise exception 'سعر هذا المشروع ثابت — لا يقبل البائع عروض أسعار';
  end if;
  if v_listing.seller_id = v_me then
    raise exception 'لا يمكنك تقديم عرض على مشروعك';
  end if;
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'الموافقة على شروط البيع والشراء مطلوبة';
  end if;
  if exists (select 1 from public.listing_offers o
              where o.listing_id = p_listing and o.buyer_id = v_me
                and o.status in ('pending', 'countered', 'accepted')) then
    raise exception 'لديك عرض مفتوح على هذا المشروع';
  end if;
  if (select count(*) from public.listing_offers o where o.listing_id = p_listing and o.buyer_id = v_me)
     >= coalesce(public.setting_int('offers_per_buyer'), 3) then
    raise exception 'بلغت الحد الأقصى لعروض السعر على هذا المشروع (%)', coalesce(public.setting_int('offers_per_buyer'), 3);
  end if;

  v_price := public.listing_price(v_listing.price_usd, v_listing.discount_pct, v_listing.discount_ends_at);
  v_min := round(v_price * coalesce(public.setting_int('offer_min_pct'), 50) / 100.0, 2);
  if coalesce(p_amount, 0) < v_min or p_amount >= v_price then
    raise exception 'العرض يجب أن يكون من % إلى أقل من % دولاراً', v_min, v_price;
  end if;

  insert into public.listing_offers
    (listing_id, buyer_id, seller_id, amount_usd, message_ar, expires_at, terms_version)
  values (p_listing, v_me, v_listing.seller_id, round(p_amount, 2), nullif(btrim(p_message), ''),
          now() + make_interval(hours => coalesce(public.setting_int('offer_hours'), 72)),
          public.market_terms_version())
  returning id into v_id;

  select title_ar into v_title from public.projects where id = v_listing.project_id;
  perform public.notify(v_listing.seller_id, 'system', 'عرض سعر على مشروعك',
    'عرض بـ ' || round(p_amount, 2) || '$ على «' || v_title || '» — ردّ قبل انتهاء المهلة.',
    '/marketplace?tab=offers');

  return v_id;
end;
$$;

revoke execute on function public.make_offer(uuid, numeric, text, boolean) from public, anon;
grant execute on function public.make_offer(uuid, numeric, text, boolean) to authenticated;

-- The seller: accept, decline, or counter once.
create or replace function public.respond_to_offer(
  p_offer   uuid,
  p_action  text,            -- 'accept' | 'reject' | 'counter'
  p_counter numeric default null,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer   public.listing_offers%rowtype;
  v_listing public.project_listings%rowtype;
  v_price   numeric;
  v_hours   integer := coalesce(public.setting_int('offer_hours'), 72);
begin
  perform public.expire_listing_offers();
  select * into v_offer from public.listing_offers where id = p_offer for update;
  if not found or v_offer.seller_id is distinct from (select auth.uid()) then
    raise exception 'عرض السعر غير موجود';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'هذا العرض لا ينتظر ردّك';
  end if;
  select * into v_listing from public.project_listings where id = v_offer.listing_id;
  if v_listing.status <> 'listed' then
    raise exception 'المشروع لم يعد معروضاً للبيع';
  end if;
  v_price := public.listing_price(v_listing.price_usd, v_listing.discount_pct, v_listing.discount_ends_at);

  if p_action = 'accept' then
    update public.listing_offers
       set status = 'accepted', agreed_usd = amount_usd, seller_note_ar = nullif(btrim(p_note), ''),
           decided_at = now(), expires_at = now() + make_interval(hours => v_hours)
     where id = p_offer;
    perform public.notify(v_offer.buyer_id, 'system', 'قُبل عرض سعرك',
      'اتفقتما على ' || v_offer.amount_usd || '$ — ادفع خلال ' || v_hours || ' ساعة ليبقى السعر محجوزاً لك.',
      '/marketplace?tab=offers');
  elsif p_action = 'reject' then
    update public.listing_offers
       set status = 'rejected', seller_note_ar = nullif(btrim(p_note), ''), decided_at = now()
     where id = p_offer;
    perform public.notify(v_offer.buyer_id, 'system', 'لم يقبل البائع عرض سعرك',
      coalesce(nullif(btrim(p_note), ''), 'يمكنك الشراء بالسعر المعروض أو تقديم عرض آخر.'),
      '/marketplace?tab=offers');
  elsif p_action = 'counter' then
    if coalesce(p_counter, 0) <= v_offer.amount_usd or p_counter >= v_price then
      raise exception 'السعر المقابل يجب أن يكون أعلى من عرض المشتري وأقل من السعر المعروض (%$)', v_price;
    end if;
    update public.listing_offers
       set status = 'countered', counter_usd = round(p_counter, 2), seller_note_ar = nullif(btrim(p_note), ''),
           decided_at = now(), expires_at = now() + make_interval(hours => v_hours)
     where id = p_offer;
    perform public.notify(v_offer.buyer_id, 'system', 'عرض مقابل من البائع',
      'يقترح البائع ' || round(p_counter, 2) || '$ — اقبل أو ارفض قبل انتهاء المهلة.',
      '/marketplace?tab=offers');
  else
    raise exception 'إجراء غير معروف';
  end if;
end;
$$;

revoke execute on function public.respond_to_offer(uuid, text, numeric, text) from public, anon;
grant execute on function public.respond_to_offer(uuid, text, numeric, text) to authenticated;

-- The buyer: answer a counter, or withdraw.
create or replace function public.answer_offer(p_offer uuid, p_action text)   -- 'accept' | 'reject' | 'withdraw'
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.listing_offers%rowtype;
  v_hours integer := coalesce(public.setting_int('offer_hours'), 72);
begin
  perform public.expire_listing_offers();
  select * into v_offer from public.listing_offers where id = p_offer for update;
  if not found or v_offer.buyer_id is distinct from (select auth.uid()) then
    raise exception 'عرض السعر غير موجود';
  end if;

  if p_action = 'withdraw' then
    if v_offer.status not in ('pending', 'countered', 'accepted') then
      raise exception 'هذا العرض منتهٍ';
    end if;
    update public.listing_offers set status = 'withdrawn', decided_at = now() where id = p_offer;
    return;
  end if;

  if v_offer.status <> 'countered' then
    raise exception 'لا عرض مقابل بانتظار ردّك';
  end if;
  if not exists (select 1 from public.project_listings l where l.id = v_offer.listing_id and l.status = 'listed') then
    raise exception 'المشروع لم يعد معروضاً للبيع';
  end if;

  if p_action = 'accept' then
    update public.listing_offers
       set status = 'accepted', agreed_usd = counter_usd, decided_at = now(),
           expires_at = now() + make_interval(hours => v_hours)
     where id = p_offer;
    perform public.notify(v_offer.seller_id, 'system', 'قبل المشتري سعرك المقابل',
      'اتفقتما على ' || v_offer.counter_usd || '$ — ينتظر الدفع.', '/marketplace?tab=offers');
  elsif p_action = 'reject' then
    update public.listing_offers set status = 'rejected', decided_at = now() where id = p_offer;
    perform public.notify(v_offer.seller_id, 'system', 'رفض المشتري سعرك المقابل',
      'انتهت هذه المفاصلة دون اتفاق.', '/marketplace?tab=offers');
  else
    raise exception 'إجراء غير معروف';
  end if;
end;
$$;

revoke execute on function public.answer_offer(uuid, text) from public, anon;
grant execute on function public.answer_offer(uuid, text) to authenticated;

create or replace function public.my_listing_offers()
returns table (
  id uuid, role text, listing_id uuid, project_id uuid, project_code text, project_title text,
  other_name text, list_price numeric, amount_usd numeric, counter_usd numeric, agreed_usd numeric,
  message_ar text, seller_note_ar text, status public.offer_status, expires_at timestamptz, created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select o.id,
         case when o.seller_id = (select auth.uid()) then 'seller' else 'buyer' end,
         o.listing_id, p.id, p.code, p.title_ar,
         (select coalesce(pr.display_name, pr.full_name) from public.profiles pr
           where pr.id = case when o.seller_id = (select auth.uid()) then o.buyer_id else o.seller_id end),
         public.listing_price(l.price_usd, l.discount_pct, l.discount_ends_at),
         o.amount_usd, o.counter_usd, o.agreed_usd, o.message_ar, o.seller_note_ar,
         case when o.status in ('pending', 'countered', 'accepted') and o.expires_at < now()
              then 'expired'::public.offer_status else o.status end,
         o.expires_at, o.created_at
    from public.listing_offers o
    join public.project_listings l on l.id = o.listing_id
    join public.projects p on p.id = l.project_id
   where o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid())
   order by o.created_at desc
   limit 100;
$$;

revoke execute on function public.my_listing_offers() from public, anon;
grant execute on function public.my_listing_offers() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Buying — at the listed price, or at the price agreed
-- ---------------------------------------------------------------------------
drop function public.buy_project(uuid, text);

create function public.buy_project(
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

  v_price := public.listing_price(v_listing.price_usd, v_listing.discount_pct, v_listing.discount_ends_at);

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

revoke execute on function public.buy_project(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.buy_project(uuid, text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. A buyer's rating, once, after the money is released
-- ---------------------------------------------------------------------------
create table public.project_reviews (
  sale_id    uuid primary key references public.project_sales (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  comment_ar text check (comment_ar is null or char_length(comment_ar) <= 1000),
  created_at timestamptz not null default now()
);

create index project_reviews_project_idx on public.project_reviews (project_id, created_at desc);

alter table public.project_reviews enable row level security;
create policy project_reviews_read on public.project_reviews for select to anon, authenticated using (true);
grant select on public.project_reviews to anon, authenticated;
revoke insert, update, delete on public.project_reviews from anon, authenticated;

create or replace function public.rate_purchase(p_sale uuid, p_stars integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.project_sales%rowtype;
begin
  select * into v_sale from public.project_sales where id = p_sale;
  if not found or v_sale.buyer_id is distinct from (select auth.uid()) then
    raise exception 'الشراء غير موجود';
  end if;
  if v_sale.completed_at is null then
    raise exception 'التقييم بعد استلام المشروع والإفراج عن المبلغ';
  end if;
  if coalesce(p_stars, 0) not between 1 and 5 then
    raise exception 'التقييم من 1 إلى 5 نجوم';
  end if;
  insert into public.project_reviews (sale_id, project_id, buyer_id, stars, comment_ar)
  values (p_sale, v_sale.project_id, v_sale.buyer_id, p_stars, nullif(btrim(p_comment), ''));
  perform public.notify(v_sale.seller_id, 'system', 'تقييم جديد لمشروعك',
    p_stars || ' نجوم من مشترٍ.', '/projects/' || v_sale.project_id::text);
exception when unique_violation then
  raise exception 'قيّمت هذا الشراء من قبل';
end;
$$;

revoke execute on function public.rate_purchase(uuid, integer, text) from public, anon;
grant execute on function public.rate_purchase(uuid, integer, text) to authenticated;

-- What a buyer bought: with the page to go back to and whether they rated it.
drop function public.my_purchases();

create function public.my_purchases()
returns table (
  sale_id       uuid,
  listing_code  text,
  project_id    uuid,
  project_code  text,
  project_title text,
  seller_name   text,
  amount_usd    numeric,
  licence       public.sale_licence,
  escrow_id     uuid,
  escrow_status public.escrow_status,
  delivery_url  text,
  completed     boolean,
  my_stars      smallint,
  bought_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, l.listing_code, p.id, p.code, p.title_ar, pr.full_name, s.amount_usd, s.licence,
         e.id, e.status,
         case when e.status in ('funded', 'released', 'disputed') then l.delivery_url end,
         s.completed_at is not null,
         (select r.stars from public.project_reviews r where r.sale_id = s.id),
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

-- ---------------------------------------------------------------------------
-- 9. Reading the gallery and the market, and one project page
-- ---------------------------------------------------------------------------
-- What the public may see: not hidden, not client work, and either in the
-- gallery or on the market (a listing that sold outright stays visible, marked sold).
create or replace function public.showcase_visible(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
     where p.id = p_project and p.gallery_hidden_at is null and p.client_id is null
       and (p.in_gallery or exists (select 1 from public.project_listings l
                                     where l.project_id = p.id and l.status in ('listed', 'reserved', 'sold')))
  );
$$;

-- read inside the page functions; not a call for the public
revoke execute on function public.showcase_visible(uuid) from public, anon, authenticated;

-- A mentor's approval of the linked hand-in, or of an exhibition entry.
create or replace function public.showcase_mentor_rating(p_project uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ev.stars::numeric from public.projects p
       join public.evaluations ev on ev.submission_id = p.submission_id
      where p.id = p_project and ev.decision = 'approved'
      order by ev.created_at desc limit 1),
    (select (e.snapshot #>> '{evaluation,rating}')::numeric from public.exhibition_entries e
      where e.project_id = p_project and e.status in ('approved', 'exhibited') and e.snapshot is not null
      limit 1));
$$;

revoke execute on function public.showcase_mentor_rating(uuid) from public, anon, authenticated;

create or replace function public.gallery_projects(
  p_mode     text default 'all',        -- 'all' | 'gallery' | 'market'
  p_search   text default null,
  p_category text default null,
  p_type     public.product_type default null,
  p_sort     text default 'new',        -- 'new' | 'popular' | 'price_low' | 'price_high'
  p_limit    integer default 24,
  p_offset   integer default 0,
  p_owner    uuid default null
)
returns table (
  project_id uuid, code text, title text, tagline text, cover text,
  category text, product_type public.product_type, technologies text[],
  owner_id uuid, owner_name text, team_title text,
  in_gallery boolean, gallery_at timestamptz,
  listing_id uuid, listing_status public.listing_status, price_usd numeric, effective_price numeric,
  discount_pct smallint, negotiable boolean, licence public.sale_licence, verified boolean,
  likes integer, views integer, sales_count integer, rating numeric, reviews_count integer,
  academic_title text, mentor_rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select p.*,
           l.id as l_id, l.status as l_status, l.price_usd as l_price, l.discount_pct as l_discount,
           l.discount_ends_at as l_ends, l.negotiable as l_negotiable, l.licence as l_licence,
           l.verified_at as l_verified
      from public.projects p
      left join public.project_listings l
             on l.project_id = p.id and l.status in ('listed', 'reserved', 'sold')
     where p.gallery_hidden_at is null and p.client_id is null
       and (p_owner is null or p.owner_id = p_owner)
       and case coalesce(p_mode, 'all')
             when 'gallery' then p.in_gallery
             when 'market'  then l.status = 'listed'
             else p.in_gallery or l.id is not null
           end
       and (p_category is null or p.category = p_category)
       and (p_type is null or p.product_type = p_type)
       and (coalesce(btrim(p_search), '') = ''
            or p.title_ar ilike '%' || btrim(p_search) || '%'
            or p.tagline_ar ilike '%' || btrim(p_search) || '%'
            or exists (select 1 from unnest(p.tags || p.skills) tg where tg ilike '%' || btrim(p_search) || '%'))
  ),
  numbers as (
    select b.*,
           (select count(*)::int from public.project_likes lk where lk.project_id = b.id and lk.active) as n_likes,
           coalesce((select st.views from public.project_stats st where st.project_id = b.id), 0) as n_views,
           (select count(*)::int from public.project_sales s join public.escrows e on e.id = s.escrow_id
             where s.project_id = b.id and e.status in ('funded', 'released')) as n_sales,
           (select round(avg(r.stars)::numeric, 1) from public.project_reviews r where r.project_id = b.id) as n_rating,
           (select count(*)::int from public.project_reviews r where r.project_id = b.id) as n_reviews,
           case when b.l_id is not null then public.listing_price(b.l_price, b.l_discount, b.l_ends) end as n_price
      from base b
  )
  select n.id, n.code, n.title_ar, n.tagline_ar, n.images[1], n.category, n.product_type, n.tags,
         n.owner_id,
         (select coalesce(pr.display_name, pr.full_name) from public.profiles pr where pr.id = n.owner_id),
         (select t.title_ar from public.teams t where t.id = n.team_id),
         n.in_gallery, n.gallery_at,
         n.l_id, n.l_status, n.l_price, n.n_price,
         case when n.l_discount > 0 and (n.l_ends is null or n.l_ends > now()) then n.l_discount else 0::smallint end,
         coalesce(n.l_negotiable, false), n.l_licence, n.l_verified is not null,
         n.n_likes, n.n_views, n.n_sales, n.n_rating, n.n_reviews,
         coalesce((select lp.title_ar from public.learning_paths lp where lp.id = n.path_id),
                  (select c.title_ar from public.courses c where c.id = n.course_id)),
         public.showcase_mentor_rating(n.id)
    from numbers n
   order by
     case when p_sort = 'popular' then n.n_likes * 10 + n.n_views + n.n_sales * 20 end desc nulls last,
     case when p_sort = 'price_low' then n.n_price end asc nulls last,
     case when p_sort = 'price_high' then n.n_price end desc nulls last,
     coalesce(n.gallery_at, n.created_at) desc
   limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function public.gallery_projects(text, text, text, public.product_type, text, integer, integer, uuid) from public;
grant execute on function public.gallery_projects(text, text, text, public.product_type, text, integer, integer, uuid) to anon, authenticated;

-- One project page, for anyone when it is public, for its editors always.
create or replace function public.showcase_project(p_code text)
returns table (
  project_id uuid, code text, title text, tagline text, description text,
  images text[], links jsonb, demo_url text, video_url text,
  category text, product_type public.product_type, technologies text[], skills text[],
  status public.project_status, completed_at timestamptz,
  owner_id uuid, owner_name text, owner_techmood_id text, owner_avatar text,
  team_title text, team_code text,
  in_gallery boolean, gallery_at timestamptz, hidden_note text, is_public_page boolean, can_edit boolean,
  path_title text, path_slug text, course_title text, course_slug text, assignment_title text,
  mentor_rating numeric, exhibition_code text,
  listing_id uuid, listing_code text, listing_status public.listing_status, licence public.sale_licence,
  price_usd numeric, effective_price numeric, discount_pct smallint, discount_ends_at timestamptz,
  negotiable boolean, listing_summary text, includes text[], verified boolean,
  likes integer, views integer, link_clicks integer, sales_count integer, rating numeric, reviews_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.code, p.title_ar, p.tagline_ar, p.description_ar,
         p.images, p.links, p.demo_url, p.video_url,
         p.category, p.product_type, p.tags, p.skills,
         p.status, p.completed_at,
         p.owner_id, coalesce(o.display_name, o.full_name), o.techmood_id, o.avatar_url,
         t.title_ar, t.team_code,
         p.in_gallery, p.gallery_at,
         case when public.can_edit_showcase(p.id) then p.gallery_hidden_note end,
         public.showcase_visible(p.id), public.can_edit_showcase(p.id),
         lp.title_ar, lp.slug, c.title_ar, c.slug, a.title_ar,
         public.showcase_mentor_rating(p.id),
         (select e.entry_code from public.exhibition_entries e where e.project_id = p.id and e.status = 'exhibited'),
         l.id, l.listing_code, l.status, l.licence,
         l.price_usd, case when l.id is not null then public.listing_price(l.price_usd, l.discount_pct, l.discount_ends_at) end,
         case when l.discount_pct > 0 and (l.discount_ends_at is null or l.discount_ends_at > now()) then l.discount_pct else 0::smallint end,
         l.discount_ends_at, coalesce(l.negotiable, false), l.summary_ar, l.includes, l.verified_at is not null,
         (select count(*)::int from public.project_likes lk where lk.project_id = p.id and lk.active),
         coalesce((select st.views from public.project_stats st where st.project_id = p.id), 0),
         coalesce((select st.link_clicks from public.project_stats st where st.project_id = p.id), 0),
         (select count(*)::int from public.project_sales s join public.escrows e on e.id = s.escrow_id
           where s.project_id = p.id and e.status in ('funded', 'released')),
         (select round(avg(r.stars)::numeric, 1) from public.project_reviews r where r.project_id = p.id),
         (select count(*)::int from public.project_reviews r where r.project_id = p.id)
    from public.projects p
    join public.profiles o on o.id = p.owner_id
    left join public.teams t on t.id = p.team_id
    left join public.learning_paths lp on lp.id = p.path_id
    left join public.courses c on c.id = p.course_id
    left join public.assignments a on a.id = p.assignment_id
    -- the listing the public may see; its seller sees theirs whatever its state
    left join public.project_listings l
           on l.project_id = p.id
          and (l.status in ('listed', 'reserved', 'sold') or public.can_edit_showcase(p.id))
   where p.code = upper(btrim(p_code))
     and (public.showcase_visible(p.id) or public.can_edit_showcase(p.id));
$$;

revoke execute on function public.showcase_project(text) from public;
grant execute on function public.showcase_project(text) to anon, authenticated;

create or replace function public.showcase_reviews(p_project uuid)
returns table (stars smallint, comment_ar text, buyer_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.stars, r.comment_ar,
         split_part(coalesce(pr.display_name, pr.full_name), ' ', 1),
         r.created_at
    from public.project_reviews r
    join public.profiles pr on pr.id = r.buyer_id
   where r.project_id = p_project
     and (public.showcase_visible(p_project) or public.can_edit_showcase(p_project))
   order by r.created_at desc
   limit 50;
$$;

revoke execute on function public.showcase_reviews(uuid) from public;
grant execute on function public.showcase_reviews(uuid) to anon, authenticated;

-- The owner's numbers for one project.
create or replace function public.my_project_stats(p_project uuid)
returns table (
  likes integer, views integer, link_clicks integer, sales_count integer,
  revenue_usd numeric, rating numeric, reviews_count integer, open_offers integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::int from public.project_likes lk where lk.project_id = p_project and lk.active),
         coalesce((select st.views from public.project_stats st where st.project_id = p_project), 0),
         coalesce((select st.link_clicks from public.project_stats st where st.project_id = p_project), 0),
         (select count(*)::int from public.project_sales s join public.escrows e on e.id = s.escrow_id
           where s.project_id = p_project and e.status in ('funded', 'released')),
         coalesce((select sum(e.net_usd) from public.project_sales s join public.escrows e on e.id = s.escrow_id
                    where s.project_id = p_project and e.status = 'released'), 0),
         (select round(avg(r.stars)::numeric, 1) from public.project_reviews r where r.project_id = p_project),
         (select count(*)::int from public.project_reviews r where r.project_id = p_project),
         (select count(*)::int from public.listing_offers o join public.project_listings l on l.id = o.listing_id
           where l.project_id = p_project and o.status = 'pending' and o.expires_at > now())
   where public.can_edit_showcase(p_project);
$$;

revoke execute on function public.my_project_stats(uuid) from public, anon;
grant execute on function public.my_project_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Moderation and deletion
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_project_hidden(p_project uuid, p_hidden boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
begin
  if not public.is_admin() then
    raise exception 'الإشراف على المعرض للإدارة فقط';
  end if;
  select * into v_p from public.projects where id = p_project for update;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if p_hidden then
    if char_length(coalesce(btrim(p_note), '')) < 10 then
      raise exception 'سبب الإخفاء مطلوب — يصل لصاحب المشروع';
    end if;
    update public.projects
       set gallery_hidden_at = now(), gallery_hidden_note = btrim(p_note), in_gallery = false
     where id = p_project;
    update public.project_listings set status = 'withdrawn'
     where project_id = p_project and status in ('listed', 'pending_review');
    perform public.notify(v_p.owner_id, 'system', 'أُخفي مشروعك من المعرض والسوق',
      btrim(p_note), '/projects/' || p_project::text);
  else
    update public.projects set gallery_hidden_at = null, gallery_hidden_note = null where id = p_project;
    perform public.notify(v_p.owner_id, 'system', 'أُعيد إظهار مشروعك',
      'يمكنك نشره في المعرض أو عرضه للبيع من جديد.', '/projects/' || p_project::text);
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values ((select auth.uid()), case when p_hidden then 'project_hidden' else 'project_unhidden' end,
          'projects', p_project, jsonb_build_object('in_gallery', v_p.in_gallery),
          jsonb_build_object('hidden', p_hidden, 'note', nullif(btrim(p_note), '')));
end;
$$;

revoke execute on function public.admin_set_project_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_project_hidden(uuid, boolean, text) to authenticated;

create or replace function public.delete_showcase_project(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or v_p.owner_id is distinct from (select auth.uid()) then
    raise exception 'صاحب المشروع فقط من يحذفه';
  end if;
  if v_p.team_id is not null or v_p.client_id is not null or v_p.opportunity_id is not null then
    raise exception 'مشروع الفريق أو العميل لا يُحذف من هنا';
  end if;
  if exists (select 1 from public.project_sales s
               left join public.escrows e on e.id = s.escrow_id
              where s.project_id = p_project
                and coalesce(e.status::text, 'awaiting_payment') not in ('cancelled', 'refunded')) then
    raise exception 'بيعت نسخ من هذا المشروع أو هناك شراء جارٍ — يمكنك إخفاؤه من المعرض وسحبه من السوق، لا حذفه';
  end if;
  if exists (select 1 from public.escrows e where e.project_id = p_project
              and e.status not in ('cancelled', 'refunded')) then
    raise exception 'على هذا المشروع مال محتجز — لا يُحذف';
  end if;
  delete from public.projects where id = p_project;
end;
$$;

revoke execute on function public.delete_showcase_project(uuid) from public, anon;
grant execute on function public.delete_showcase_project(uuid) to authenticated;
