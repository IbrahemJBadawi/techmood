-- =============================================================================
-- 0056 — The client's judgement, and a reputation that is finally computed
--
-- Two things arrive together here because they are the same thing.
--
-- **A client had no way to say how the work went.** Every other judgement on
-- TechMood is recorded — a mentor evaluates a submission, both sides rate a
-- session, a panel scores an exhibition entry — but the person who paid for a
-- piece of work could say nothing at all. The `client_rating` reputation
-- dimension has existed since 0012 with nothing to fill it.
--
-- **And reputation was never actually computed.** `reputation_scores` has been
-- a table since 0002 with an admin-only write policy and no producer: the
-- passport meters have been reading rows nobody ever wrote. That is the gap
-- this closes — every meter is now a number worked out from records somebody
-- earned, recomputed whenever one of those records changes.
--
-- One rule shapes the review itself: **it follows money that actually moved.**
-- A review can only be written for work whose escrow was released. Nobody can
-- praise or damage a reputation for work that never happened, and the way to
-- earn a reviewable record is to do the work through the platform.
-- =============================================================================

create type public.client_criterion as enum (
  'quality', 'communication', 'deadline', 'professionalism', 'scope'
);

create table public.client_reviews (
  id           uuid primary key default extensions.gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  escrow_id    uuid references public.escrows (id) on delete set null,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  worker_id    uuid not null references public.profiles (id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  comment_ar   text,
  created_at   timestamptz not null default now(),

  unique (project_id, client_id)
);

create index client_reviews_worker_idx on public.client_reviews (worker_id);

create table public.client_review_scores (
  review_id  uuid not null references public.client_reviews (id) on delete cascade,
  criterion  public.client_criterion not null,
  stars      smallint not null check (stars between 1 and 5),

  primary key (review_id, criterion)
);

alter table public.client_reviews enable row level security;
alter table public.client_review_scores enable row level security;

-- A review of somebody's work is part of their professional record: public,
-- like the exhibition entry and the certificate, and for the same reason.
create policy client_reviews_read on public.client_reviews
  for select to anon, authenticated using (true);

create policy client_review_scores_read on public.client_review_scores
  for select to anon, authenticated using (true);

grant select on public.client_reviews, public.client_review_scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Writing one
-- ---------------------------------------------------------------------------
create or replace function public.review_client_work(
  p_project uuid,
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
  v_project public.projects%rowtype;
  v_escrow  public.escrows%rowtype;
  v_id      uuid;
  v_key     text;
  v_count   integer := 0;
  v_sum     integer := 0;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_project from public.projects where id = p_project;
  if not found then
    raise exception 'المشروع غير موجود';
  end if;

  if v_project.client_id is distinct from v_me then
    raise exception 'صاحب العمل فقط من يقيّمه';
  end if;

  if v_project.status not in ('completed', 'sold') then
    raise exception 'التقييم بعد اكتمال العمل فقط';
  end if;

  -- A review follows money that actually moved.
  select * into v_escrow from public.escrows
   where project_id = p_project and payer_id = v_me and status = 'released'
   order by released_at desc limit 1;

  if not found then
    raise exception 'التقييم بعد الإفراج عن المستحقات فقط';
  end if;

  if exists (select 1 from public.client_reviews cr
              where cr.project_id = p_project and cr.client_id = v_me) then
    raise exception 'قيّمت هذا العمل بالفعل';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.client_criterion)) c) then
      v_count := v_count + 1;
      v_sum := v_sum + least(5, greatest(1, (p_scores ->> v_key)::int));
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'التقييم يحتاج درجة واحدة على الأقل';
  end if;

  insert into public.client_reviews (project_id, escrow_id, client_id, worker_id, stars, comment_ar)
  values (p_project, v_escrow.id, v_me, v_project.owner_id,
          round(v_sum::numeric / v_count, 0)::smallint,
          nullif(trim(coalesce(p_comment, '')), ''))
  returning id into v_id;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.client_criterion)) c) then
      insert into public.client_review_scores (review_id, criterion, stars)
      values (v_id, v_key::public.client_criterion, least(5, greatest(1, (p_scores ->> v_key)::int)));
    end if;
  end loop;

  perform public.notify(
    v_project.owner_id, 'system', 'وصل تقييم العميل لعملك',
    p_comment, '/projects/' || p_project::text);

  return v_id;
