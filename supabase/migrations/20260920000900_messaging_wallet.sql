-- =============================================================================
-- TechMood — 0009 Messaging, notifications, wallet
-- =============================================================================

create table public.conversations (
  id         uuid primary key default extensions.gen_random_uuid(),
  kind       public.conversation_kind not null,
  title_ar   text,
  team_id    uuid references public.teams (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  path_id    uuid references public.learning_paths (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint conversations_source_matches_kind check (
    (kind = 'team'           and team_id is not null) or
    (kind = 'mentor_booking' and booking_id is not null) or
    (kind = 'learning_path'  and path_id is not null) or
    (kind = 'admin')
  )
);

create unique index conversations_one_per_booking on public.conversations (booking_id)
  where booking_id is not null;

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index conversation_participants_profile_idx on public.conversation_participants (profile_id);

create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation
      and cp.profile_id = (select auth.uid())
  );
$$;

create table public.messages (
  id              uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body_ar         text not null,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),

  constraint messages_body_len check (char_length(body_ar) between 1 and 4000)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Product rule: conversations stay inside TechMood. No links, no embedded images.
-- Work is shared as a submission with evidence, which is reviewable and traceable;
-- a raw link in a chat is neither.
create or replace function public.reject_links_in_messages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_system then
    return new;
  end if;

  if new.body_ar ~* '(https?://|www\.|data:image/|<img)' then
    raise exception 'links and images are not allowed in TechMood messages; share your work as a submission instead'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger messages_no_links
  before insert or update of body_ar on public.messages
  for each row execute function public.reject_links_in_messages();

-- A confirmed booking opens its own mentor conversation automatically.
create or replace function public.open_booking_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  insert into public.conversations (kind, booking_id, title_ar)
  values ('mentor_booking', new.id, coalesce(new.topic_ar, 'جلسة إرشاد'))
  on conflict (booking_id) where booking_id is not null do nothing
  returning id into v_conversation;

  if v_conversation is null then
    select id into v_conversation from public.conversations where booking_id = new.id;
  end if;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.mentor_id)
  on conflict do nothing;

  if new.student_id is not null then
    insert into public.conversation_participants (conversation_id, profile_id)
    values (v_conversation, new.student_id)
    on conflict do nothing;
  end if;

  if new.team_id is not null then
    insert into public.conversation_participants (conversation_id, profile_id)
    select v_conversation, tm.profile_id
    from public.team_members tm
    where tm.team_id = new.team_id
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger bookings_open_conversation
  after update of status on public.bookings
  for each row execute function public.open_booking_conversation();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  title_ar   text not null,
  body_ar    text,
  -- in-app route, e.g. /bookings/TMB-XXXXXXXX
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (profile_id, is_read, created_at desc);

create or replace function public.notify(
  p_profile uuid,
  p_kind    public.notification_kind,
  p_title   text,
  p_body    text default null,
  p_link    text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, kind, title_ar, body_ar, link)
  values (p_profile, p_kind, p_title, p_body, p_link);
$$;

-- An evaluation is worth telling the student about.
create or replace function public.notify_on_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select profile_id into v_owner from public.submissions where id = new.submission_id;

  perform public.notify(
    v_owner,
    'evaluation',
    case new.decision
      when 'approved'          then 'تم اعتماد تسليمك'
      when 'changes_requested' then 'مطلوب تعديل على تسليمك'
      else 'لم يُعتمد تسليمك'
    end,
    new.feedback_ar,
    '/submissions/' || new.submission_id
  );

  return new;
end;
$$;

create trigger evaluations_notify
  after insert on public.evaluations
  for each row execute function public.notify_on_evaluation();

-- ---------------------------------------------------------------------------
-- Wallet — a ledger, not a stored balance
-- ---------------------------------------------------------------------------
create table public.wallet_entries (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  kind           public.ledger_kind not null,
  -- earnings are positive, fees and payouts negative
  amount_usd     numeric(10,2) not null,
  status         public.ledger_status not null default 'pending',
  description_ar text not null,
  ref_table      text,
  ref_id         uuid,
  created_at     timestamptz not null default now()
);

create index wallet_entries_profile_idx on public.wallet_entries (profile_id, created_at desc);

create or replace view public.wallet_balance
with (security_invoker = true) as
  select p.id as profile_id,
         coalesce(sum(w.amount_usd) filter (where w.status = 'available'), 0)::numeric(10,2) as available_usd,
         coalesce(sum(w.amount_usd) filter (where w.status = 'pending'),   0)::numeric(10,2) as pending_usd,
         coalesce(sum(w.amount_usd) filter (where w.kind = 'earning'),     0)::numeric(10,2) as total_earned_usd
  from public.profiles p
  left join public.wallet_entries w on w.profile_id = p.id
  group by p.id;

-- A completed session credits the mentor and books the platform's commission.
create or replace function public.on_booking_completed_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (
    new.mentor_id, 'earning', new.mentor_share_usd, 'available',
    'أرباح جلسة إرشاد ' || new.booking_code, 'bookings', new.id
  );

  insert into public.wallet_entries (profile_id, kind, amount_usd, status, description_ar, ref_table, ref_id)
  values (
    new.mentor_id, 'commission', -new.platform_share_usd, 'paid',
    'عمولة المنصة على الجلسة ' || new.booking_code, 'bookings', new.id
  );

  return new;
end;
$$;

create trigger bookings_ledger
  after update of status on public.bookings
  for each row execute function public.on_booking_completed_ledger();
