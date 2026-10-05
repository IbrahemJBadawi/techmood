-- =============================================================================
-- 0128 — Progress you can see, follow and race: activity, achievements,
--        a feed of the people you follow, and the week's challenges
--
-- * Achievements were defined (0002) but nothing ever awarded them. They are
--   awarded here, by the events that earn them, once each; past members get
--   theirs quietly (no notification for something done long ago).
-- * An achievement is announced to its member, and to the members who follow
--   them (the follow is how someone asks to hear about another's progress).
-- * following_feed(): what the people I follow finished lately — lessons (one
--   line a day, not one per lesson), approved work, certificates, achievements,
--   projects put on show. Only things a member's profile already shows.
-- * my_challenges(): the week's four challenges with progress. Finishing all
--   four in a week earns "Week champion", once per week.
-- * following_week(): me against the people I follow, by this week's XP.
-- * my_activity(): one row a day — XP and what was done — for the home charts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The achievements, in both languages
-- ---------------------------------------------------------------------------
alter table public.achievements
  add column name_en        text,
  add column description_en text,
  add column sort_order     integer not null default 100;

update public.achievements as a
   set name_en = v.name_en, description_en = v.description_en, icon = coalesce(a.icon, v.icon), sort_order = v.sort
  from (values
    ('first_submission', 'First hand-in',      'Handed in your first piece of work.',       '📤', 3),
    ('first_five_stars', 'First five stars',   'A mentor gave your work five stars.',        '⭐', 6),
    ('joined_team',      'Team player',        'Joined your first team.',                    '👥', 5),
    ('first_certificate','First certificate',  'Earned your first TechMood certificate.',    '🎓', 8)
  ) as v(slug, name_en, description_en, icon, sort)
 where a.slug = v.slug;

insert into public.achievements (slug, name_ar, name_en, description_ar, description_en, icon, sort_order) values
  ('first_lesson',          'أول درس',          'First lesson',        'أنهيت أول درس لك.',                          'Finished your first lesson.',               '📘', 1),
  ('lessons_10',            '10 دروس',          '10 lessons',          'أنهيت عشرة دروس.',                           'Finished ten lessons.',                     '📚', 2),
  ('lessons_50',            '50 درساً',         '50 lessons',          'أنهيت خمسين درساً.',                         'Finished fifty lessons.',                   '🏛️', 9),
  ('streak_7',              'أسبوع متواصل',     'Seven-day streak',    'تعلّمت سبعة أيام متتالية.',                   'Learned seven days in a row.',              '🔥', 4),
  ('streak_30',             'شهر متواصل',       'Thirty-day streak',   'تعلّمت ثلاثين يوماً متتالية.',                'Learned thirty days in a row.',             '🌋', 10),
  ('first_gallery_project', 'في المعرض',        'On show',             'وضعت أول مشروع لك في معرض TechMood.',        'Put your first project in the TechMood gallery.', '🖼️', 7),
  ('week_champion',         'بطل الأسبوع',      'Week champion',       'أنهيت تحديات الأسبوع الأربعة.',               'Finished all four of the week’s challenges.', '🏆', 11)
on conflict (slug) do nothing;

-- A week champion can be one again next week.
alter table public.profile_achievements
  add column times integer not null default 1,
  add column last_awarded_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. Awarding one, and telling the member and their followers
-- ---------------------------------------------------------------------------
create or replace function public.award_achievement(p_profile uuid, p_slug text, p_quiet boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ach   public.achievements%rowtype;
  v_new   boolean;
  v_who   record;
  r       record;
begin
  select * into v_ach from public.achievements where slug = p_slug;
  if not found or p_profile is null then
    return false;
  end if;

  insert into public.profile_achievements (profile_id, achievement_id)
  values (p_profile, v_ach.id)
  on conflict (profile_id, achievement_id) do nothing;
  v_new := found;

  if not v_new then
    -- only the weekly one repeats, once a week
    if p_slug <> 'week_champion' then
      return false;
    end if;
    update public.profile_achievements
       set times = times + 1, last_awarded_at = now()
     where profile_id = p_profile and achievement_id = v_ach.id
       and last_awarded_at < date_trunc('week', now());
    if not found then
      return false;
    end if;
  end if;

  if p_quiet then
    -- earned long ago: on the shelf, but not news in anyone's feed
    update public.profile_achievements
       set last_awarded_at = now() - interval '31 days'
     where profile_id = p_profile and achievement_id = v_ach.id and v_new;
    return true;
  end if;

  perform public.notify(p_profile, 'academy', coalesce(v_ach.icon, '🏅') || ' إنجاز جديد: ' || v_ach.name_ar,
    coalesce(v_ach.description_ar, 'أحسنت!'), '/home#achievements');

  select coalesce(p.display_name, p.full_name) as name, p.techmood_id into v_who
    from public.profiles p where p.id = p_profile;
  for r in
    select f.follower_id from public.follows f where f.followee_id = p_profile and f.active
  loop
    perform public.notify(r.follower_id, 'system',
      coalesce(v_ach.icon, '🏅') || ' ' || coalesce(v_who.name, 'عضو') || ' حقّق «' || v_ach.name_ar || '»',
      'ممّن تتابعهم — شاركه التهنئة على ملفه.', '/m/' || coalesce(v_who.techmood_id, ''));
  end loop;
  return true;
end;
$$;

revoke execute on function public.award_achievement(uuid, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The week's challenges
-- ---------------------------------------------------------------------------
create or replace function public.challenges_of(p_profile uuid)
returns table (key text, title_ar text, title_en text, icon text, goal integer, progress integer)
language sql
stable
security definer
set search_path = ''
as $$
  with wk as (select date_trunc('week', now()) as since)
  select 'lessons', 'أنهِ 5 دروس', 'Finish 5 lessons', '📘', 5,
         (select count(*)::int from public.lesson_progress lp, wk
           where lp.profile_id = p_profile and lp.status = 'completed' and lp.completed_at >= wk.since)
  union all
  select 'days', 'تعلّم في 4 أيام مختلفة', 'Learn on 4 different days', '📅', 4,
         (select count(distinct (lp.completed_at at time zone 'Asia/Jerusalem')::date)::int
            from public.lesson_progress lp, wk
           where lp.profile_id = p_profile and lp.status = 'completed' and lp.completed_at >= wk.since)
  union all
  select 'xp', 'اجمع 60 نقطة XP', 'Earn 60 XP', '⚡', 60,
         (select coalesce(sum(x.xp), 0)::int from public.xp_events x, wk
           where x.profile_id = p_profile and x.created_at >= wk.since)
  union all
  select 'handin', 'سلّم عملاً واحداً', 'Hand in one piece of work', '📤', 1,
         (select count(*)::int from public.submissions s, wk
           where s.profile_id = p_profile and s.status <> 'draft' and s.updated_at >= wk.since);
$$;

revoke execute on function public.challenges_of(uuid) from public, anon, authenticated;

create or replace function public.my_challenges()
returns table (key text, title_ar text, title_en text, icon text, goal integer, progress integer,
               week_ends timestamptz, days_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.*, date_trunc('week', now()) + interval '7 days',
         ceil(extract(epoch from (date_trunc('week', now()) + interval '7 days' - now())) / 86400)::int
    from public.challenges_of((select auth.uid())) c;
$$;

revoke execute on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. What earns what
-- ---------------------------------------------------------------------------
create or replace function public.check_progress_achievements(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lessons integer;
  v_streak  integer;
begin
  select count(*) into v_lessons from public.lesson_progress
   where profile_id = p_profile and status = 'completed';
  if v_lessons >= 1  then perform public.award_achievement(p_profile, 'first_lesson'); end if;
  if v_lessons >= 10 then perform public.award_achievement(p_profile, 'lessons_10'); end if;
  if v_lessons >= 50 then perform public.award_achievement(p_profile, 'lessons_50'); end if;

  v_streak := public.streak_of(p_profile);
  if v_streak >= 7  then perform public.award_achievement(p_profile, 'streak_7'); end if;
  if v_streak >= 30 then perform public.award_achievement(p_profile, 'streak_30'); end if;

  if not exists (select 1 from public.challenges_of(p_profile) c where c.progress < c.goal) then
    perform public.award_achievement(p_profile, 'week_champion');
  end if;
end;
$$;

revoke execute on function public.check_progress_achievements(uuid) from public, anon, authenticated;

create or replace function public.achievements_on_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform public.check_progress_achievements(new.profile_id);
  end if;
  return null;
end;
$$;

create trigger lesson_progress_achievements
  after insert or update of status on public.lesson_progress
  for each row execute function public.achievements_on_lesson();

create or replace function public.achievements_on_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.challenges_of(new.profile_id) c where c.progress < c.goal) then
    perform public.award_achievement(new.profile_id, 'week_champion');
  end if;
  return null;
end;
$$;

create trigger xp_events_achievements
  after insert on public.xp_events
  for each row execute function public.achievements_on_xp();

create or replace function public.achievements_on_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    perform public.award_achievement(new.profile_id, 'first_submission');
    perform public.check_progress_achievements(new.profile_id);
  end if;
  return null;
end;
$$;

create trigger submissions_achievements
  after insert or update of status on public.submissions
  for each row execute function public.achievements_on_submission();

create or replace function public.achievements_on_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decision = 'approved' and new.stars = 5 then
    perform public.award_achievement((select s.profile_id from public.submissions s where s.id = new.submission_id),
                                     'first_five_stars');
  end if;
  return null;
end;
$$;

create trigger evaluations_achievements
  after insert on public.evaluations
  for each row execute function public.achievements_on_evaluation();

create or replace function public.achievements_on_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievement(new.profile_id, 'joined_team');
  return null;
end;
$$;

create trigger team_members_achievements
  after insert on public.team_members
  for each row execute function public.achievements_on_team();

create or replace function public.achievements_on_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    perform public.award_achievement(new.profile_id, 'first_certificate');
  end if;
  return null;
end;
$$;

create trigger certificates_achievements
  after insert on public.certificates
  for each row execute function public.achievements_on_certificate();

create or replace function public.achievements_on_gallery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.in_gallery and not coalesce(old.in_gallery, false) and new.owner_id is not null then
    perform public.award_achievement(new.owner_id, 'first_gallery_project');
  end if;
  return null;
end;
$$;

create trigger projects_gallery_achievements
  after update of in_gallery on public.projects
  for each row execute function public.achievements_on_gallery();

revoke execute on function public.achievements_on_lesson()      from public, anon, authenticated;
revoke execute on function public.achievements_on_xp()          from public, anon, authenticated;
revoke execute on function public.achievements_on_submission()  from public, anon, authenticated;
revoke execute on function public.achievements_on_evaluation()  from public, anon, authenticated;
revoke execute on function public.achievements_on_team()        from public, anon, authenticated;
revoke execute on function public.achievements_on_certificate() from public, anon, authenticated;
revoke execute on function public.achievements_on_gallery()     from public, anon, authenticated;

-- What members earned before today, without a notification for each.
do $backfill$
declare
  r record;
begin
  for r in select distinct profile_id from public.submissions where status <> 'draft' loop
    perform public.award_achievement(r.profile_id, 'first_submission', true);
  end loop;
  for r in select distinct s.profile_id from public.evaluations e join public.submissions s on s.id = e.submission_id
            where e.decision = 'approved' and e.stars = 5 loop
    perform public.award_achievement(r.profile_id, 'first_five_stars', true);
  end loop;
  for r in select distinct profile_id from public.team_members loop
    perform public.award_achievement(r.profile_id, 'joined_team', true);
  end loop;
  for r in select distinct profile_id from public.certificates where status = 'active' loop
    perform public.award_achievement(r.profile_id, 'first_certificate', true);
  end loop;
  for r in select distinct owner_id as profile_id from public.projects where in_gallery and owner_id is not null loop
    perform public.award_achievement(r.profile_id, 'first_gallery_project', true);
  end loop;
  for r in select profile_id, count(*) as n from public.lesson_progress where status = 'completed' group by 1 loop
    perform public.award_achievement(r.profile_id, 'first_lesson', true);
    if r.n >= 10 then perform public.award_achievement(r.profile_id, 'lessons_10', true); end if;
    if r.n >= 50 then perform public.award_achievement(r.profile_id, 'lessons_50', true); end if;
  end loop;
end
$backfill$;

-- A member's achievements, earned and still ahead, for their home.
create or replace function public.my_achievements()
returns table (slug text, name_ar text, name_en text, description_ar text, description_en text,
               icon text, awarded_at timestamptz, times integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.slug, a.name_ar, a.name_en, a.description_ar, a.description_en, a.icon, pa.awarded_at, pa.times
    from public.achievements a
    left join public.profile_achievements pa
      on pa.achievement_id = a.id and pa.profile_id = (select auth.uid())
   order by (pa.awarded_at is null), a.sort_order;
$$;

revoke execute on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The people I follow: their progress, and this week's race
-- ---------------------------------------------------------------------------
create or replace function public.following_feed(p_limit integer default 20)
returns table (kind text, happened_at timestamptz, techmood_id text, name text, avatar_url text,
               title text, detail text, link text)
language sql
stable
security definer
set search_path = ''
as $$
  with them as (
    select f.followee_id as id from public.follows f
     where f.follower_id = (select auth.uid()) and f.active
  ),
  events as (
    -- lessons: one line per person per day
    select 'lessons' as kind, max(lp.completed_at) as at, lp.profile_id as who,
           count(*)::text as title, null::text as detail, null::text as link
      from public.lesson_progress lp join them on them.id = lp.profile_id
     where lp.status = 'completed' and lp.completed_at > now() - interval '30 days'
     group by lp.profile_id, (lp.completed_at at time zone 'Asia/Jerusalem')::date
    union all
    select 'achievement', pa.last_awarded_at, pa.profile_id, a.name_ar, a.icon, null
      from public.profile_achievements pa join them on them.id = pa.profile_id
      join public.achievements a on a.id = pa.achievement_id
     where pa.last_awarded_at > now() - interval '30 days'
    union all
    select 'certificate', c.issued_at, c.profile_id,
           coalesce((select co.title_ar from public.courses co where co.id = c.course_id),
                    (select lpth.title_ar from public.learning_paths lpth where lpth.id = c.path_id)),
           c.kind::text, '/verify/' || c.certificate_code
      from public.certificates c join them on them.id = c.profile_id
     where c.status = 'active' and c.issued_at > now() - interval '30 days'
    union all
    select 'approved', e.created_at, s.profile_id, a.title_ar, e.stars::text, null
      from public.evaluations e
      join public.submissions s on s.id = e.submission_id
      join them on them.id = s.profile_id
      join public.assignments a on a.id = s.assignment_id
     where e.decision = 'approved' and e.created_at > now() - interval '30 days'
    union all
    select 'project', p.gallery_at, p.owner_id, p.title_ar, p.tagline_ar, '/p/' || p.code
      from public.projects p join them on them.id = p.owner_id
     where p.in_gallery and p.gallery_hidden_at is null and p.gallery_at > now() - interval '30 days'
  )
  select e.kind, e.at, pr.techmood_id, coalesce(pr.display_name, pr.full_name), pr.avatar_url,
         e.title, e.detail, e.link
    from events e join public.profiles pr on pr.id = e.who
   order by e.at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.following_feed(integer) from public, anon;
grant execute on function public.following_feed(integer) to authenticated;

create or replace function public.following_week()
returns table (rank integer, techmood_id text, name text, avatar_url text, xp integer, streak integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select (select auth.uid()) as id
    union
    select f.followee_id from public.follows f
     where f.follower_id = (select auth.uid()) and f.active
  ),
  scored as (
    select pe.id,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = pe.id and x.created_at >= date_trunc('week', now())), 0)::int as xp
      from people pe
  )
  select (rank() over (order by s.xp desc))::int, pr.techmood_id, coalesce(pr.display_name, pr.full_name),
         pr.avatar_url, s.xp, public.streak_of(s.id), s.id = (select auth.uid())
    from scored s join public.profiles pr on pr.id = s.id
   order by s.xp desc, pr.full_name
   limit 10;
$$;

revoke execute on function public.following_week() from public, anon;
grant execute on function public.following_week() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The home charts: one row a day
-- ---------------------------------------------------------------------------
create or replace function public.my_activity(p_days integer default 91)
returns table (on_date date, xp integer, lessons integer, acts integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  span as (
    select ((now() at time zone 'Asia/Jerusalem')::date - (least(greatest(coalesce(p_days, 91), 7), 371) - 1)) as since,
           (now() at time zone 'Asia/Jerusalem')::date as until
  )
  select g.d::date,
         coalesce((select sum(x.xp) from public.xp_events x, me
                    where x.profile_id = me.id and (x.created_at at time zone 'Asia/Jerusalem')::date = g.d::date), 0)::int,
         coalesce((select count(*) from public.lesson_progress lp, me
                    where lp.profile_id = me.id and lp.status = 'completed'
                      and (lp.completed_at at time zone 'Asia/Jerusalem')::date = g.d::date), 0)::int,
         coalesce((select cardinality(a.sources) from public.activity_days(g.d::date, g.d::date) a), 0)::int
    from span, generate_series(span.since, span.until, interval '1 day') g(d)
   order by 1;
$$;

revoke execute on function public.my_activity(integer) from public, anon;
grant execute on function public.my_activity(integer) to authenticated;
