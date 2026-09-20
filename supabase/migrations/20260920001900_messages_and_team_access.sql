-- =============================================================================
-- TechMood — 0019 Messages, and closing the team workspace
--
-- Messages is a private contextual chat system, not a social product. A
-- conversation exists only because a relationship exists: an admin thread, a
-- team you belong to, a mentor you booked, a path you enrolled in. There is no
-- "new chat", no feed, no posts, no files, no links.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Replies, reactions, per-person deletion, read-only archives
-- ---------------------------------------------------------------------------
alter table public.messages
  add column reply_to_id uuid references public.messages (id) on delete set null,
  add column edited_at   timestamptz,
  add column deleted_at  timestamptz;

create index messages_reply_idx on public.messages (reply_to_id) where reply_to_id is not null;

-- Full-text-ish search over the conversations a person can already open.
create index messages_body_trgm_idx on public.messages using gin (body_ar extensions.gin_trgm_ops);

alter table public.conversations
  add column is_read_only boolean not null default false,
  add column archived_at  timestamptz;

comment on column public.conversations.is_read_only is
  'Set when the relationship behind the conversation ends — a cohort closes, a '
  'mentor engagement finishes — so the history survives but nobody writes to it.';

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reaction   public.message_reaction not null,
  created_at timestamptz not null default now(),
  -- one reaction per person per message: a reaction is a signal, not a thread
  primary key (message_id, profile_id)
);

create index message_reactions_message_idx on public.message_reactions (message_id);

