-- =============================================================================
-- 0045 — Rating a session, on criteria, and blind until both have spoken
--
-- session_feedback has existed since 0007: one row per direction, one star
-- value, a comment. Two things about it were never right for what it is.
--
-- It is one number. A mentor's rating and a mentor's level ride on it, and a
-- single star for a whole session tells neither side what was good. The rest
-- of the platform judges work on criteria — the exhibition rubric does, and
-- for the same reason — so a session does too, five per direction, and the
-- star that drives the mentor's rating becomes their average rather than a
-- number somebody picked.
--
-- And it was visible the moment it was written. When both sides rate each
-- other, seeing the other's rating first is an invitation to answer it rather
-- than to judge. So feedback stays sealed until both have written, or until
-- the window closes — and only then does either side read what the other said.
-- =============================================================================

create type public.session_criterion as enum (
  -- what a learner or a team judges a mentor on
  'quality', 'clarity', 'usefulness', 'punctuality', 'guidance',
  -- what a mentor judges a learner or a team on
  'commitment', 'preparation', 'participation', 'use_of_session', 'cooperation',
  -- both directions
  'communication'
);

create table public.session_feedback_scores (
  feedback_id uuid not null references public.session_feedback (id) on delete cascade,
  criterion   public.session_criterion not null,
  stars       smallint not null check (stars between 1 and 5),

  primary key (feedback_id, criterion)
);

alter table public.session_feedback
  add column revealed_at timestamptz;

alter table public.session_feedback_scores enable row level security;

-- A rating is sealed until both sides have written one, or a week has passed.
-- The rule is a function so the policy, the reader and the writer all ask the
-- same question.
create or replace function public.session_feedback_is_open(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(distinct sf.from_profile) from public.session_feedback sf
     where sf.booking_id = p_booking
  ) >= 2
  or coalesce(
    (select b.scheduled_end < now() - interval '7 days' from public.bookings b where b.id = p_booking),
    false
  );
$$;

comment on function public.session_feedback_is_open is
  'Whether a session''s feedback has been unsealed: both sides have written, or the week to write in has passed.';

grant execute on function public.session_feedback_is_open(uuid) to authenticated;

-- The reader sees their own words always, and the other side's only once the
-- envelope is open.
drop policy session_feedback_read on public.session_feedback;

create policy session_feedback_read on public.session_feedback
  for select to authenticated
  using (
    from_profile = (select auth.uid())
    or public.is_admin()
    or (to_profile = (select auth.uid()) and public.session_feedback_is_open(booking_id))
  );

create policy session_feedback_scores_read on public.session_feedback_scores
  for select to authenticated
  using (exists (select 1 from public.session_feedback sf where sf.id = feedback_id));

grant select on public.session_feedback_scores to authenticated;

-- Writing goes through the function, so a rating can never arrive without its
-- criteria or for a session that did not happen.
revoke insert, update, delete on public.session_feedback from authenticated;
drop policy session_feedback_write on public.session_feedback;

create or replace function public.rate_session(
  p_booking uuid,
  p_scores  jsonb,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_to      uuid;
  v_id      uuid;
  v_key     text;
  v_avg     numeric;
  v_count   integer := 0;
  v_sum     integer := 0;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_booking from public.bookings where id = p_booking;
  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  -- A rating follows a session that actually happened.
  if v_booking.status <> 'completed' then
    raise exception 'التقييم بعد اكتمال الجلسة فقط';
  end if;

  if v_me = v_booking.mentor_id then
    v_to := v_booking.student_id;
  elsif v_me = v_booking.student_id then
    v_to := v_booking.mentor_id;
  elsif v_booking.team_id is not null and public.is_team_member(v_booking.team_id) then
    v_to := v_booking.mentor_id;
  else
    raise exception 'طرفا الجلسة فقط من يقيّمانها';
  end if;

  if v_to is null or v_to = v_me then
    raise exception 'لا يمكن تقييم نفسك';
  end if;

  if exists (
    select 1 from public.session_feedback sf
     where sf.booking_id = p_booking and sf.from_profile = v_me
  ) then
    raise exception 'قيّمت هذه الجلسة بالفعل';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.session_criterion)) c) then
      v_count := v_count + 1;
      v_sum := v_sum + least(5, greatest(1, (p_scores ->> v_key)::int));
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'التقييم يحتاج درجة واحدة على الأقل';
  end if;

  v_avg := round((v_sum::numeric / v_count), 0);

  insert into public.session_feedback (booking_id, from_profile, to_profile, stars, comment_ar)
  values (p_booking, v_me, v_to, v_avg::smallint, p_comment)
  returning id into v_id;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.session_criterion)) c) then
      insert into public.session_feedback_scores (feedback_id, criterion, stars)
      values (v_id, v_key::public.session_criterion,
              least(5, greatest(1, (p_scores ->> v_key)::int)));
    end if;
  end loop;

  -- The moment both sides have written, the envelope opens for both.
  if public.session_feedback_is_open(p_booking) then
    update public.session_feedback set revealed_at = now()
     where booking_id = p_booking and revealed_at is null;
  end if;

  return v_id;
end;
$$;

grant execute on function public.rate_session(uuid, jsonb, text) to authenticated;

-- What a session's rating looks like to somebody entitled to read it.
create or replace function public.session_feedback_for(p_booking uuid)
returns table (
  from_profile uuid,
  from_name    text,
  to_profile   uuid,
  stars        smallint,
  comment_ar   text,
  criteria     jsonb,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sf.from_profile,
         pr.full_name,
         sf.to_profile,
         sf.stars,
         sf.comment_ar,
         coalesce((
           select jsonb_object_agg(sc.criterion::text, sc.stars)
             from public.session_feedback_scores sc where sc.feedback_id = sf.id
         ), '{}'::jsonb),
         sf.created_at
    from public.session_feedback sf
    join public.profiles pr on pr.id = sf.from_profile
   where sf.booking_id = p_booking
     and (
       sf.from_profile = (select auth.uid())
       or public.is_admin()
       or (sf.to_profile = (select auth.uid()) and public.session_feedback_is_open(p_booking))
     );
$$;

grant execute on function public.session_feedback_for(uuid) to authenticated;
