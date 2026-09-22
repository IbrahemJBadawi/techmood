-- =============================================================================
-- 0055 — Bidding is a conversation with a number attached
--
-- 0051 let an applicant name a price once. Real work is rarely agreed in one
-- move: a client says the budget is smaller, a freelancer says the scope is
-- bigger, and somewhere in the middle both sign. What this must *not* become is
-- the auction other platforms run — connects to spend, a hundred bids nobody
-- reads, and a race to the cheapest. So:
--
--   * a round is a proposal by one named side, with a price, a duration and a
--     sentence saying why;
--   * only the *other* side can accept it, and accepting freezes those terms
--     onto the application;
--   * every round is kept. The agreed price is the last accepted round, and
--     the history of how two people got there is not thrown away.
--
-- And the talking itself goes where talking already happens. TechMood has one
-- Messages surface, with read state, replies and reactions; a market chat
-- bolted on beside it would be a second inbox to forget to check. A
-- conversation opens on an opening the moment somebody is shortlisted, and it
-- is the same conversation the work is discussed in afterwards.
-- =============================================================================

create type public.terms_status as enum ('offered', 'accepted', 'superseded', 'withdrawn');

create table public.proposal_terms (
  id             uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references public.opportunity_applications (id) on delete cascade,
  by_profile     uuid not null references public.profiles (id) on delete cascade,
  amount_usd     numeric(10,2) not null check (amount_usd >= 0),
  days           integer check (days between 1 and 365),
  message_ar     text,
  status         public.terms_status not null default 'offered',
  created_at     timestamptz not null default now(),
  answered_at    timestamptz
);

create index proposal_terms_application_idx on public.proposal_terms (application_id, created_at desc);

alter table public.proposal_terms enable row level security;

-- The two sides of the negotiation, and nobody else — a price somebody offered
-- is not public information.
create policy proposal_terms_read on public.proposal_terms
  for select to authenticated
  using (
    exists (
      select 1 from public.opportunity_applications a
        join public.opportunities o on o.id = a.opportunity_id
       where a.id = application_id
         and (a.profile_id = (select auth.uid()) or o.posted_by = (select auth.uid()) or public.is_admin())
    )
  );

grant select on public.proposal_terms to authenticated;

-- ---------------------------------------------------------------------------
-- Making an offer
-- ---------------------------------------------------------------------------
create or replace function public.propose_terms(
  p_application uuid,
  p_amount      numeric,
  p_days        integer default null,
  p_message     text default null
)
returns public.proposal_terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := (select auth.uid());
  v_application public.opportunity_applications%rowtype;
  v_opportunity public.opportunities%rowtype;
  v_terms       public.proposal_terms%rowtype;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_application from public.opportunity_applications where id = p_application;
  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  select * into v_opportunity from public.opportunities where id = v_application.opportunity_id;

  if v_me not in (v_application.profile_id, v_opportunity.posted_by) then
    raise exception 'طرفا الاتفاق فقط من يتفاوضان';
  end if;

  if v_application.stage in ('accepted', 'declined', 'withdrawn') then
    raise exception 'انتهى التفاوض على هذا الطلب';
  end if;

  if coalesce(p_amount, -1) < 0 then
    raise exception 'المبلغ غير صالح';
  end if;

  -- One open offer per side: a new one replaces your own, never theirs.
  update public.proposal_terms
     set status = 'superseded', answered_at = now()
   where application_id = p_application and by_profile = v_me and status = 'offered';

  insert into public.proposal_terms (application_id, by_profile, amount_usd, days, message_ar)
  values (p_application, v_me, p_amount, p_days, nullif(trim(coalesce(p_message, '')), ''))
  returning * into v_terms;

  perform public.notify(
    case when v_me = v_application.profile_id then v_opportunity.posted_by else v_application.profile_id end,
    'system',
    'عرض جديد على: ' || v_opportunity.title_ar,
    p_amount::text || ' دولار' || case when p_days is null then '' else ' · ' || p_days::text || ' يوم' end,
    '/marketplace/' || v_opportunity.id::text
  );

  return v_terms;
end;
$$;

