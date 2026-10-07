-- ============================================================================
-- 0150 — three pages that were «قريباً» (design lab 4)
--
--   * For business: a landing page and a contact form. A company leaves its
--     name, a way back to it and what it needs; the admins are told at once.
--     A visitor may send one, signed in or not, at most three a day per email.
--   * The blog, as a magazine: the admins write posts (a lead story and the
--     rest under it); anyone reads the published ones.
--   * Workshops, with a live stream: an admin or an approved mentor announces
--     one with its time, length, seats and stream link; members register; the
--     stream link is given only to the people registered, the host and the
--     admins; registrants are reminded half an hour before it starts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. For business
-- ---------------------------------------------------------------------------
create table public.business_inquiries (
  id           uuid primary key default extensions.gen_random_uuid(),
  company      text not null check (char_length(btrim(company)) between 2 and 120),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  phone        text check (phone is null or char_length(phone) <= 40),
  need         text not null check (need in ('hire', 'project', 'training', 'sponsor', 'other')),
  message      text not null check (char_length(btrim(message)) between 10 and 3000),
  profile_id   uuid references public.profiles (id) on delete set null,
  status       text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at   timestamptz not null default now(),
  handled_at   timestamptz,
  handled_by   uuid references public.profiles (id) on delete set null
);

create index business_inquiries_new_idx on public.business_inquiries (status, created_at desc);

alter table public.business_inquiries enable row level security;
create policy business_inquiries_admin on public.business_inquiries
  for select to authenticated using (public.is_admin());
revoke all on public.business_inquiries from anon, authenticated;
grant select on public.business_inquiries to authenticated;

