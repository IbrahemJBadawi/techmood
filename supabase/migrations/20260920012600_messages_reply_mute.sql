-- =============================================================================
-- 0126 — Messages: replies that stay in their thread, mute, one unread number
--
-- * A reply points at a message of the same conversation, never at one from
--   a thread the sender cannot read.
-- * Each member can mute a conversation — for 8 hours, a week, or until they
--   unmute it. A muted thread still counts its unread messages in the list,
--   but not in the badge on the Messages tab, and sends no notifications.
-- * my_unread_messages(): the number on the Messages tab, so every page shows
--   the same figure without loading the threads.
-- =============================================================================

alter table public.conversation_participants
  add column muted_until timestamptz;

comment on column public.conversation_participants.muted_until is
  'Muted for this member until then (''infinity'' until they unmute) — 0126.';

-- The list's unread view (0019), now saying whether the thread is muted.
create or replace view public.conversation_unread
with (security_invoker = true) as
  select cp.conversation_id,
         cp.profile_id,
         count(m.id)::integer as unread_count,
         max(m.created_at)    as last_message_at,
         coalesce(cp.muted_until > now(), false) as is_muted
  from public.conversation_participants cp
  left join public.messages m
         on m.conversation_id = cp.conversation_id
        and m.deleted_at is null
        and m.sender_id is distinct from cp.profile_id
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
  group by cp.conversation_id, cp.profile_id, cp.muted_until;

-- Mute or unmute one's own place in a conversation. p_hours null = until
-- unmuted; 0 = unmute.
create or replace function public.set_conversation_muted(p_conversation uuid, p_hours integer default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if p_hours is not null and (p_hours < 0 or p_hours > 24 * 365) then
    raise exception 'مدة كتم غير صالحة';
  end if;
  v_until := case when p_hours is null then 'infinity'::timestamptz
                  when p_hours = 0 then null
                  else now() + (p_hours || ' hours')::interval end;

  update public.conversation_participants
     set muted_until = v_until
   where conversation_id = p_conversation and profile_id = (select auth.uid());
  if not found then
    raise exception 'لست في هذه المحادثة';
  end if;
  return v_until;
end;
$$;

revoke execute on function public.set_conversation_muted(uuid, integer) from public, anon;
grant execute on function public.set_conversation_muted(uuid, integer) to authenticated;

-- The number on the Messages tab: unread messages in threads that are not muted.
create or replace function public.my_unread_messages()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(count(m.id), 0)::integer
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id and c.archived_at is null
    join public.messages m
      on m.conversation_id = cp.conversation_id
     and m.deleted_at is null
     and m.sender_id is distinct from cp.profile_id
     and (cp.last_read_at is null or m.created_at > cp.last_read_at)
   where cp.profile_id = (select auth.uid())
     and not coalesce(cp.muted_until > now(), false);
$$;

revoke execute on function public.my_unread_messages() from public, anon;
grant execute on function public.my_unread_messages() to authenticated;

-- A reply stays in its own thread.
create or replace function public.enforce_reply_in_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages m
     where m.id = new.reply_to_id and m.conversation_id = new.conversation_id and m.deleted_at is null
  ) then
    raise exception 'الرد على رسالة من المحادثة نفسها فقط';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_reply_in_thread() from public, anon, authenticated;

create trigger messages_reply_in_thread
  before insert or update of reply_to_id on public.messages
  for each row execute function public.enforce_reply_in_thread();