grant execute on function public.propose_terms(uuid, numeric, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting one
-- ---------------------------------------------------------------------------
-- Only the side that did not make the offer can accept it, which is the whole
-- difference between an agreement and an announcement.
create or replace function public.accept_terms(p_terms uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := (select auth.uid());
  v_terms       public.proposal_terms%rowtype;
  v_application public.opportunity_applications%rowtype;
  v_opportunity public.opportunities%rowtype;
begin
  select * into v_terms from public.proposal_terms where id = p_terms;
  if not found then
    raise exception 'العرض غير موجود';
  end if;

  if v_terms.status <> 'offered' then
    raise exception 'هذا العرض لم يعد قائماً';
  end if;

  select * into v_application from public.opportunity_applications where id = v_terms.application_id;
  select * into v_opportunity from public.opportunities where id = v_application.opportunity_id;

  if v_me not in (v_application.profile_id, v_opportunity.posted_by) then
    raise exception 'طرفا الاتفاق فقط من يتفاوضان';
  end if;

  if v_me = v_terms.by_profile then
    raise exception 'الطرف الآخر هو من يقبل عرضك';
  end if;

  update public.proposal_terms
     set status = 'accepted', answered_at = now()
   where id = p_terms;

  update public.proposal_terms
     set status = 'superseded', answered_at = now()
   where application_id = v_terms.application_id and id <> p_terms and status = 'offered';

  -- The agreed terms are the application's terms from now on.
  update public.opportunity_applications
     set proposed_amount_usd = v_terms.amount_usd,
         proposed_days = coalesce(v_terms.days, proposed_days)
   where id = v_terms.application_id;

  perform public.notify(
    v_terms.by_profile, 'system', 'قُبل عرضك على: ' || v_opportunity.title_ar,
    v_terms.amount_usd::text || ' دولار',
    '/marketplace/' || v_opportunity.id::text);
end;
$$;

grant execute on function public.accept_terms(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The talking, where talking already happens
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column application_id uuid references public.opportunity_applications (id) on delete cascade,
  add column project_id     uuid references public.projects (id) on delete cascade;

create unique index conversations_application_idx on public.conversations (application_id)
  where application_id is not null;

-- The 0009 check knew four kinds of conversation and no market; it has to be
-- replaced rather than added to, because it is one constraint.
alter table public.conversations drop constraint conversations_source_matches_kind;

alter table public.conversations
  add constraint conversations_source_matches_kind check (
    (kind = 'team'           and team_id is not null) or
    (kind = 'mentor_booking' and booking_id is not null) or
    (kind = 'learning_path'  and path_id is not null) or
    (kind = 'market'         and (application_id is not null or project_id is not null)) or
    (kind = 'admin')
  );

-- Shortlisting somebody is the moment there is something to talk about.
create or replace function public.open_market_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_conversation uuid;
begin
  if new.stage::text not in ('shortlisted', 'interview', 'offer', 'accepted') then
    return new;
  end if;

  if exists (select 1 from public.conversations c where c.application_id = new.id) then
    return new;
  end if;

  select * into v_opportunity from public.opportunities where id = new.opportunity_id;

  insert into public.conversations (kind, application_id, title_ar)
  values ('market', new.id, v_opportunity.title_ar)
  returning id into v_conversation;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation, new.profile_id), (v_conversation, v_opportunity.posted_by)
  on conflict do nothing;

  insert into public.messages (conversation_id, sender_id, body_ar, is_system)
  values (v_conversation, null,
          'فُتحت هذه المحادثة حول: ' || v_opportunity.title_ar, true);

  return new;
end;
$$;

-- An application can arrive already shortlisted — that is what accepting an
-- invitation does — so the conversation opens on insert as well as on a move.
create trigger opportunity_applications_open_conversation
  after insert or update of stage on public.opportunity_applications
  for each row execute function public.open_market_conversation();

-- What the two sides have offered each other, newest first.
create or replace function public.negotiation(p_application uuid)
returns table (
  id uuid, by_profile uuid, by_name text, amount_usd numeric, days integer,
  message_ar text, status public.terms_status, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select pt.id, pt.by_profile, pr.full_name, pt.amount_usd, pt.days,
         pt.message_ar, pt.status, pt.created_at
    from public.proposal_terms pt
    join public.profiles pr on pr.id = pt.by_profile
   where pt.application_id = p_application
     and exists (
       select 1 from public.opportunity_applications a
         join public.opportunities o on o.id = a.opportunity_id
        where a.id = p_application
          and (a.profile_id = (select auth.uid()) or o.posted_by = (select auth.uid()) or public.is_admin())
     )
   order by pt.created_at desc;
$$;

grant execute on function public.negotiation(uuid) to authenticated;
