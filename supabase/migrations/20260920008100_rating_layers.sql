-- =============================================================================
-- 0081 — Rating, review, performance and reputation are four layers, not one
--
-- What existed: every rating in TechMood is already on criteria and already
-- mutual — a session is rated by both sides and sealed until both have written
-- (0045), and market work is rated by the client and the freelancer about each
-- other (0056, 0069). Reputation is its own table of long-term meters (0056).
--
-- What the spec adds, and this migration builds:
--
--   * "Would you recommend it?" and the two written questions — what helped
--     most, and what could be better — on every kind of rating. They are added
--     to the existing rows by the person who wrote the rating, once, rather
--     than by rewriting three rating functions that are already tested.
--   * A finished course can be rated, on its own criteria.
--   * Performance: what actually happened, counted — sessions held, attendance,
--     satisfaction, recommendation, rebooking — kept apart from stars.
--   * A digest of the feedback: strengths and things to improve read from the
--     criteria themselves. It is arithmetic, not a verdict; the written
--     comments behind it are shown to the person rated and to admins only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Recommend, and the two written questions
-- ---------------------------------------------------------------------------
alter table public.session_feedback
  add column recommend  boolean,
  add column liked_ar   text check (liked_ar is null or length(liked_ar) <= 1000),
  add column improve_ar text check (improve_ar is null or length(improve_ar) <= 1000);

alter table public.client_reviews
  add column recommend  boolean,
  add column liked_ar   text check (liked_ar is null or length(liked_ar) <= 1000),
  add column improve_ar text check (improve_ar is null or length(improve_ar) <= 1000);

alter table public.worker_reviews
  add column recommend  boolean,
  add column liked_ar   text check (liked_ar is null or length(liked_ar) <= 1000),
  add column improve_ar text check (improve_ar is null or length(improve_ar) <= 1000);