-- "Delete for me" hides a message for one person without rewriting history
-- for everyone else.
create table public.message_hidden (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (message_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- No links, no images. The check is broader than a URL scheme, because the
-- point is to keep work inside TechMood where it can be reviewed, not to lose
-- a game of spelling.
-- ---------------------------------------------------------------------------
create or replace function public.reject_links_in_messages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_system then
    return new;
  end if;

  if new.body_ar ~* '(https?://|www\.|data:image/|<img|t\.me/|wa\.me/|discord\.gg|bit\.ly|tinyurl)'
     or new.body_ar ~* '\m[a-z0-9][a-z0-9-]*\.(com|net|org|io|me|gg|ly|co|app|dev|xyz|info|link|site|online|store|tech)\M'
  then
    raise exception 'links and images are not allowed in TechMood messages; share your work as a submission instead'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- A read-only conversation takes no new messages.
create or replace function public.enforce_conversation_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and (c.is_read_only or c.archived_at is not null)
  ) then
    raise exception 'this conversation is read-only';
  end if;
  return new;
end;
$$;

create trigger messages_writable
  before insert on public.messages
  for each row execute function public.enforce_conversation_writable();

-- Unread counts, straight from each participant's read marker.
create or replace view public.conversation_unread
with (security_invoker = true) as
  select cp.conversation_id,
         cp.profile_id,
         count(m.id)::integer as unread_count,
         max(m.created_at)    as last_message_at
  from public.conversation_participants cp
  left join public.messages m
         on m.conversation_id = cp.conversation_id
        and m.deleted_at is null
        and m.sender_id is distinct from cp.profile_id
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
  group by cp.conversation_id, cp.profile_id;

-- ---------------------------------------------------------------------------
-- A team gets its chat the moment it exists, and members join and leave it
-- with their membership.
-- ---------------------------------------------------------------------------
create or replace function public.open_team_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  insert into public.conversations (kind, team_id, title_ar)
  values ('team', new.id, new.title_ar)
  returning id into v_conversation;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.leader_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger teams_open_conversation
  after insert on public.teams
  for each row execute function public.open_team_conversation();

create or replace function public.sync_team_conversation_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  select id into v_conversation from public.conversations
   where team_id = coalesce(new.team_id, old.team_id) and kind = 'team'
   limit 1;

  if v_conversation is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.conversation_participants
     where conversation_id = v_conversation and profile_id = old.profile_id;
    return old;
  end if;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.profile_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger team_members_sync_conversation
  after insert or delete on public.team_members
  for each row execute function public.sync_team_conversation_membership();

-- System messages report what happened in the workspace. They are the only
-- bridge from work to chat — the chat never becomes the record itself.
create or replace function public.announce_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
  v_text text;
  v_who  text;
begin
  select id into v_conversation from public.conversations
   where team_id = new.team_id and kind = 'team' limit 1;

  if v_conversation is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select full_name into v_who from public.profiles where id = new.assignee_id;
    v_text := case
      when new.assignee_id is null then 'أُضيفت مهمة جديدة: ' || new.title_ar
      else 'أُسندت مهمة «' || new.title_ar || '» إلى ' || coalesce(v_who, 'عضو')
    end;
  elsif new.column_key is distinct from old.column_key then
    v_text := case new.column_key
      when 'done'    then 'اكتملت مهمة «' || new.title_ar || '»'
      when 'blocked' then 'مهمة «' || new.title_ar || '» متوقفة: ' || coalesce(new.blocked_reason_ar, '')
      when 'review'  then 'مهمة «' || new.title_ar || '» بانتظار المراجعة'
      else null
    end;
  end if;

  if v_text is null then
    return new;
  end if;

  insert into public.messages (conversation_id, sender_id, body_ar, is_system)
  values (v_conversation, null, v_text, true);

  return new;
end;
$$;

create trigger team_tasks_announce
  after insert or update of column_key on public.team_tasks
  for each row execute function public.announce_task_change();

create or replace function public.announce_sprint_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select id into v_conversation from public.conversations
   where team_id = new.team_id and kind = 'team' limit 1;

  if v_conversation is null then
    return new;
  end if;

  insert into public.messages (conversation_id, sender_id, body_ar, is_system)
  values (
    v_conversation, null,
    case new.status
      when 'active' then 'بدأ السبرنت ' || new.number || coalesce(' — ' || new.goal_ar, '')
      when 'review' then 'السبرنت ' || new.number || ' في مرحلة المراجعة'
      when 'closed' then 'أُغلق السبرنت ' || new.number
      else 'أُنشئ السبرنت ' || new.number
    end,
    true
  );

  return new;
end;
$$;

create trigger sprints_announce
  after insert or update of status on public.sprints
  for each row execute function public.announce_sprint_change();

-- =============================================================================
-- Closing the workspace. A team was world-readable; the product says it is a
-- closed workspace, with only an opt-in professional profile made public.
-- =============================================================================

drop policy teams_read_all on public.teams;
drop policy team_members_read on public.team_members;
drop policy team_reviews_read on public.team_reviews;

-- The leader is named explicitly: at the moment a team is created its
-- membership row does not exist yet, so is_team_member() is still false and the
-- creator could not read back the row they just inserted.
create policy teams_read_scoped on public.teams
  for select to anon, authenticated
  using (
    visibility = 'listed'
    or leader_id = (select auth.uid())
    or public.is_team_member(id)
    or public.is_admin()
  );

create policy team_members_read_scoped on public.team_members
  for select to anon, authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_id
        and (t.visibility = 'listed'
             or t.leader_id = (select auth.uid())
             or public.is_team_member(t.id)
             or public.is_admin())
    )
  );

create policy team_reviews_read_scoped on public.team_reviews
  for select to anon, authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_id
      and (t.visibility = 'listed' or public.is_team_member(t.id) or public.is_admin())
  ));

-- Everything below is workspace-internal: members only, never public.
alter table public.team_permissions        enable row level security;
alter table public.sprints                 enable row level security;
alter table public.task_checklist_items    enable row level security;
alter table public.task_comments           enable row level security;
alter table public.task_submissions        enable row level security;
alter table public.task_submission_evidence enable row level security;
alter table public.team_documents          enable row level security;
alter table public.team_activity           enable row level security;
alter table public.team_xp_events          enable row level security;
alter table public.team_xp_rules           enable row level security;
alter table public.team_invites            enable row level security;
alter table public.exhibition_entries      enable row level security;
alter table public.message_reactions       enable row level security;
alter table public.message_hidden          enable row level security;

