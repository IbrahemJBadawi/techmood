-- =============================================================================
-- 0137 — Each conversation's last line, however busy the others are
--
-- The messages page took "the last line of each conversation" from the 200
-- newest messages across all of them: one busy conversation pushed every
-- other conversation's last line out of the list. This reads the last line of
-- each conversation separately, through the (conversation_id, created_at)
-- index, as the caller — row level security still decides what is visible.
-- =============================================================================

create or replace function public.conversation_previews(p_ids uuid[])
returns table (conversation_id uuid, body_ar text, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, m.body_ar, m.created_at
    from unnest(p_ids) as c(id)
    cross join lateral (
      select x.body_ar, x.created_at
        from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
       order by x.created_at desc
       limit 1
    ) m;
$$;

revoke execute on function public.conversation_previews(uuid[]) from public, anon;
grant execute on function public.conversation_previews(uuid[]) to authenticated;