create or replace function public.submit_business_inquiry(
  p_company text, p_contact_name text, p_email text, p_phone text, p_need text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.business_inquiries
       where lower(email) = lower(btrim(p_email)) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'وصلتنا رسائلك اليوم — سنرد عليك قريباً';
  end if;

  insert into public.business_inquiries (company, contact_name, email, phone, need, message, profile_id)
  values (btrim(p_company), btrim(p_contact_name), lower(btrim(p_email)), nullif(btrim(p_phone), ''),
          p_need, btrim(p_message), (select auth.uid()))
  returning id into v_id;

  perform public.notify_admins('🏢 طلب من شركة: ' || btrim(p_company),
    left(btrim(p_message), 160), '/admin/business', 'business_inquiry', v_id, 'important');
  return v_id;
exception when check_violation then
  raise exception 'تحقق من الحقول: الاسم، البريد، ونص الطلب (10 أحرف على الأقل)';
end;
$$;

revoke execute on function public.submit_business_inquiry(text, text, text, text, text, text) from public;
grant execute on function public.submit_business_inquiry(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.set_business_inquiry_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  update public.business_inquiries
     set status = p_status, handled_at = now(), handled_by = (select auth.uid())
   where id = p_id;
end;
$$;

revoke execute on function public.set_business_inquiry_status(uuid, text) from public, anon;
grant execute on function public.set_business_inquiry_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The blog
-- ---------------------------------------------------------------------------
create table public.blog_posts (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title        text not null check (char_length(btrim(title)) between 3 and 160),
  excerpt      text check (excerpt is null or char_length(excerpt) <= 300),
  body         text not null check (char_length(body) between 1 and 40000),
  cover_url    text check (cover_url is null or cover_url ~* '^https://'),
  category     text not null default 'news' check (category in ('news', 'stories', 'guides', 'careers')),
  author_id    uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index blog_posts_published_idx on public.blog_posts (published_at desc) where published_at is not null;

alter table public.blog_posts enable row level security;
create policy blog_posts_read on public.blog_posts
  for select to anon, authenticated
  using ((published_at is not null and published_at <= now()) or public.is_admin());
revoke all on public.blog_posts from anon, authenticated;
grant select on public.blog_posts to anon, authenticated;

create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();

create or replace function public.save_blog_post(
  p_id uuid, p_slug text, p_title text, p_excerpt text, p_body text, p_cover_url text,
  p_category text, p_publish boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  if v_id is null then
    insert into public.blog_posts (slug, title, excerpt, body, cover_url, category, author_id, published_at)
    values (lower(btrim(p_slug)), btrim(p_title), nullif(btrim(p_excerpt), ''), p_body, nullif(btrim(p_cover_url), ''),
            coalesce(p_category, 'news'), (select auth.uid()), case when p_publish then now() end)
    returning id into v_id;
  else
    update public.blog_posts
       set slug = lower(btrim(p_slug)), title = btrim(p_title), excerpt = nullif(btrim(p_excerpt), ''),
           body = p_body, cover_url = nullif(btrim(p_cover_url), ''), category = coalesce(p_category, 'news'),
           published_at = case when p_publish then coalesce(published_at, now()) end
     where id = v_id;
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'هذا الرابط مستخدم لمقال آخر';
  when check_violation then raise exception 'تحقق من الرابط (أحرف إنجليزية صغيرة وأرقام وشرطات) والعنوان والنص';
end;
$$;

revoke execute on function public.save_blog_post(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_blog_post(uuid, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.delete_blog_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  delete from public.blog_posts where id = p_id;
end;
$$;

revoke execute on function public.delete_blog_post(uuid) from public, anon;
grant execute on function public.delete_blog_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Workshops
-- ---------------------------------------------------------------------------
create table public.workshops (
  id               uuid primary key default extensions.gen_random_uuid(),
  title            text not null check (char_length(btrim(title)) between 3 and 140),
  description      text not null check (char_length(btrim(description)) between 10 and 4000),
  host_id          uuid not null references public.profiles (id) on delete cascade,
  starts_at        timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  capacity         integer check (capacity is null or capacity between 1 and 5000),
  live_url         text check (live_url is null or live_url ~* '^https://'),
  recording_url    text check (recording_url is null or recording_url ~* '^https://'),
  status           text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at       timestamptz not null default now()
);

create index workshops_starts_idx on public.workshops (starts_at);

alter table public.workshops enable row level security;
create policy workshops_read on public.workshops for select to authenticated using (true);
-- every column but the stream link, which `workshop_detail()` hands out; the
-- table-wide grant Supabase gives every new table goes first, or it would win
revoke all on public.workshops from anon, authenticated;
grant select (id, title, description, host_id, starts_at, duration_minutes, capacity, recording_url, status, created_at)
  on public.workshops to authenticated;

create table public.workshop_registrations (
  workshop_id   uuid not null references public.workshops (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  registered_at timestamptz not null default now(),
  reminded_at   timestamptz,
  primary key (workshop_id, profile_id)
);

create index workshop_registrations_profile_idx on public.workshop_registrations (profile_id);

alter table public.workshop_registrations enable row level security;
create policy workshop_registrations_own on public.workshop_registrations
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.workshop_registrations from anon, authenticated;
grant select on public.workshop_registrations to authenticated;

-- Who may announce one: the admins and approved mentors.
create or replace function public.can_host_workshop()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.profile_roles pr
     where pr.profile_id = (select auth.uid()) and pr.role = 'mentor' and pr.status = 'approved');
$$;

revoke execute on function public.can_host_workshop() from public, anon;
grant execute on function public.can_host_workshop() to authenticated;

create or replace function public.save_workshop(
  p_id uuid, p_title text, p_description text, p_starts_at timestamptz, p_duration integer,
  p_capacity integer, p_live_url text, p_recording_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid := p_id;
begin
  if not public.can_host_workshop() then
    raise exception 'الإدارة والمنتورز المعتمدون فقط يعلنون ورشة';
  end if;
  if v_id is null and p_starts_at <= now() then
    raise exception 'موعد الورشة في المستقبل';
  end if;
  if v_id is null then
    insert into public.workshops (title, description, host_id, starts_at, duration_minutes, capacity, live_url, recording_url)
    values (btrim(p_title), btrim(p_description), v_me, p_starts_at, p_duration, p_capacity,
            nullif(btrim(p_live_url), ''), nullif(btrim(p_recording_url), ''))
    returning id into v_id;
  else
    update public.workshops
       set title = btrim(p_title), description = btrim(p_description), starts_at = p_starts_at,
           duration_minutes = p_duration, capacity = p_capacity,
           live_url = nullif(btrim(p_live_url), ''), recording_url = nullif(btrim(p_recording_url), '')
     where id = v_id and (host_id = v_me or public.is_admin());
    if not found then
      raise exception 'صاحب الورشة أو الإدارة فقط';
    end if;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'تحقق من الحقول: العنوان، الوصف (10 أحرف على الأقل)، المدة 15–480 دقيقة، والروابط تبدأ بـ https';
end;
$$;

revoke execute on function public.save_workshop(uuid, text, text, timestamptz, integer, integer, text, text) from public, anon;
grant execute on function public.save_workshop(uuid, text, text, timestamptz, integer, integer, text, text) to authenticated;

create or replace function public.cancel_workshop(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w public.workshops%rowtype;
  v_p uuid;
begin
  select * into v_w from public.workshops where id = p_id for update;
  if not found or (v_w.host_id <> (select auth.uid()) and not public.is_admin()) then
    raise exception 'صاحب الورشة أو الإدارة فقط';
  end if;
  update public.workshops set status = 'cancelled' where id = p_id;
  for v_p in select profile_id from public.workshop_registrations where workshop_id = p_id loop
    perform public.notify(v_p, 'academy', 'أُلغيت ورشة: ' || v_w.title,
      'نعتذر — أُلغيت الورشة التي سجّلت فيها.', '/workshops/' || p_id::text, 'workshop', p_id);
  end loop;
end;
$$;

revoke execute on function public.cancel_workshop(uuid) from public, anon;
grant execute on function public.cancel_workshop(uuid) to authenticated;

-- Registering, and changing one's mind.
create or replace function public.register_workshop(p_id uuid, p_register boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_w  public.workshops%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  select * into v_w from public.workshops where id = p_id for update;
  if not found or v_w.status <> 'scheduled' then
    raise exception 'الورشة غير متاحة';
  end if;
  if not coalesce(p_register, true) then
    delete from public.workshop_registrations where workshop_id = p_id and profile_id = v_me;
    return;
  end if;
  if v_w.starts_at + make_interval(mins => v_w.duration_minutes) < now() then
    raise exception 'انتهت الورشة';
  end if;
  if v_w.capacity is not null
     and (select count(*) from public.workshop_registrations where workshop_id = p_id) >= v_w.capacity then
    raise exception 'اكتملت المقاعد';
  end if;
  insert into public.workshop_registrations (workshop_id, profile_id) values (p_id, v_me)
  on conflict do nothing;
end;
$$;

revoke execute on function public.register_workshop(uuid, boolean) from public, anon;
grant execute on function public.register_workshop(uuid, boolean) to authenticated;

-- The list: upcoming and live first, with seats taken and whether I am in.
create or replace function public.workshop_list(p_past boolean default false)
returns table (
  id uuid, title text, description text, starts_at timestamptz, duration_minutes integer,
  capacity integer, registered integer, is_registered boolean, is_live boolean, status text,
  host_id uuid, host_name text, host_avatar text, has_recording boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.title, w.description, w.starts_at, w.duration_minutes, w.capacity,
         (select count(*)::int from public.workshop_registrations r where r.workshop_id = w.id),
         exists (select 1 from public.workshop_registrations r where r.workshop_id = w.id and r.profile_id = (select auth.uid())),
         w.status = 'scheduled' and now() between w.starts_at - interval '10 minutes'
                                              and w.starts_at + make_interval(mins => w.duration_minutes),
         w.status, w.host_id, p.full_name, p.avatar_url, w.recording_url is not null
    from public.workshops w
    join public.profiles p on p.id = w.host_id
   where (select auth.uid()) is not null
     and case when coalesce(p_past, false)
              then w.starts_at + make_interval(mins => w.duration_minutes) < now()
              else w.starts_at + make_interval(mins => w.duration_minutes) >= now() end
   order by case when coalesce(p_past, false) then null else w.starts_at end asc,
            w.starts_at desc
   limit 60;
$$;

revoke execute on function public.workshop_list(boolean) from public, anon;
grant execute on function public.workshop_list(boolean) to authenticated;

-- One workshop; the stream link only for who may watch it.
create or replace function public.workshop_detail(p_id uuid)
returns table (
  id uuid, title text, description text, starts_at timestamptz, duration_minutes integer,
  capacity integer, registered integer, is_registered boolean, is_live boolean, status text,
  host_id uuid, host_name text, host_avatar text, can_edit boolean, live_url text, recording_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  w as (
    select w.*,
           exists (select 1 from public.workshop_registrations r, me
                    where r.workshop_id = w.id and r.profile_id = me.uid) as mine,
           (w.host_id = (select uid from me) or public.is_admin()) as editor
      from public.workshops w where w.id = p_id
  )
  select w.id, w.title, w.description, w.starts_at, w.duration_minutes, w.capacity,
         (select count(*)::int from public.workshop_registrations r where r.workshop_id = w.id),
         w.mine,
         w.status = 'scheduled' and now() between w.starts_at - interval '10 minutes'
                                              and w.starts_at + make_interval(mins => w.duration_minutes),
         w.status, w.host_id, p.full_name, p.avatar_url, w.editor,
         case when w.mine or w.editor then w.live_url end,
         w.recording_url
    from w join public.profiles p on p.id = w.host_id
   where (select uid from me) is not null;
$$;

revoke execute on function public.workshop_detail(uuid) from public, anon;
grant execute on function public.workshop_detail(uuid) to authenticated;

-- Half an hour before it starts, each registrant hears once.
create or replace function public.workshop_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_sent integer := 0;
begin
  for v_row in
    select r.workshop_id, r.profile_id, w.title
      from public.workshop_registrations r
      join public.workshops w on w.id = r.workshop_id
     where r.reminded_at is null and w.status = 'scheduled'
       and w.starts_at between now() and now() + interval '30 minutes'
     for update of r skip locked
  loop
    perform public.notify(v_row.profile_id, 'academy', '🔴 تبدأ ورشة «' || v_row.title || '» خلال نصف ساعة',
      'افتح الورشة لتشاهد البث المباشر حين يبدأ.', '/workshops/' || v_row.workshop_id::text,
      'workshop', v_row.workshop_id, 'important');
    update public.workshop_registrations set reminded_at = now()
     where workshop_id = v_row.workshop_id and profile_id = v_row.profile_id;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.workshop_reminders() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-workshop-reminders', '*/5 * * * *', $$select public.workshop_reminders()$$);
  end if;
end
$migration$;
