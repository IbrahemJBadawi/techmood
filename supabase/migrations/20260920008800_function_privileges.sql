-- =============================================================================
-- 0088 — Signed-out visitors execute only what a signed-out visitor needs
--
-- Found by Supabase's security advisor on the first live deploy: Postgres
-- grants EXECUTE on every new function to PUBLIC, and most migrations added
-- their own grants without revoking that default. So ~300 functions — admin
-- readers, case actions, payment functions — were callable by `anon`. Every
-- one of them checks its caller inside (an anonymous caller gets nothing or an
-- error, which the tests assert), but a signed-out visitor should not reach
-- them at all.
--
-- The fix is computed, not hand-listed, so it cannot miss a function:
--
--   * `authenticated` keeps exactly what it has today (a function that was
--     deliberately revoked stays revoked; one it reached through PUBLIC is now
--     granted by name).
--   * `anon` keeps a function only if some migration granted it to anon by
--     name, or a policy/view anon reads calls it, or an anon-callable function
--     that runs as its caller (security invoker) calls it — followed until
--     nothing new is found.
--   * PUBLIC loses EXECUTE on every function in the schema, and functions
--     created from now on no longer start with it.
--
-- Two functions also get the fixed search_path the advisor asked for.
-- =============================================================================

alter function public.server_now() set search_path = '';
alter function public.booking_holds_time(public.booking_status) set search_path = '';

do $migration$
declare
  v_keep     oid[];
  v_new      oid[];
  v_texts    text;
  f          record;
begin
  -- 1. What anon was granted by name.
  select coalesce(array_agg(distinct p.oid), '{}') into v_keep
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
         aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where n.nspname = 'public' and a.grantee = 'anon'::regrole and a.privilege_type = 'EXECUTE';

  -- 2. What anon-visible policies and anon-readable views call.
  select string_agg(coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' '
                    || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''), ' ')
    into v_texts
    from pg_policy pol
   where 0 = any (pol.polroles) or 'anon'::regrole = any (pol.polroles);

  select v_texts || ' ' || coalesce(string_agg(pg_get_viewdef(c.oid), ' '), '')
    into v_texts
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
     and has_table_privilege('anon', c.oid, 'SELECT');

  select coalesce(array_agg(distinct p.oid), '{}') || v_keep into v_keep
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and v_texts ~ ('\m' || p.proname || '\s*\(');

  -- 3. What anon-callable functions that run as their caller call in turn.
  loop
    select coalesce(array_agg(distinct callee.oid), '{}') into v_new
      from pg_proc caller
      join pg_proc callee on callee.pronamespace = caller.pronamespace
     where caller.oid = any (v_keep)
       and not caller.prosecdef
       and not callee.oid = any (v_keep)
       and caller.prosrc ~ ('\m' || callee.proname || '\s*\(');
    exit when cardinality(v_new) = 0;
    v_keep := v_keep || v_new;
  end loop;

  -- 4. Make every current right explicit, then take PUBLIC away.
  for f in
    select p.oid, p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')
  loop
    if has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    if f.oid = any (v_keep) and has_function_privilege('anon', f.oid, 'EXECUTE') then
      execute format('grant execute on function %s to anon', f.sig);
    else
      execute format('revoke execute on function %s from anon', f.sig);
    end if;
    execute format('revoke execute on function %s from public', f.sig);
  end loop;
end
$migration$;

alter default privileges in schema public revoke execute on functions from public;
