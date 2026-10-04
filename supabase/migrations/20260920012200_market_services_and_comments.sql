-- =============================================================================
-- 0122 — The market's three shelves, comments, the people behind a page, and
--        a service order's conversation
--
-- The founder's market, on top of the showcase (0121):
--
--   * **Projects · Services · Jobs (soon).** A page whose product type is
--     "digital service" is a service; everything else is a project. The
--     gallery and the market read the same pages and split them by this.
--   * **The people behind it.** A page shows its owner — or, for a team's
--     work, every member with the leader marked — so a buyer knows who built it.
--   * **Comments.** Signed-in members comment on a public page (a reply goes
--     under its comment). The owner is told; the author, the page's editors
--     and TechMood may remove one. No links in comments, like messages (0019),
--     and at most 10 comments an hour per person.
--   * **A service order opens a conversation — after the payment.** This
--     changes 0092 for services only, by the founder's decision: a service is
--     work done *for* the buyer, and needs talking about. The conversation
--     opens only once TechMood has confirmed the payment (the money is held,
--     so nothing can be moved off the platform), keeps the no-links rule, and
--     turns read-only when the order ends (released, refunded or cancelled).
--     Sessions and project sales keep 0092's rule: no private chat.
-- =============================================================================

-- Comments are counted on every card, so their table comes first (section 2).
create table public.project_comments (
  id         uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.project_comments (id) on delete cascade,
  body_ar    text not null check (char_length(btrim(body_ar)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index project_comments_project_idx on public.project_comments (project_id, created_at);
create index project_comments_author_idx on public.project_comments (author_id, created_at desc);

alter table public.project_comments enable row level security;
-- read and written through the functions below
revoke all on public.project_comments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The shelves: the same reader, split by product type
-- ---------------------------------------------------------------------------
drop function public.gallery_projects(text, text, text, public.product_type, text, integer, integer, uuid);

create function public.gallery_projects(
  p_mode     text default 'all',        -- 'all' | 'gallery' | 'market'
  p_search   text default null,
  p_category text default null,
  p_type     public.product_type default null,
  p_sort     text default 'new',        -- 'new' | 'popular' | 'price_low' | 'price_high'
  p_limit    integer default 24,
  p_offset   integer default 0,
  p_owner    uuid default null,
  p_group    text default null          -- 'projects' | 'services' | null for both
)
returns table (
  project_id uuid, code text, title text, tagline text, cover text,
  category text, product_type public.product_type, technologies text[],
  owner_id uuid, owner_name text, team_title text,
  in_gallery boolean, gallery_at timestamptz,
  listing_id uuid, listing_status public.listing_status, price_usd numeric, effective_price numeric,
  discount_pct smallint, negotiable boolean, licence public.sale_licence, verified boolean,
  likes integer, views integer, sales_count integer, rating numeric, reviews_count integer,
  academic_title text, mentor_rating numeric, comments_count integer, owner_avatar text
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
       and case p_group
             when 'services' then p.product_type = 'digital_service'
             when 'projects' then p.product_type is distinct from 'digital_service'
             else true
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
         public.showcase_mentor_rating(n.id),
         (select count(*)::int from public.project_comments pc where pc.project_id = n.id and pc.deleted_at is null),
         (select pr.avatar_url from public.profiles pr where pr.id = n.owner_id)
    from numbers n
   order by
     case when p_sort = 'popular' then n.n_likes * 10 + n.n_views + n.n_sales * 20 end desc nulls last,
     case when p_sort = 'price_low' then n.n_price end asc nulls last,
     case when p_sort = 'price_high' then n.n_price end desc nulls last,
     coalesce(n.gallery_at, n.created_at) desc
   limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- 2. Comments
-- ---------------------------------------------------------------------------

revoke execute on function public.gallery_projects(text, text, text, public.product_type, text, integer, integer, uuid, text) from public;
grant execute on function public.gallery_projects(text, text, text, public.product_type, text, integer, integer, uuid, text) to anon, authenticated;

create or replace function public.add_project_comment(p_project uuid, p_body text, p_parent uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_p     public.projects%rowtype;
  v_id    uuid;
  v_name  text;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_p from public.projects where id = p_project;
  if not found or not public.showcase_visible(p_project) then
    raise exception 'المشروع غير موجود';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception 'التعليق من حرف إلى 1000 حرف';
  end if;
  if v_body ~* '(https?://|www\.)' then
    raise exception 'لا روابط في التعليقات';
  end if;
  if (select count(*) from public.project_comments c
       where c.author_id = v_me and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'كثير من التعليقات خلال ساعة — حاول لاحقاً';
  end if;
  if p_parent is not null and not exists (
       select 1 from public.project_comments c
        where c.id = p_parent and c.project_id = p_project and c.parent_id is null and c.deleted_at is null) then
    raise exception 'الرد على تعليق غير موجود';
  end if;

  insert into public.project_comments (project_id, author_id, parent_id, body_ar)
  values (p_project, v_me, p_parent, v_body)
  returning id into v_id;

  if v_p.owner_id <> v_me then
    select coalesce(display_name, full_name) into v_name from public.profiles where id = v_me;
    perform public.notify(v_p.owner_id, 'project', 'تعليق جديد على مشروعك',
      coalesce(v_name, 'عضو') || ': ' || left(v_body, 120), '/p/' || v_p.code);
  end if;
  if p_parent is not null then
    perform public.notify(c.author_id, 'project', 'ردّ على تعليقك', left(v_body, 120), '/p/' || v_p.code)
       from public.project_comments c where c.id = p_parent and c.author_id <> v_me;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.add_project_comment(uuid, text, uuid) from public, anon;
grant execute on function public.add_project_comment(uuid, text, uuid) to authenticated;

create or replace function public.delete_project_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.project_comments%rowtype;
begin
  select * into v_c from public.project_comments where id = p_comment;
  if not found or not (v_c.author_id = (select auth.uid()) or public.can_edit_showcase(v_c.project_id)) then
    raise exception 'التعليق غير موجود';
  end if;
  update public.project_comments set deleted_at = now() where id = p_comment;
end;
$$;

revoke execute on function public.delete_project_comment(uuid) from public, anon;
grant execute on function public.delete_project_comment(uuid) to authenticated;

create or replace function public.showcase_comments(p_project uuid)
returns table (
  id uuid, parent_id uuid, body_ar text, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_techmood_id text,
  is_owner boolean, can_delete boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.parent_id, c.body_ar, c.created_at,
         c.author_id, coalesce(pr.display_name, pr.full_name), pr.avatar_url, pr.techmood_id,
         c.author_id = p.owner_id,
         c.author_id = (select auth.uid()) or public.can_edit_showcase(c.project_id)
    from public.project_comments c
    join public.projects p on p.id = c.project_id
    join public.profiles pr on pr.id = c.author_id
   where c.project_id = p_project and c.deleted_at is null
     and (public.showcase_visible(p_project) or public.can_edit_showcase(p_project))
   order by c.created_at
   limit 300;
$$;

revoke execute on function public.showcase_comments(uuid) from public;
grant execute on function public.showcase_comments(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Who built it
-- ---------------------------------------------------------------------------
create or replace function public.showcase_people(p_project uuid)
returns table (profile_id uuid, full_name text, techmood_id text, avatar_url text, is_leader boolean, role_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  -- a team's work: every member, the leader first
  select pr.id, coalesce(pr.display_name, pr.full_name), pr.techmood_id, pr.avatar_url,
         pr.id = t.leader_id, tm.title_ar
    from public.projects p
    join public.teams t on t.id = p.team_id
    join public.team_members tm on tm.team_id = t.id
    join public.profiles pr on pr.id = tm.profile_id
   where p.id = p_project
     and (public.showcase_visible(p_project) or public.can_edit_showcase(p_project))
  union all
  -- one person's work: its owner, who leads it
  select pr.id, coalesce(pr.display_name, pr.full_name), pr.techmood_id, pr.avatar_url, true, null
    from public.projects p
    join public.profiles pr on pr.id = p.owner_id
   where p.id = p_project and p.team_id is null
     and (public.showcase_visible(p_project) or public.can_edit_showcase(p_project))
  order by 5 desc, 2;
$$;

revoke execute on function public.showcase_people(uuid) from public;
grant execute on function public.showcase_people(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. A service order's conversation — opened once the payment is confirmed
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column escrow_id uuid references public.escrows (id) on delete set null;

create unique index conversations_one_per_escrow on public.conversations (escrow_id) where escrow_id is not null;

-- 0092 refuses every money conversation; a funded service order is the one exception.
create or replace function public.refuse_money_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'market' and new.escrow_id is not null and exists (
       select 1 from public.escrows e
         join public.projects p on p.id = e.project_id
        where e.id = new.escrow_id and e.kind = 'project_sale' and e.status = 'funded'
          and p.product_type = 'digital_service') then
    return new;
  end if;
  if new.kind in ('mentor_booking', 'market') then
    raise exception 'no private conversations between two parties money passes between'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.service_order_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale  public.project_sales%rowtype;
  v_p     public.projects%rowtype;
  v_conv  uuid;
  v_buyer text;
begin
  if new.kind <> 'project_sale' or new.status is not distinct from old.status then
    return new;
  end if;

  -- Payment confirmed: open it.
  if new.status = 'funded' then
    select * into v_sale from public.project_sales where escrow_id = new.id;
    select * into v_p from public.projects where id = new.project_id;
    if v_sale.id is null or v_p.product_type is distinct from 'digital_service'
       or exists (select 1 from public.conversations c where c.escrow_id = new.id) then
      return new;
    end if;
    select coalesce(display_name, full_name) into v_buyer from public.profiles where id = v_sale.buyer_id;

    insert into public.conversations (kind, project_id, escrow_id, title_ar)
    values ('market', v_p.id, new.id, 'طلب خدمة: ' || v_p.title_ar || ' — ' || coalesce(v_buyer, 'مشترٍ'))
    returning id into v_conv;

    insert into public.conversation_participants (conversation_id, profile_id)
    select v_conv, x from unnest(array[v_sale.buyer_id, v_sale.seller_id]) x
    on conflict do nothing;
    -- a team's service: its leader joins too
    insert into public.conversation_participants (conversation_id, profile_id)
    select v_conv, t.leader_id from public.teams t where t.id = v_p.team_id
    on conflict do nothing;

    insert into public.messages (conversation_id, sender_id, body_ar, is_system)
    values (v_conv, null,
      'تأكد الدفع وفُتحت هذه المحادثة لتنفيذ الخدمة «' || v_p.title_ar || '». '
      || 'المبلغ محتجز لدى TechMood حتى يستلم المشتري الخدمة ويفرج عنه. '
      || 'لا روابط ولا وسائل تواصل خارجية هنا — والتسليم عبر صفحة المشتريات، ولأي مشكلة افتح تذكرة دعم.', true);

    perform public.notify(v_sale.buyer_id, 'message', 'فُتحت محادثة طلب الخدمة',
      'تواصل مع مقدّم الخدمة «' || v_p.title_ar || '».', '/messages?c=' || v_conv::text);
    perform public.notify(v_sale.seller_id, 'message', 'طلب خدمة مدفوع — ابدأ التنفيذ',
      'تأكد الدفع لـ«' || v_p.title_ar || '». المحادثة مفتوحة مع المشتري.', '/messages?c=' || v_conv::text);

  -- The order ended: the history stays, the writing stops.
  elsif new.status in ('released', 'refunded', 'cancelled') then
    select id into v_conv from public.conversations where escrow_id = new.id and not is_read_only;
    if v_conv is not null then
      insert into public.messages (conversation_id, sender_id, body_ar, is_system)
      values (v_conv, null,
        case new.status when 'released' then 'اكتمل الطلب وأُفرج عن المبلغ. أُغلقت المحادثة، والسجل محفوظ.'
             else 'أُلغي الطلب. أُغلقت المحادثة، والسجل محفوظ — ولأي مشكلة افتح تذكرة دعم.' end, true);
      update public.conversations set is_read_only = true where id = v_conv;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.service_order_conversation() from public, anon, authenticated;

create trigger escrows_service_conversation
  after update of status on public.escrows
  for each row execute function public.service_order_conversation();
