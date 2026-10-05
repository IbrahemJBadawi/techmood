-- =============================================================================
-- 0131 — The assistant's Gemini model: the current Flash
--
-- gemini-2.5-flash is no longer offered to new keys. `gemini-flash-latest`
-- always names Google's current Flash model, so the setting does not go stale.
-- An admin can still pin a specific model in platform_settings.
-- =============================================================================

update public.platform_settings set value = 'gemini-flash-latest' where key = 'ai_gemini_model';

create or replace function public.ai_gemini_config()
returns table (api_key text, model text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select (select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1),
         coalesce((select nullif(value, '') from public.platform_settings where key = 'ai_gemini_model'), 'gemini-flash-latest');
end;
$$;

revoke execute on function public.ai_gemini_config() from public, anon, authenticated;
grant execute on function public.ai_gemini_config() to service_role;
