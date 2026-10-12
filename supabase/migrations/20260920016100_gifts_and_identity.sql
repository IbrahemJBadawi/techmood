-- ============================================================================
-- 0161 — XP gifts between members, and identity verification (design lab 5)
--
-- 1. A member gives XP from their own points: theirs go down by exactly what
--    the other's go up, and both lines are in the XP ledger — so the league,
--    which reads that ledger, counts a gift like any other point (decision
--    10). Small limits keep it a gesture rather than a market: up to 50 XP a
--    gift, 100 XP a day, never to yourself, never more than you have.
-- 2. «Verified» means a person's identity was checked by an admin (decision
--    15): the member uploads a document to a private bucket, an admin looks
--    at it and decides, and an approval adds them to `verified_members` — the
--    one public list every page reads for the blue ✓. The document is deleted
--    once the decision is made (the review page does that); only the outcome
--    is kept.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. XP gifts
-- ---------------------------------------------------------------------------
insert into public.xp_rules (source, base_xp, per_star_xp, description_ar) values
  ('gift_sent', 0, 0, 'نقاط أهديتها لعضو آخر — تُخصم من نقاطك'),
  ('gift_received', 0, 0, 'نقاط أهداها لك عضو آخر')
on conflict (source) do nothing;

-- A gift sent is the only line that takes points away.
alter table public.xp_events drop constraint if exists xp_events_xp_check;
alter table public.xp_events add constraint xp_events_xp_check
  check (case when source = 'gift_sent' then xp < 0 else xp > 0 end);

create table public.xp_gifts (
  id         uuid primary key default extensions.gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount between 1 and 50),
  note       text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create index xp_gifts_from_idx on public.xp_gifts (from_id, created_at desc);
create index xp_gifts_to_idx on public.xp_gifts (to_id, created_at desc);

alter table public.xp_gifts enable row level security;
create policy xp_gifts_parties on public.xp_gifts for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()) or public.is_admin());
revoke all on public.xp_gifts from anon, authenticated;
grant select on public.xp_gifts to authenticated;

create or replace function public.xp_balance(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(x.xp), 0)::integer from public.xp_events x where x.profile_id = p_profile;
$$;

revoke execute on function public.xp_balance(uuid) from public, anon;
grant execute on function public.xp_balance(uuid) to authenticated;

