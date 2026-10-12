-- ============================================================================
-- 0168 — Fixes from the platform review
--
-- The home page's «openings that fit you» could list a freelance project that
-- was posted for invited people only; opening it then said «not found»,
-- because the page itself reads the opportunity under its row-level rules.
-- The suggestions now follow the same rule as the page: public, or a brief
-- this member may see.
-- ============================================================================

do $rewrite$
declare
  v_def text;
begin
  select pg_get_functiondef('public.suggested_opportunities(integer)'::regprocedure) into v_def;
  v_def := replace(v_def,
    'where o.status = ''published''
     and o.posted_by <> me.id',
    'where o.status = ''published''
     and o.posted_by <> me.id
     and (o.visibility = ''public'' or public.can_see_private_brief(o.id))');
  if position('can_see_private_brief(o.id)' in v_def) = 0 then
    raise exception 'suggested_opportunities did not have the expected shape';
  end if;
  execute v_def;
end
$rewrite$;
