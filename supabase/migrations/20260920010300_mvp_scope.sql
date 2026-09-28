-- =============================================================================
-- 0103 — The MVP's scope, as one switch
--
-- The founder narrowed TechMood's first release to: Academy, Mentors, Mentees,
-- Teams, Gallery, the Student Market (project sales), Wallet, Calendar,
-- Bookings, AI and the Admin dashboard — with three roles people sign up as:
-- student, mentor and mentee.
--
-- Out of the MVP, but NOT deleted: startups and the incubator, companies,
-- freelancers and clients, jobs and freelance openings, and the team-leader,
-- founder, company, freelancer and client roles. Their tables, functions and
-- tests stay exactly as they are, so bringing them back is one setting.
--
-- While `platform_settings.mvp_scope` is 'mvp':
--   * nothing new can be created in those systems (startups, openings,
--     applications to openings, incubator applications, freelancer profiles
--     and services, market-work escrows);
--   * nobody can be granted or ask for one of the hidden roles;
-- and the app hides their pages and links (src/lib/scope.ts). Set it to
-- 'full' and all of it works again.
--
-- Nothing is refused for rows that already exist — there are none in the live
-- database, and hiding is the app's job — so no data is touched.
-- =============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('mvp_scope', 'mvp', 'نطاق المنصة: mvp يُخفي الشركات الناشئة والشركات والفريلانس والوظائف؛ full يعيدها')
on conflict (key) do nothing;

create or replace function public.in_mvp()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.platform_settings where key = 'mvp_scope'), 'mvp') = 'mvp';
$$;

revoke execute on function public.in_mvp() from public, anon;
grant execute on function public.in_mvp() to authenticated;

-- The roles the MVP hides.
create or replace function public.is_mvp_hidden_role(p_role public.user_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_role in ('freelancer', 'client', 'team_leader', 'founder', 'company');
$$;

revoke execute on function public.is_mvp_hidden_role(public.user_role) from public, anon;
grant execute on function public.is_mvp_hidden_role(public.user_role) to authenticated;

create or replace function public.refuse_outside_mvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.in_mvp() then
    return new;
  end if;

  if tg_table_name = 'profile_roles' then
    if public.is_mvp_hidden_role(new.role)
       and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      raise exception 'هذا الدور غير متاح في TechMood حالياً' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_table_name = 'escrows' then
    if new.kind = 'market_work' then
      raise exception 'العمل عبر السوق غير متاح في TechMood حالياً' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  raise exception 'هذه الميزة غير متاحة في TechMood حالياً' using errcode = 'check_violation';
end;
$$;

revoke execute on function public.refuse_outside_mvp() from public, anon, authenticated;

create trigger startups_mvp_scope             before insert on public.startups
  for each row execute function public.refuse_outside_mvp();
create trigger opportunities_mvp_scope        before insert on public.opportunities
  for each row execute function public.refuse_outside_mvp();
create trigger opportunity_applications_mvp_scope before insert on public.opportunity_applications
  for each row execute function public.refuse_outside_mvp();
create trigger incubator_applications_mvp_scope before insert on public.incubator_applications
  for each row execute function public.refuse_outside_mvp();
create trigger freelancer_profiles_mvp_scope  before insert on public.freelancer_profiles
  for each row execute function public.refuse_outside_mvp();
create trigger freelancer_services_mvp_scope  before insert on public.freelancer_services
  for each row execute function public.refuse_outside_mvp();
create trigger escrows_mvp_scope              before insert on public.escrows
  for each row execute function public.refuse_outside_mvp();
create trigger profile_roles_mvp_scope        before insert or update of role, status on public.profile_roles
  for each row execute function public.refuse_outside_mvp();
