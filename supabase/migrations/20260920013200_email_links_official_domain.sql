-- =============================================================================
-- 0132 — Email links fall back to the official domain
--
-- Links in TechMood's emails are built from the `site_url` setting
-- (https://techmoodtech.com since 0130). Should that setting ever be emptied,
-- the fallback was still the old techmoodtech.vercel.app address; it is now
-- the official one.
-- =============================================================================

create or replace function public.email_config()
returns table (api_key text, from_address text, site_url text, dispatch_secret text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regnamespace('vault') is null then
    return query select null::text, null::text, null::text, null::text;
    return;
  end if;
  return query
  select (select decrypted_secret from vault.decrypted_secrets where name = 'email_api_key' limit 1),
         (select nullif(value, '') from public.platform_settings where key = 'email_from'),
         coalesce((select nullif(value, '') from public.platform_settings where key = 'site_url'),
                  'https://techmoodtech.com'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_secret' limit 1);
end;
$$;

revoke execute on function public.email_config() from public, anon, authenticated;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_config() to service_role;
  end if;
end
$grants$;