-- Only the author, only once, only within a day of writing the rating — the
-- details belong to the same moment as the stars, not to a later argument.
create or replace function public.add_rating_details(
  p_kind      text,
  p_id        uuid,
  p_recommend boolean,
  p_liked     text default null,
  p_improve   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_author  uuid;
  v_created timestamptz;
  v_done    boolean;
  v_liked   text := nullif(btrim(coalesce(p_liked, '')), '');
  v_improve text := nullif(btrim(coalesce(p_improve, '')), '');
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if p_kind = 'session' then
    select from_profile, created_at, (recommend is not null or liked_ar is not null or improve_ar is not null)
      into v_author, v_created, v_done from public.session_feedback where id = p_id;
  elsif p_kind = 'client_work' then
    select client_id, created_at, (recommend is not null or liked_ar is not null or improve_ar is not null)
      into v_author, v_created, v_done from public.client_reviews where id = p_id;
  elsif p_kind = 'client' then
    select worker_id, created_at, (recommend is not null or liked_ar is not null or improve_ar is not null)
      into v_author, v_created, v_done from public.worker_reviews where id = p_id;
  else
    raise exception 'نوع تقييم غير معروف';
  end if;

  if v_author is null or v_author <> v_me then
    raise exception 'التقييم ليس لك';
  end if;

  if v_done then
    raise exception 'أُضيفت تفاصيل هذا التقييم بالفعل';
  end if;

  if v_created < now() - interval '1 day' then
    raise exception 'تُضاف التفاصيل مع التقييم نفسه، لا بعده بأيام';
  end if;

  if p_kind = 'session' then
    update public.session_feedback set recommend = p_recommend, liked_ar = v_liked, improve_ar = v_improve where id = p_id;
  elsif p_kind = 'client_work' then
    update public.client_reviews set recommend = p_recommend, liked_ar = v_liked, improve_ar = v_improve where id = p_id;
  else
    update public.worker_reviews set recommend = p_recommend, liked_ar = v_liked, improve_ar = v_improve where id = p_id;
  end if;
end;
$$;

grant execute on function public.add_rating_details(text, uuid, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rating a finished course
-- ---------------------------------------------------------------------------
create table public.course_feedback (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  recommend   boolean,
  liked_ar    text check (liked_ar is null or length(liked_ar) <= 1000),
  improve_ar  text check (improve_ar is null or length(improve_ar) <= 1000),
  created_at  timestamptz not null default now(),

  unique (course_id, profile_id)
);

create table public.course_feedback_scores (
  feedback_id uuid not null references public.course_feedback (id) on delete cascade,
  criterion   public.course_criterion not null,
  stars       smallint not null check (stars between 1 and 5),

  primary key (feedback_id, criterion)
);

alter table public.course_feedback enable row level security;
alter table public.course_feedback_scores enable row level security;

-- The stars and scores are public, as a course's rating is; the words are the
-- author's, the academy's and nobody else's (course_feedback_texts below).
create policy course_feedback_read on public.course_feedback
  for select to anon, authenticated using (true);
create policy course_feedback_scores_read on public.course_feedback_scores
  for select to anon, authenticated using (true);

revoke all on public.course_feedback, public.course_feedback_scores from anon, authenticated;
grant select (id, course_id, profile_id, stars, recommend, created_at) on public.course_feedback to anon, authenticated;
grant select on public.course_feedback_scores to anon, authenticated;

create or replace function public.rate_course(
  p_course    uuid,
  p_scores    jsonb,
  p_recommend boolean default null,
  p_liked     text default null,
  p_improve   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_id    uuid;
  v_key   text;
  v_count integer := 0;
  v_sum   integer := 0;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if not public.is_course_complete(v_me, p_course) then
    raise exception 'تُقيَّم الدورة بعد إكمالها';
  end if;

  if exists (select 1 from public.course_feedback cf where cf.course_id = p_course and cf.profile_id = v_me) then
    raise exception 'قيّمت هذه الدورة بالفعل';
  end if;

  for v_key in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb))
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.course_criterion)) c) then
      v_count := v_count + 1;
      v_sum := v_sum + least(5, greatest(1, (p_scores ->> v_key)::int));
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'التقييم يحتاج درجة واحدة على الأقل';
  end if;

  insert into public.course_feedback (course_id, profile_id, stars, recommend, liked_ar, improve_ar)
  values (p_course, v_me, round(v_sum::numeric / v_count, 0)::smallint, p_recommend,
          nullif(btrim(coalesce(p_liked, '')), ''), nullif(btrim(coalesce(p_improve, '')), ''))
  returning id into v_id;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    if v_key = any (select c::text from unnest(enum_range(null::public.course_criterion)) c) then
      insert into public.course_feedback_scores (feedback_id, criterion, stars)
      values (v_id, v_key::public.course_criterion, least(5, greatest(1, (p_scores ->> v_key)::int)));
    end if;
  end loop;

  return v_id;
end;
$$;

grant execute on function public.rate_course(uuid, jsonb, boolean, text, text) to authenticated;

create or replace function public.course_rating(p_course uuid)
returns table (stars_avg numeric, rated_count integer, recommend_pct integer, criteria jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(cf.stars), 2),
         count(*)::int,
         case when count(cf.recommend) = 0 then null
              else round(100.0 * count(*) filter (where cf.recommend) / count(cf.recommend))::int end,
         coalesce((select jsonb_object_agg(x.criterion, x.avg_stars)
                     from (select sc.criterion::text as criterion, round(avg(sc.stars), 2) as avg_stars
                             from public.course_feedback_scores sc
                             join public.course_feedback f on f.id = sc.feedback_id
                            where f.course_id = p_course
                            group by sc.criterion) x), '{}'::jsonb)
    from public.course_feedback cf
   where cf.course_id = p_course;
$$;

