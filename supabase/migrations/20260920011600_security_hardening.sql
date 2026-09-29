-- =============================================================================
-- 0116 — Security hardening before launch
--
-- Found in the pre-launch review (Supabase security advisors + a read of every
-- SECURITY DEFINER function a client can call):
--
--   1. roadmap(p_startup) returned any company's roadmap items, SMART goals
--      and projects to anyone who called it — signed out included — because a
--      SECURITY DEFINER function skips the table's own read rule
--      (roadmap_items_read). It now applies that same rule: the company's own
--      people, its mentors, or a company that chose to be public.
--
--   2. Internal helpers that only other database functions call were still
--      callable through the API (/rest/v1/rpc/...):
--        award_team_xp            — any signed-in person could give any team XP
--        sync_path_status         — flips a path between open / coming soon
--        ensure_path_conversation — creates a path's group conversation
--        is_restricted            — said whether a given person is restricted
--        wants_notification       — read another person's notification choices
--        payment_purpose          — the category of a given payment
--      None is called by the app (src/) or used inside an RLS policy, so
--      closing them changes nothing a person does; the functions that use
--      them run as their owner and keep working.
--
--   3. Supabase gives the anon role INSERT/UPDATE/DELETE/TRUNCATE on every new
--      table by default. RLS already refuses every write by a signed-out
--      visitor (no write policy names anon or public), but the grants are
--      removed as a second lock, TRUNCATE (which RLS does not cover) is
--      removed from signed-in users too, and future tables start without them.
--
--   4. Four private storage buckets had no size limit, and the project-payment
--      receipt allowed PDF in the form while its bucket refused it.
--
--   5. The assistant had no daily limit: once ANTHROPIC_API_KEY is set, one
--      account could send thousands of questions and run up the bill. Each
--      person now has a daily number of questions (platform setting
--      ai_daily_messages, 40 to start); admins are not limited.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The roadmap follows the roadmap's read rule
-- ---------------------------------------------------------------------------
create or replace function public.roadmap(p_startup uuid)
returns table (
  source     text,
  item_id    uuid,
  title_ar   text,
  detail_ar  text,
  year       integer,
  quarter    integer,
  state      text,
  link       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    -- the same rule as the roadmap_items_read policy (0063)
    select public.can_view_startup_workspace(p_startup)
        or public.is_startup_mentor(p_startup)
        or exists (select 1 from public.startups s where s.id = p_startup and s.is_public) as ok
  )
  select * from (
    select 'item'::text, r.id, r.title_ar, r.detail_ar, r.year, r.quarter, r.status::text,
           case when r.project_id is not null then '/projects/' || r.project_id::text else null end
      from public.roadmap_items r
     where r.startup_id = p_startup

    union all

    select 'goal', g.id, g.title_ar, g.metric_label_ar,
           extract(year from g.due_on)::int,
           extract(quarter from g.due_on)::int,
           g.status::text,
           null
      from public.smart_goals g
     where g.startup_id = p_startup

    union all

    select 'project', pj.id, pj.title_ar, pj.description_ar,
           extract(year from pj.created_at)::int,
           extract(quarter from pj.created_at)::int,
           pj.status::text,
           '/projects/' || pj.id::text
      from public.projects pj
     where pj.startup_id = p_startup
  ) timeline
  where (select ok from allowed)
  order by 5, 6, 1;
$$;

comment on function public.roadmap is
  'The company''s quarters: what it intends, what it measured itself against, and what it is building. Only for those who may read the company''s roadmap (0116).';

-- ---------------------------------------------------------------------------
-- 2. Internal helpers are not part of the API
-- ---------------------------------------------------------------------------
revoke execute on function public.award_team_xp(uuid, public.team_xp_source, text, uuid, smallint) from public, anon, authenticated;
revoke execute on function public.sync_path_status(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_path_conversation(uuid) from public, anon, authenticated;
revoke execute on function public.is_restricted(uuid, public.restricted_feature) from public, anon, authenticated;
revoke execute on function public.wants_notification(uuid, public.notification_kind, text) from public, anon, authenticated;
revoke execute on function public.payment_purpose(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. No table writes for signed-out visitors, no TRUNCATE for anyone
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Tables created by later migrations start the same way.
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Every storage bucket has a size limit, and the proof buckets a type list
-- ---------------------------------------------------------------------------
-- The app already checks sizes before uploading; these are the limits the
-- storage server itself enforces, so a hand-made request cannot go around them.
--   payment-proofs  PNG/JPG and now PDF: the project-payment receipt
--                   (projects/[projectId]/Money.tsx) accepts PDF, and the
--                   bucket used to refuse it.
--   payout-proofs   the admin's transfer receipt: PNG/JPG/PDF, 10 MB.
--   support-files   what a person attaches to a ticket: images and PDF, 10 MB.
--   brief-files,
--   project-files   work files of any type (WorkFileUpload), 20 MB.
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'application/pdf']
 where id = 'payment-proofs';
update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'application/pdf']
 where id = 'payout-proofs';
update storage.buckets set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
 where id = 'support-files';
update storage.buckets set file_size_limit = 20971520 where id in ('brief-files', 'project-files');

-- ---------------------------------------------------------------------------
-- 5. A daily limit on questions to the assistant
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar)
values ('ai_daily_messages', '40',
        'كم سؤالاً يرسل الشخص الواحد للمساعد الذكي في اليوم (بتوقيت فلسطين). الإدارة غير محدودة.')
on conflict (key) do nothing;

-- On the table itself, so it holds whether the question arrives through
-- ai_say() or a direct insert. Only the person's own questions count; the
-- assistant's answers and errors do not.
create or replace function public.ai_daily_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_used  integer;
begin
  if new.role <> 'user' then
    return new;
  end if;
  select profile_id into v_owner from public.ai_threads where id = new.thread_id;
  if v_owner is null or public.is_admin() then
    return new;
  end if;

  select coalesce(nullif(value, '')::integer, 40) into v_limit
    from public.platform_settings where key = 'ai_daily_messages';
  v_limit := coalesce(v_limit, 40);

  select count(*) into v_used
    from public.ai_messages m
    join public.ai_threads t on t.id = m.thread_id
   where t.profile_id = v_owner
     and m.role = 'user'
     and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem');

  if v_used >= v_limit then
    raise exception 'بلغت حدّ أسئلة المساعد لهذا اليوم (%). يتجدد غداً.', v_limit;
  end if;
  return new;
end;
$$;

revoke execute on function public.ai_daily_cap() from public, anon, authenticated;

drop trigger if exists ai_messages_daily_cap on public.ai_messages;
create trigger ai_messages_daily_cap
  before insert on public.ai_messages
  for each row execute function public.ai_daily_cap();