-- What I may still give today, and what I hold.
create or replace function public.my_gift_allowance()
returns table (balance integer, sent_today integer, left_today integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
       sent as (
         select coalesce(sum(g.amount), 0)::integer as n from public.xp_gifts g, me
          where g.from_id = me.id and g.created_at >= date_trunc('day', now()))
  select public.xp_balance(me.id), sent.n, greatest(0, least(100 - sent.n, public.xp_balance(me.id)))
    from me, sent
   where me.id is not null;
$$;

revoke execute on function public.my_gift_allowance() from public, anon;
grant execute on function public.my_gift_allowance() to authenticated;

create or replace function public.gift_xp(p_to uuid, p_amount integer, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_id    uuid;
  v_sent  integer;
  v_name  text;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_me is null then
    raise exception 'سجّل الدخول أولاً';
  end if;
  if p_to is null or p_to = v_me then
    raise exception 'لا يمكنك إهداء نفسك';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 50 then
    raise exception 'الهدية بين 1 و50 نقطة';
  end if;
  if v_note is not null and char_length(v_note) > 140 then
    raise exception 'الرسالة أطول من 140 حرفاً';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_to) then
    raise exception 'العضو غير موجود';
  end if;

  -- one gift at a time per giver, so two taps cannot spend the same points
  perform 1 from public.profiles p where p.id = v_me for update;

  select coalesce(sum(g.amount), 0) into v_sent from public.xp_gifts g
   where g.from_id = v_me and g.created_at >= date_trunc('day', now());
  if v_sent + p_amount > 100 then
    raise exception 'وصلت إلى حد الإهداء اليومي (100 نقطة) — بقي لك اليوم %', greatest(0, 100 - v_sent);
  end if;
  if public.xp_balance(v_me) < p_amount then
    raise exception 'نقاطك لا تكفي لهذه الهدية';
  end if;

  insert into public.xp_gifts (from_id, to_id, amount, note)
  values (v_me, p_to, p_amount, v_note)
  returning id into v_id;

  insert into public.xp_events (profile_id, source, xp, ref_table, ref_id) values
    (v_me, 'gift_sent', -p_amount, 'xp_gifts', v_id),
    (p_to, 'gift_received', p_amount, 'xp_gifts', v_id);

  select coalesce(p.display_name, p.full_name) into v_name from public.profiles p where p.id = v_me;
  perform public.notify(
    p_to, 'system',
    '🎁 ' || coalesce(v_name, 'عضو') || ' أهداك ' || p_amount || ' XP',
    coalesce(v_note, 'هدية من عضو في TechMood — أُضيفت إلى نقاطك.'),
    '/passport', 'xp_gift', v_id, 'normal');

  return v_id;
end;
$$;

revoke execute on function public.gift_xp(uuid, integer, text) from public, anon;
grant execute on function public.gift_xp(uuid, integer, text) to authenticated;

-- The activity graph counts what a member did; a gift is not something done.
create or replace function public.profile_activity(p_profile uuid)
returns table (day date, events integer, xp integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (x.created_at at time zone 'Asia/Jerusalem')::date, count(*)::int, sum(x.xp)::int
    from public.xp_events x
   where x.profile_id = p_profile
     and x.source not in ('gift_sent', 'gift_received')
     and x.created_at >= now() - interval '182 days'
     and public.can_see_profile_section(p_profile, 'learning')
   group by 1
   order by 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. Identity verification
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-docs', 'identity-docs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Each member uploads into their own folder; only they and an admin read it.
create policy identity_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'identity-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy identity_docs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'identity-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

create policy identity_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'identity-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

create table public.identity_verifications (
  id            uuid primary key default extensions.gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  legal_name    text not null check (char_length(btrim(legal_name)) between 3 and 120),
  document_path text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason        text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create unique index identity_verifications_one_pending
  on public.identity_verifications (profile_id) where status = 'pending';
create index identity_verifications_profile_idx on public.identity_verifications (profile_id, created_at desc);
create index identity_verifications_reviewed_by_idx on public.identity_verifications (reviewed_by);

alter table public.identity_verifications enable row level security;
create policy identity_verifications_read on public.identity_verifications for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.identity_verifications from anon, authenticated;
grant select on public.identity_verifications to authenticated;

-- The public list behind the blue ✓.
create table public.verified_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  since      timestamptz not null default now()
);

alter table public.verified_members enable row level security;
create policy verified_members_read on public.verified_members for select to anon, authenticated using (true);
revoke all on public.verified_members from anon, authenticated;
grant select on public.verified_members to anon, authenticated;

create or replace function public.is_verified(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.verified_members v where v.profile_id = p_profile);
$$;

revoke execute on function public.is_verified(uuid) from public;
grant execute on function public.is_verified(uuid) to anon, authenticated;

create or replace function public.request_identity_verification(p_legal_name text, p_document_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'سجّل الدخول أولاً';
  end if;
  if exists (select 1 from public.verified_members v where v.profile_id = v_me) then
    raise exception 'حسابك موثّق بالفعل';
  end if;
  if exists (select 1 from public.identity_verifications i where i.profile_id = v_me and i.status = 'pending') then
    raise exception 'لديك طلب توثيق قيد المراجعة';
  end if;
  if p_legal_name is null or char_length(btrim(p_legal_name)) not between 3 and 120 then
    raise exception 'اكتب اسمك كما هو في الوثيقة';
  end if;
  if p_document_path is null or split_part(p_document_path, '/', 1) <> v_me::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'identity-docs' and o.name = p_document_path) then
    raise exception 'ارفع صورة الوثيقة أولاً';
  end if;

  insert into public.identity_verifications (profile_id, legal_name, document_path)
  values (v_me, btrim(p_legal_name), p_document_path)
  returning id into v_id;

  perform public.notify_admins(
    '🪪 طلب توثيق هوية جديد',
    'عضو أرسل وثيقة لتوثيق حسابه. راجعها وقرّر.',
    '/admin/verifications', 'identity_verification', v_id, 'normal');
  return v_id;
end;
$$;

revoke execute on function public.request_identity_verification(text, text) from public, anon;
grant execute on function public.request_identity_verification(text, text) to authenticated;

-- An admin decides. Returns the document's path so the caller can delete it.
create or replace function public.review_identity_verification(p_id uuid, p_approve boolean, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.identity_verifications;
begin
  if not public.is_admin() then
    raise exception 'هذه المراجعة للإدارة فقط';
  end if;
  select * into v_row from public.identity_verifications where id = p_id for update;
  if v_row.id is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'هذا الطلب رُوجع من قبل';
  end if;
  if not p_approve and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'اكتب سبب الرفض ليعرف العضو ما يصلحه';
  end if;

  update public.identity_verifications
     set status = case when p_approve then 'approved' else 'rejected' end,
         reason = nullif(btrim(coalesce(p_reason, '')), ''),
         reviewed_by = (select auth.uid()), reviewed_at = now(), document_path = null
   where id = p_id;

  if p_approve then
    insert into public.verified_members (profile_id) values (v_row.profile_id)
    on conflict (profile_id) do nothing;
    perform public.notify(v_row.profile_id, 'security', '✓ وُثّق حسابك',
      'راجعت الإدارة هويتك، وتظهر الآن علامة التوثيق الزرقاء بجانب اسمك في كل المنصة.',
      '/settings/verification', 'identity_verification', p_id, 'important');
  else
    perform public.notify(v_row.profile_id, 'security', 'لم يُقبل طلب التوثيق',
      'السبب: ' || btrim(p_reason) || ' — تستطيع إرسال طلب جديد.',
      '/settings/verification', 'identity_verification', p_id, 'important');
  end if;

  return v_row.document_path;
end;
$$;

revoke execute on function public.review_identity_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_identity_verification(uuid, boolean, text) to authenticated;

create or replace function public.revoke_verification(p_profile uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'اكتب السبب';
  end if;
  delete from public.verified_members where profile_id = p_profile;
  perform public.notify(p_profile, 'security', 'أُزيلت علامة التوثيق',
    'السبب: ' || btrim(p_reason), '/settings/verification', 'profile', p_profile, 'important');
end;
$$;

revoke execute on function public.revoke_verification(uuid, text) from public, anon;
grant execute on function public.revoke_verification(uuid, text) to authenticated;
