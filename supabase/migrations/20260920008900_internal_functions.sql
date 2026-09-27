-- =============================================================================
-- 0089 — Three internal functions stay internal
--
-- 0016 says setting_int() and expire_stale_bookings() "stay ungranted", and
-- 0035 revoked is_goal_step_open() from public and anon — but a signed-in user
-- could still call all three: the first two through Postgres' PUBLIC default,
-- the third through Supabase's default grant to `authenticated`. They are read
-- by the platform's own functions (which run as their owner) and by the
-- scheduler, never by a client.
-- =============================================================================
revoke execute on function public.setting_int(text)            from public, anon, authenticated;
revoke execute on function public.expire_stale_bookings()       from public, anon, authenticated;
revoke execute on function public.is_goal_step_open(uuid)       from public, anon, authenticated;
