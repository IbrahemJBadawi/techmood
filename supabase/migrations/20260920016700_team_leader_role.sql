-- ============================================================================
-- 0167 — The team-leader role can be asked for again
--
-- It was the one role refused outright in the MVP (0103, kept by 0165). Teams
-- themselves were never closed; the role is reviewed by an admin, as before.
-- ============================================================================

do $rewrite$
declare
  v_def text;
begin
  select pg_get_functiondef('public.refuse_outside_mvp()'::regprocedure) into v_def;
  v_def := replace(v_def, 'when ''team_leader'' then ''never''', 'when ''team_leader'' then null');
  if position('when ''team_leader'' then null' in v_def) = 0 then
    raise exception 'refuse_outside_mvp did not have the expected shape';
  end if;
  execute v_def;
end
$rewrite$;
