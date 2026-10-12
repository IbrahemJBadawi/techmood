-- ============================================================================
-- 0165 — TechMood Business: opened area by area, for Premium (design lab 5)
--
-- 1. One switch per area instead of the single MVP switch (0103): jobs,
--    freelance and business open now; the Startup Studio and the market's
--    held payments (escrow) stay closed until they are tested.
-- 2. Roles at sign-up: freelancer opens at once, like client and mentee (it
--    is listed in the talent directory only when it has a summary and a
--    service); a company is reviewed by an admin — that review is the
--    business's verification.
-- 3. Business is for Premium: publishing a job or a freelance project, and
--    owning a business page, need an active Premium membership. Browsing and
--    applying stay open to every member.
-- 4. Business pages, for one person or for a team, the same shape: a name,
--    a line, what they do, their links — with their services, projects and
--    openings gathered from what already exists. Members only, not public.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. An area switch each
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('area_jobs', 'on', 'الوظائف في السوق (on/off).'),
  ('area_freelance', 'on', 'العمل الحر: ملفات المستقلين وخدماتهم ومشاريع العمل الحر (on/off).'),
  ('area_business', 'on', 'صفحات الأعمال ودور الشركات والعملاء (on/off).'),
  ('area_studio', 'off', 'Startup Studio والحاضنة (on/off).')
on conflict (key) do nothing;

create or replace function public.area_open(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.platform_settings where key = 'area_' || p_area), 'off') = 'on';
$$;

revoke execute on function public.area_open(text) from public;
grant execute on function public.area_open(text) to anon, authenticated;

create or replace function public.refuse_outside_mvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text;
begin
  if not public.in_mvp() then
    return new;
  end if;

  if tg_table_name = 'profile_roles' then
    if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.role = old.role then
      return new;
    end if;
    v_area := case new.role
      when 'freelancer' then 'freelance'
      when 'company' then 'business'
      when 'client' then 'business'
      when 'founder' then 'studio'
      when 'team_leader' then 'never'
      else null end;
    if v_area is not null and not public.area_open(v_area) then
      raise exception 'هذا الدور غير متاح في TechMood حالياً' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_table_name = 'escrows' then
    if new.kind = 'market_work' then
      raise exception 'الدفع المحتجز للعمل عبر السوق غير متاح بعد' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- each table on its own branch: `new` has a different shape in each
  if tg_table_name = 'opportunities' then
    v_area := case when new.kind::text = 'freelance' then 'freelance' else 'jobs' end;
  elsif tg_table_name = 'opportunity_applications' then
    select case when o.kind::text = 'freelance' then 'freelance' else 'jobs' end into v_area
      from public.opportunities o where o.id = new.opportunity_id;
  elsif tg_table_name in ('freelancer_profiles', 'freelancer_services') then
    v_area := 'freelance';
  elsif tg_table_name in ('startups', 'incubator_applications') then
    v_area := 'studio';
  else
    v_area := 'never';
  end if;
  if not public.area_open(coalesce(v_area, 'never')) then
    raise exception 'هذه الميزة غير متاحة في TechMood حالياً' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A freelancer opens at once
-- ---------------------------------------------------------------------------
do $rewrite$
declare
  v_def text;