grant execute on function public.course_rating(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Performance: what happened, counted
-- ---------------------------------------------------------------------------
-- Every figure is a count of real rows. A figure with nothing behind it is
-- null — "no sessions yet" is not "0% attendance".
create or replace function public.mentor_performance(p_mentor uuid)
returns table (
  stars_avg        numeric,
  rated_count      integer,
  sessions_held    integer,
  attendance_pct   integer,
  satisfaction_pct integer,
  recommend_pct    integer,
  rebook_pct       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with fb as (
    select sf.* from public.session_feedback sf
      join public.bookings b on b.id = sf.booking_id
     where sf.to_profile = p_mentor and b.mentor_id = p_mentor
       and public.session_feedback_is_open(sf.booking_id)
  ),
  rooms as (
    select vs.status from public.video_sessions vs
      join public.bookings b on b.id = vs.booking_id
     where b.mentor_id = p_mentor and vs.status in ('completed', 'no_show')
  ),
  learners as (
    select b.student_id, count(*) as n from public.bookings b
     where b.mentor_id = p_mentor and b.status = 'completed' and b.student_id is not null
     group by b.student_id
  )
  select (select round(avg(stars), 2) from fb),
         (select count(*)::int from fb),
         (select count(*)::int from public.bookings b where b.mentor_id = p_mentor and b.status = 'completed'),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where status = 'completed') / count(*))::int end from rooms),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where stars >= 4) / count(*))::int end from fb),
         (select case when count(recommend) = 0 then null
                      else round(100.0 * count(*) filter (where recommend) / count(recommend))::int end from fb),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where n >= 2) / count(*))::int end from learners);
$$;

grant execute on function public.mentor_performance(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The digest: strengths and improvements, read off the criteria
-- ---------------------------------------------------------------------------
-- Aggregates over opened ratings only. `kind` is strength (average 4.5+ with
-- at least three ratings behind it) or improve (below 4). Nothing about the
-- person is inferred beyond what the criteria say.
create or replace function public.feedback_digest(p_profile uuid)
returns table (source text, criterion text, stars_avg numeric, rated integer, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select 'session'::text as source, sc.criterion::text as criterion, sc.stars
      from public.session_feedback_scores sc
      join public.session_feedback sf on sf.id = sc.feedback_id
     where sf.to_profile = p_profile and public.session_feedback_is_open(sf.booking_id)
    union all
    select 'work', cs.criterion::text, cs.stars
      from public.client_review_scores cs
      join public.client_reviews cr on cr.id = cs.review_id
     where cr.worker_id = p_profile
    union all
    select 'as_client', ws.criterion::text, ws.stars
      from public.worker_review_scores ws
      join public.worker_reviews wr on wr.id = ws.review_id
     where wr.client_id = p_profile
  )
  select source, criterion, round(avg(stars), 2), count(*)::int,
         case when avg(stars) >= 4.5 and count(*) >= 3 then 'strength'
              when avg(stars) < 4 then 'improve'
              else 'steady' end
    from scores
   group by source, criterion
   order by source, avg(stars) desc;
$$;

grant execute on function public.feedback_digest(uuid) to anon, authenticated;

-- The written answers behind the digest: for the person they are about, and
-- for admins. This is what an AI summary is allowed to read.
create or replace function public.feedback_texts(p_profile uuid)
returns table (source text, stars smallint, recommend boolean, liked_ar text, improve_ar text, comment_ar text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select 'session'::text, sf.stars, sf.recommend, sf.liked_ar, sf.improve_ar, sf.comment_ar, sf.created_at
      from public.session_feedback sf
     where sf.to_profile = p_profile and public.session_feedback_is_open(sf.booking_id)
    union all
    select 'work', cr.stars, cr.recommend, cr.liked_ar, cr.improve_ar, cr.comment_ar, cr.created_at
      from public.client_reviews cr where cr.worker_id = p_profile
    union all
    select 'as_client', wr.stars, wr.recommend, wr.liked_ar, wr.improve_ar, wr.comment_ar, wr.created_at
      from public.worker_reviews wr where wr.client_id = p_profile
  ) t
   where p_profile = (select auth.uid()) or public.is_admin()
   order by 7 desc
   limit 100;
$$;

grant execute on function public.feedback_texts(uuid) to authenticated;

create or replace function public.course_feedback_texts(p_course uuid)
returns table (stars smallint, recommend boolean, liked_ar text, improve_ar text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select cf.stars, cf.recommend, cf.liked_ar, cf.improve_ar, cf.created_at
    from public.course_feedback cf
   where cf.course_id = p_course and public.is_admin()
   order by cf.created_at desc
   limit 200;
$$;

grant execute on function public.course_feedback_texts(uuid) to authenticated;