end;
$$;

grant execute on function public.review_client_work(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Stars come from anybody with standing to judge the work
-- ---------------------------------------------------------------------------
-- A mentor's evaluation and a client's review are the same kind of statement:
-- somebody who saw the work, and had the standing to judge it, said how good it
-- was. Keeping two separate star averages would mean a freelancer's page shows
-- one number and a client's experience shows another.
create or replace view public.profile_stars
with (security_invoker = true) as
  select ratings.profile_id,
         round(avg(ratings.stars)::numeric, 2) as stars_avg,
         count(*)::integer as rated_count
    from (
      select s.profile_id, ev.stars
        from public.evaluations ev
        join public.submissions s on s.id = ev.submission_id
       where ev.decision = 'approved' and ev.stars is not null

      union all

      select cr.worker_id, cr.stars
        from public.client_reviews cr
    ) as ratings
   group by ratings.profile_id;

-- ---------------------------------------------------------------------------
-- The passport meters, worked out
-- ---------------------------------------------------------------------------
-- Every dimension is an average of real ratings on a 0–100 scale, and a
-- dimension with no evidence behind it is deleted rather than shown as zero:
-- "nothing to show yet" and "judged and found wanting" are different things,
-- and a meter that cannot tell them apart is a lie.
create or replace function public.recompute_reputation(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value numeric;
begin
  -- 1. learning — what mentors said about submitted work
  select round(avg(ev.stars) * 20, 2) into v_value
    from public.evaluations ev
    join public.submissions s on s.id = ev.submission_id
   where s.profile_id = p_profile and ev.decision = 'approved' and ev.stars is not null;
  perform public.set_reputation(p_profile, 'learning', v_value);

  -- 2. projects — what a panel said about exhibited work
  select round(avg(sc.stars) * 20, 2) into v_value
    from public.exhibition_review_scores sc
    join public.exhibition_reviews r on r.id = sc.review_id
    join public.exhibition_entries e on e.id = r.entry_id
   where exists (
     select 1 from jsonb_array_elements(coalesce(e.snapshot -> 'members', '[]'::jsonb)) m
      where (m ->> 'profile_id')::uuid = p_profile
   );
  perform public.set_reputation(p_profile, 'projects', v_value);

  -- 3. mentor_rating — what the other side of a session said
  select round(avg(sf.stars) * 20, 2) into v_value
    from public.session_feedback sf where sf.to_profile = p_profile;
  perform public.set_reputation(p_profile, 'mentor_rating', v_value);

  -- 4. client_rating — what the people who paid said
  select round(avg(cr.stars) * 20, 2) into v_value
    from public.client_reviews cr where cr.worker_id = p_profile;
  perform public.set_reputation(p_profile, 'client_rating', v_value);

  -- 5. team — work finished on a team board
  select least(100, count(*) * 10)::numeric into v_value
    from public.team_tasks t
   where t.assignee_id = p_profile and t.column_key = 'done';
  perform public.set_reputation(p_profile, 'team', nullif(v_value, 0));

  -- 6. reliability — sessions turned up to, and work delivered without dispute
  select round(avg(signal) * 100, 2) into v_value from (
    select case when e.status = 'released' then 1.0 when e.status = 'refunded' then 0.0 else null end as signal
      from public.escrows e where e.payee_id = p_profile
    union all
    select case when exists (
             select 1 from public.video_presence_events ev
              where ev.session_id = vs.id and ev.profile_id = p_profile
           ) then 1.0 else 0.0 end
      from public.video_sessions vs
      join public.video_session_participants vp on vp.session_id = vs.id
     where vp.profile_id = p_profile and vs.status in ('completed', 'no_show')
  ) signals where signal is not null;
  perform public.set_reputation(p_profile, 'reliability', v_value);

  -- 7. quality — the criterion itself, wherever it was scored
  select round(avg(stars) * 20, 2) into v_value from (
    select crs.stars from public.client_review_scores crs
      join public.client_reviews cr on cr.id = crs.review_id
     where cr.worker_id = p_profile and crs.criterion = 'quality'
    union all
    select sfs.stars from public.session_feedback_scores sfs
      join public.session_feedback sf on sf.id = sfs.feedback_id
     where sf.to_profile = p_profile and sfs.criterion = 'quality'
  ) scores;
  perform public.set_reputation(p_profile, 'quality', v_value);

  -- 8. communication — likewise
  select round(avg(stars) * 20, 2) into v_value from (
    select crs.stars from public.client_review_scores crs
      join public.client_reviews cr on cr.id = crs.review_id
     where cr.worker_id = p_profile and crs.criterion = 'communication'
    union all
    select sfs.stars from public.session_feedback_scores sfs
      join public.session_feedback sf on sf.id = sfs.feedback_id
     where sf.to_profile = p_profile and sfs.criterion = 'communication'
  ) scores;
  perform public.set_reputation(p_profile, 'communication', v_value);
end;
$$;

-- One row, written or removed. Null means "no evidence", which is not zero.
create or replace function public.set_reputation(p_profile uuid, p_dimension text, p_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null then
    delete from public.reputation_scores
     where profile_id = p_profile and dimension = p_dimension;
    return;
  end if;

  insert into public.reputation_scores (profile_id, dimension, value, updated_at)
  values (p_profile, p_dimension, least(100, greatest(0, p_value)), now())
  on conflict (profile_id, dimension)
  do update set value = excluded.value, updated_at = now();
end;
$$;

revoke execute on function public.set_reputation(uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.recompute_reputation(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Whenever a record that feeds a meter changes, the meter changes
-- ---------------------------------------------------------------------------
create or replace function public.reputation_after_client_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_reputation(new.worker_id);
  return new;
end;
$$;

create trigger client_reviews_reputation
  after insert on public.client_reviews
  for each row execute function public.reputation_after_client_review();

create or replace function public.reputation_after_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select profile_id into v_owner from public.submissions where id = new.submission_id;
  perform public.recompute_reputation(v_owner);
  return new;
end;
$$;

create trigger evaluations_reputation
  after insert on public.evaluations
  for each row execute function public.reputation_after_evaluation();

create or replace function public.reputation_after_session_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_reputation(new.to_profile);
  return new;
end;
$$;

create trigger session_feedback_reputation
  after insert on public.session_feedback
  for each row execute function public.reputation_after_session_feedback();

create or replace function public.reputation_after_escrow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.recompute_reputation(new.payee_id);
  end if;
  return new;
end;
$$;

create trigger escrows_reputation
  after update of status on public.escrows
  for each row execute function public.reputation_after_escrow();

-- What a client said about somebody's work, for their professional page.
create or replace function public.client_reviews_for(p_profile uuid)
returns table (
  id uuid, project_title text, client_name text, stars smallint,
  comment_ar text, criteria jsonb, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cr.id,
         (select p.title_ar from public.projects p where p.id = cr.project_id),
         (select pr.full_name from public.profiles pr where pr.id = cr.client_id),
         cr.stars,
         cr.comment_ar,
         coalesce((
           select jsonb_object_agg(s.criterion::text, s.stars)
             from public.client_review_scores s where s.review_id = cr.id
         ), '{}'::jsonb),
         cr.created_at
    from public.client_reviews cr
   where cr.worker_id = p_profile
   order by cr.created_at desc;
$$;

grant execute on function public.client_reviews_for(uuid) to anon, authenticated;