begin
  select pg_get_functiondef('public.apply_for_role(public.user_role, text, text)'::regprocedure) into v_def;
  v_def := replace(v_def, 'p_role in (''mentee'', ''client'')', 'p_role in (''mentee'', ''client'', ''freelancer'')');
  if position('''freelancer'')' in v_def) = 0 then
    raise exception 'apply_for_role did not have the expected shape';
  end if;
  execute v_def;
end
$rewrite$;

-- ---------------------------------------------------------------------------
-- 3. Publishing is for Premium
-- ---------------------------------------------------------------------------
create or replace function public.can_post_opportunity(
  p_kind public.opportunity_kind,
  p_team uuid default null,
  p_startup uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or case
    when p_startup is not null then public.can_manage_startup(p_startup)
    when p_kind = 'team_seat' then p_team is not null and public.is_team_leader(p_team)
    else public.is_premium((select auth.uid())) and (
           public.has_role('company') or public.has_role('client') or public.has_role('freelancer')
        or public.has_role('founder') or public.has_role('mentor')
        or (p_team is not null and public.is_team_leader(p_team)))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Business pages
-- ---------------------------------------------------------------------------
create table public.business_pages (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) between 3 and 40),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  team_id      uuid unique references public.teams (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 80),
  tagline      text check (tagline is null or char_length(tagline) <= 140),
  about        text check (about is null or char_length(about) <= 3000),
  sector       text check (sector is null or char_length(sector) <= 60),
  city         text check (city is null or char_length(city) <= 60),
  website_url  text check (website_url is null or website_url ~ '^https?://'),
  contact_note text check (contact_note is null or char_length(contact_note) <= 300),
  logo_url     text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index business_pages_owner_idx on public.business_pages (owner_id);
create unique index business_pages_one_personal on public.business_pages (owner_id) where team_id is null;

create trigger business_pages_touch before update on public.business_pages
  for each row execute function public.touch_updated_at();

alter table public.business_pages enable row level security;
-- members only (decision 4): never anon
create policy business_pages_read on public.business_pages for select to authenticated
  using (is_published or owner_id = (select auth.uid()) or public.is_admin());
revoke all on public.business_pages from anon, authenticated;
grant select on public.business_pages to authenticated;

create or replace function public.save_business_page(
  p_slug text, p_name text, p_tagline text, p_about text, p_sector text, p_city text,
  p_website text, p_contact text, p_team uuid default null, p_published boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_id   uuid;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if v_me is null then
    raise exception 'سجّل الدخول أولاً';
  end if;
  if not public.area_open('business') then
    raise exception 'صفحات الأعمال غير متاحة حالياً';
  end if;
  if not public.is_premium(v_me) and not public.is_admin() then
    raise exception 'صفحة الأعمال لمشتركي Premium';
  end if;
  if p_team is not null and not public.is_team_leader(p_team) then
    raise exception 'صفحة الفريق ينشئها قائده';
  end if;

  select bp.id into v_id from public.business_pages bp
   where bp.owner_id = v_me and bp.team_id is not distinct from p_team;

  if v_id is null then
    insert into public.business_pages (slug, owner_id, team_id, name, tagline, about, sector, city, website_url, contact_note, is_published)
    values (v_slug, v_me, p_team, btrim(p_name), nullif(btrim(p_tagline), ''), nullif(btrim(p_about), ''),
            nullif(btrim(p_sector), ''), nullif(btrim(p_city), ''), nullif(btrim(p_website), ''),
            nullif(btrim(p_contact), ''), coalesce(p_published, true))
    returning id into v_id;
  else
    update public.business_pages
       set slug = v_slug, name = btrim(p_name), tagline = nullif(btrim(p_tagline), ''),
           about = nullif(btrim(p_about), ''), sector = nullif(btrim(p_sector), ''),
           city = nullif(btrim(p_city), ''), website_url = nullif(btrim(p_website), ''),
           contact_note = nullif(btrim(p_contact), ''), is_published = coalesce(p_published, true)
     where id = v_id;
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'هذا الرابط مستخدم — اختر رابطاً آخر';
end;
$$;

revoke execute on function public.save_business_page(text, text, text, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.save_business_page(text, text, text, text, text, text, text, text, uuid, boolean) to authenticated;

-- What stands between this member and publishing — for the screen to say so.
create or replace function public.business_access()
returns table (premium boolean, can_publish boolean, company_status text, freelancer boolean, page_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_premium((select auth.uid())),
         public.can_post_opportunity('job'),
         (select pr.status::text from public.profile_roles pr where pr.profile_id = (select auth.uid()) and pr.role = 'company'),
         public.has_role('freelancer'),
         (select bp.slug from public.business_pages bp where bp.owner_id = (select auth.uid()) and bp.team_id is null limit 1);
$$;

revoke execute on function public.business_access() from public, anon;
grant execute on function public.business_access() to authenticated;

-- The hub's directory: pages with the counts that make them worth opening.
create or replace function public.business_directory(p_search text default null, p_limit integer default 40)
returns table (id uuid, slug text, name text, tagline text, sector text, city text, owner_id uuid, team_id uuid,
               services integer, projects integer, openings integer, verified boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select bp.id, bp.slug, bp.name, bp.tagline, bp.sector, bp.city, bp.owner_id, bp.team_id,
         (select count(*) from public.freelancer_services fs where fs.profile_id = bp.owner_id and bp.team_id is null)::integer,
         (select count(*) from public.projects p
           where (bp.team_id is not null and p.team_id = bp.team_id)
              or (bp.team_id is null and p.owner_id = bp.owner_id))::integer,
         (select count(*) from public.opportunities o
           where o.status = 'published' and o.posted_by = bp.owner_id
             and (bp.team_id is null or o.team_id = bp.team_id))::integer,
         exists (select 1 from public.verified_members v where v.profile_id = bp.owner_id)
    from public.business_pages bp
   where (select auth.uid()) is not null
     and bp.is_published
     and (p_search is null or bp.name ilike '%' || p_search || '%' or bp.tagline ilike '%' || p_search || '%'
          or bp.sector ilike '%' || p_search || '%')
   order by bp.updated_at desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke execute on function public.business_directory(text, integer) from public, anon;
grant execute on function public.business_directory(text, integer) to authenticated;