create policy team_permissions_members on public.team_permissions
  for select to authenticated using (public.is_team_member(team_id) or public.is_admin());
create policy team_permissions_leader on public.team_permissions
  for all to authenticated
  using (public.is_team_leader(team_id) or public.is_admin())
  with check (public.is_team_leader(team_id) or public.is_admin());

create policy sprints_members on public.sprints
  for select to authenticated using (public.is_team_member(team_id) or public.is_admin());
create policy sprints_leader on public.sprints
  for all to authenticated
  using (public.is_team_leader(team_id) or public.is_admin())
  with check (public.is_team_leader(team_id) or public.is_admin());

create policy task_checklist_members on public.task_checklist_items
  for all to authenticated
  using (exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id)))
  with check (exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id)));

create policy task_comments_members on public.task_comments
  for select to authenticated
  using (exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id)));
create policy task_comments_write on public.task_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id))
  );

create policy task_submissions_members on public.task_submissions
  for select to authenticated
  using (exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id)));
create policy task_submissions_write on public.task_submissions
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.team_tasks t where t.id = task_id and public.is_team_member(t.team_id))
  );

create policy task_evidence_members on public.task_submission_evidence
  for all to authenticated
  using (exists (
    select 1 from public.task_submissions s
    join public.team_tasks t on t.id = s.task_id
    where s.id = submission_id and public.is_team_member(t.team_id)))
  with check (exists (
    select 1 from public.task_submissions s
    join public.team_tasks t on t.id = s.task_id
    where s.id = submission_id and public.is_team_member(t.team_id)));

create policy team_documents_members on public.team_documents
  for select to authenticated using (public.is_team_member(team_id) or public.is_admin());
create policy team_documents_write on public.team_documents
  for all to authenticated
  using (public.team_permission(team_id, 'members_manage_docs'))
  with check (public.team_permission(team_id, 'members_manage_docs'));

create policy team_activity_members on public.team_activity
  for select to authenticated using (public.is_team_member(team_id) or public.is_admin());

create policy team_xp_events_scoped on public.team_xp_events
  for select to anon, authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_id and (t.visibility = 'listed' or public.is_team_member(t.id) or public.is_admin())));

create policy team_xp_rules_read on public.team_xp_rules
  for select to anon, authenticated using (true);
create policy team_xp_rules_admin on public.team_xp_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy team_invites_scoped on public.team_invites
  for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_team_leader(team_id) or public.is_admin());
create policy team_invites_write on public.team_invites
  for all to authenticated
  using (public.team_permission(team_id, 'members_invite'))
  with check (public.team_permission(team_id, 'members_invite'));

create policy exhibition_read on public.exhibition_entries
  for select to anon, authenticated
  using (status = 'approved' or submitted_by = (select auth.uid())
         or (team_id is not null and public.is_team_member(team_id)) or public.is_admin());
create policy exhibition_submit on public.exhibition_entries
  for insert to authenticated with check (submitted_by = (select auth.uid()));
create policy exhibition_review on public.exhibition_entries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Reactions and per-person hiding follow the conversation they belong to.
create policy message_reactions_participants on public.message_reactions
  for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_participant(m.conversation_id)));
create policy message_reactions_own on public.message_reactions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.messages m
                where m.id = message_id and public.is_conversation_participant(m.conversation_id)));

create policy message_hidden_own on public.message_hidden
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- A sender may retract their own message; nobody may rewrite someone else's.
create policy messages_delete_own on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()) or public.is_admin())
  with check (sender_id = (select auth.uid()) or public.is_admin());

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.team_permission(uuid, text)  to authenticated;
grant execute on function public.accept_team_invite(text)     to authenticated;
