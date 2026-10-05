-- =============================================================================
-- 0129 — The welcome guide, once per member
--
-- A new member sees a short guide to TechMood on their first visit home. It
-- is remembered on the account (not the browser), so it is not shown again on
-- another device; it can be replayed from the home page.
-- =============================================================================

alter table public.profiles
  add column welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'When the member finished or skipped the welcome guide (0129).';

-- Everyone already here has found their way around.
update public.profiles set welcomed_at = now() where onboarding_completed_at is not null;

create or replace function public.mark_welcomed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set welcomed_at = coalesce(welcomed_at, now()) where id = (select auth.uid());
$$;

revoke execute on function public.mark_welcomed() from public, anon;
grant execute on function public.mark_welcomed() to authenticated;
