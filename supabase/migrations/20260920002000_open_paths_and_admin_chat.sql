-- =============================================================================
-- TechMood — 0020 Always-open paths, path chat, and the admin thread
--
-- Product decision: a learning path is ALWAYS OPEN. There are no cohorts, no
-- intake windows and no end date, so a path has exactly one conversation that
-- lives as long as the path does. Enrolling joins it; nothing ever closes it.
--
-- This also fills a real gap: of the four conversation kinds the product
-- defines, only `team` and `mentor_booking` were ever actually created. A path
-- chat and an admin thread existed as types with nothing to bring them to life.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- One conversation per path, created when the path is published
-- ---------------------------------------------------------------------------
create unique index conversations_one_per_path on public.conversations (path_id)
  where path_id is not null;

create or replace function public.ensure_path_conversation(p_path uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
  v_title text;
begin
  select id into v_conversation from public.conversations
   where path_id = p_path and kind = 'learning_path';

  if v_conversation is not null then
    return v_conversation;
  end if;

  select title_ar into v_title from public.learning_paths where id = p_path;

  insert into public.conversations (kind, path_id, title_ar)
  values ('learning_path', p_path, v_title)
  on conflict (path_id) where path_id is not null do nothing
  returning id into v_conversation;

  if v_conversation is null then
    select id into v_conversation from public.conversations where path_id = p_path;
  end if;

  return v_conversation;
end;
$$;

create or replace function public.open_path_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform public.ensure_path_conversation(new.id);
  end if;
  return new;
end;
$$;

create trigger learning_paths_open_conversation
  after insert or update of status on public.learning_paths
  for each row execute function public.open_path_conversation();

-- Paths already published before this migration.
do $$
declare
  r record;
begin
  for r in select id from public.learning_paths where status = 'published'
  loop
    perform public.ensure_path_conversation(r.id);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Enrolling in a path joins its conversation. Because the path never closes,
-- membership of that conversation is never revoked either.
-- ---------------------------------------------------------------------------
create or replace function public.join_path_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  if new.path_id is null then
    return new;
  end if;

  v_conversation := public.ensure_path_conversation(new.path_id);

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.profile_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger enrollments_join_conversation
  after insert on public.enrollments
  for each row execute function public.join_path_conversation();

-- ---------------------------------------------------------------------------
-- Every account gets one thread with TechMood administration, from day one.
-- ---------------------------------------------------------------------------
create or replace function public.open_admin_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  insert into public.conversations (kind, title_ar)
  values ('admin', 'إدارة TechMood')
  returning id into v_conversation;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.id);

  return new;
end;
$$;

create trigger profiles_open_admin_conversation
  after insert on public.profiles
  for each row execute function public.open_admin_conversation();

do $$
declare
  r record;
  v_conversation uuid;
begin
  for r in
    select p.id from public.profiles p
    where not exists (
      select 1 from public.conversations c
      join public.conversation_participants cp on cp.conversation_id = c.id
      where c.kind = 'admin' and cp.profile_id = p.id
    )
  loop
    insert into public.conversations (kind, title_ar) values ('admin', 'إدارة TechMood')
    returning id into v_conversation;

    insert into public.conversation_participants (conversation_id, profile_id)
    values (v_conversation, r.id);
  end loop;
end
$$;

-- An admin answers support threads without being a stored participant in every
-- one of them — otherwise every new admin would need backfilling into thousands
-- of conversations.
drop policy messages_send on public.messages;

create policy messages_send on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_conversation_participant(conversation_id)
      or (
        public.is_admin()
        and exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.kind = 'admin'
        )
      )
    )
  );

comment on column public.conversations.path_id is
  'A learning path is always open, so its conversation is permanent: one per '
  'path, joined on enrolment, never closed and never split into cohorts.';
