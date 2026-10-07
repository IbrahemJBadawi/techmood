-- ============================================================================
-- 0148 — the admins hear about new members (design lab 4: «دمج»)
--
-- Three together, as the founder chose:
--   * one in-platform notification for each person who joins, as it happens;
--   * a morning digest of yesterday's joiners, counted by role;
--   * both reach the admin's phone through the push channel 0100 already runs,
--     because the category defaults push on — each admin can turn either
--     channel off in Settings → Notifications like any other category.
--
-- The category is the admins' only: `admin_only` keeps it off a member's
-- settings page, and nothing writes it for anyone who is not an admin.
-- ============================================================================

alter table public.notification_categories
  add column if not exists admin_only boolean not null default false;

insert into public.notification_categories
  (kind, title_ar, detail_ar, in_app_default, email_default, push_default, is_mandatory, sort_order, admin_only)
values ('new_members', 'أعضاء جدد (للإدارة)',
        'تنبيه لكل عضو ينضم، وملخص صباحي بمن انضموا أمس.',
        true, false, true, false, 14, true)
on conflict (kind) do update set admin_only = true;

-- The approved admins, for the two writers below.
create or replace function public.admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pr.profile_id from public.profile_roles pr
   where pr.role = 'admin' and pr.status = 'approved';
$$;

revoke execute on function public.admin_ids() from public, anon, authenticated;

-- Each new member, as they join.
create or replace function public.notify_admins_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  for v_admin in select public.admin_ids() loop
    if v_admin <> new.id then
      perform public.notify(
        v_admin, 'new_members',
        '👋 عضو جديد: ' || coalesce(nullif(btrim(new.full_name), ''), 'بدون اسم'),
        'انضم الآن إلى TechMood. افتح ملفه لترى ما اختار في الإعداد.',
        '/admin/users/' || new.id::text, 'profile', new.id, 'normal');
    end if;
  end loop;
  return new;
exception when others then
  -- an alert that fails never stops somebody from joining
  raise warning 'new-member alert failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_admins_new_member() from public, anon, authenticated;

drop trigger if exists profiles_notify_admins on public.profiles;
create trigger profiles_notify_admins after insert on public.profiles
  for each row execute function public.notify_admins_new_member();

-- Yesterday's joiners, in one line, every morning; nothing on a day nobody joined.
create or replace function public.admin_new_members_digest()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from    timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem' - interval '1 day';
  v_to      timestamptz := v_from + interval '1 day';
  v_total   integer;
  v_done    integer;
  v_mentors integer;
  v_admin   uuid;
  v_sent    integer := 0;
begin
  select count(*)::int,
         count(*) filter (where p.onboarding_completed_at is not null)::int,
         count(*) filter (where exists (select 1 from public.profile_roles pr
                                         where pr.profile_id = p.id and pr.role = 'mentor'))::int
    into v_total, v_done, v_mentors
    from public.profiles p
   where p.created_at >= v_from and p.created_at < v_to;

  if v_total = 0 then
    return 0;
  end if;

  for v_admin in select public.admin_ids() loop
    perform public.notify(
      v_admin, 'new_members',
      '📈 انضم أمس ' || v_total || case when v_total = 1 then ' عضو' else ' أعضاء' end,
      'أكمل الإعداد ' || v_done || ' منهم'
        || case when v_mentors > 0 then '، وطلب ' || v_mentors || ' دور منتور' else '' end || '.',
      '/admin/users', null, null, 'normal',
      jsonb_build_object('digest_day', (v_from at time zone 'Asia/Jerusalem')::date));
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

revoke execute on function public.admin_new_members_digest() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    -- 09:10 in Palestine, just after the members' own morning digest
    perform cron.schedule('techmood-admin-members-digest', '10 6 * * *', $$select public.admin_new_members_digest()$$);
  end if;
end
$migration$;
