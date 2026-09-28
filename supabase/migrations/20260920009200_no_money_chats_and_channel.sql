-- =============================================================================
-- 0092 — No chat between two people money passes between; one channel from
--        TechMood to everybody
--
-- The founder's rule: a learner and the mentor they pay, or a client and the
-- freelancer they hire, do not get a private chat. A chat between two people
-- with money between them is where a deal gets moved off the platform, where
-- a refund dispute has no record, and where somebody is pressured. What those
-- two need is already structured and on the record:
--
--   * a session: the booking page (topic, notes, time), the session room, the
--     mentor's evaluation and the learner's rating; a problem goes to Support.
--   * market work: the negotiation rounds (0055 — each with a price, a
--     duration and a sentence), then the work's own tasks and submissions.
--
-- So:
--   1. Confirming a booking no longer opens a mentor conversation (0009), and
--      shortlisting an applicant no longer opens a market one (0055).
--   2. The ones that already exist are closed, not deleted: a closing note is
--      added and they become read-only, so the history stays for disputes.
--   3. No function can open one again: the kinds are refused on insert.
--
-- And, in their place, the TechMood channel: one conversation every account
-- is in from the moment it exists, where only an admin writes (Telegram's
-- channel, in the Messages people already open). Admin posts there may carry
-- links — the no-links rule (0019) protects people from each other, and an
-- admin is not a stranger.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stop opening them
-- ---------------------------------------------------------------------------
drop trigger if exists bookings_open_conversation on public.bookings;
drop function if exists public.open_booking_conversation();

drop trigger if exists opportunity_applications_open_conversation on public.opportunity_applications;
drop function if exists public.open_market_conversation();

-- ---------------------------------------------------------------------------
-- 2. Close the ones that exist
-- ---------------------------------------------------------------------------
insert into public.messages (conversation_id, sender_id, body_ar, is_system)
select c.id, null,
       'أُغلقت هذه المحادثة: لا محادثات خاصة في TechMood بين طرفين بينهما دفع. '
       || case c.kind when 'mentor_booking'
            then 'تفاصيل الجلسة وغرفتها والتقييم في صفحة الحجز.'
            else 'العروض والاتفاق في صفحة التقديم، والعمل في مساحة المشروع.' end
       || ' ولأي مشكلة افتح تذكرة من الدعم. السجل أدناه محفوظ للقراءة.',
       true
  from public.conversations c
 where c.kind in ('mentor_booking', 'market')
   and not c.is_read_only and c.archived_at is null;

update public.conversations
   set is_read_only = true
 where kind in ('mentor_booking', 'market') and not is_read_only;

-- ---------------------------------------------------------------------------
-- 3. And nobody opens one again
-- ---------------------------------------------------------------------------
create or replace function public.refuse_money_conversations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind in ('mentor_booking', 'market') then
    raise exception 'no private conversations between two parties money passes between'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger conversations_no_money_chats
  before insert on public.conversations
  for each row execute function public.refuse_money_conversations();

-- ---------------------------------------------------------------------------
-- 4. The TechMood channel
-- ---------------------------------------------------------------------------
alter table public.conversations drop constraint conversations_source_matches_kind;

alter table public.conversations
  add constraint conversations_source_matches_kind check (
    (kind = 'team'           and team_id is not null) or
    (kind = 'mentor_booking' and booking_id is not null) or
    (kind = 'learning_path'  and path_id is not null) or
    (kind = 'market'         and (application_id is not null or project_id is not null)) or
    (kind = 'admin') or
    (kind = 'channel')
  );

-- There is one.
create unique index conversations_one_channel on public.conversations (kind)
  where kind = 'channel';

insert into public.conversations (kind, title_ar) values ('channel', 'قناة TechMood');

create or replace function public.channel_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.conversations where kind = 'channel' limit 1;
$$;

revoke execute on function public.channel_id() from public, anon;
grant execute on function public.channel_id() to authenticated;

-- Everybody is in it: participation is what the unread counts and the
-- Messages list already read, so nothing else needs to learn a new rule.
insert into public.conversation_participants (conversation_id, profile_id)
select public.channel_id(), p.id from public.profiles p
on conflict do nothing;

create or replace function public.join_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversation_participants (conversation_id, profile_id)
  values (public.channel_id(), new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_join_channel
  after insert on public.profiles
  for each row execute function public.join_channel();

-- Only an admin writes in it. Being a participant is no longer enough on its
-- own: in the channel a participant is a reader.
drop policy messages_send on public.messages;

create policy messages_send on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (
        public.is_conversation_participant(conversation_id)
        and not exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.kind = 'channel'
        )
      )
      or (
        public.is_admin()
        and exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.kind in ('admin', 'channel')
        )
      )
    )
  );

-- Links: refused between people, allowed in what TechMood itself posts.
create or replace function public.reject_links_in_messages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_system then
    return new;
  end if;

  if exists (select 1 from public.conversations c where c.id = new.conversation_id and c.kind = 'channel') then
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

comment on column public.conversations.kind is
  'admin: one thread per account with TechMood. team / learning_path: a group. '
  'channel: TechMood to everybody, admins write. mentor_booking / market: closed '
  'by 0092 — no private chat between two parties money passes between.';
