-- ============================================================================
-- 0164 — A standing survey about the experience of TechMood
--
-- A card on the home page and the academy invites every member to a short
-- survey: how easy the platform is, how likely they are to recommend it, what
-- they use most, what gets in their way, and what they would add. It stays
-- until they answer, then comes back after 90 days — so the numbers keep
-- moving with the platform. Answers are private to the member and the
-- admins; the admin page reads them only as totals, plus the suggestions.
-- ============================================================================

create table public.ux_survey_responses (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        text,
  ease        smallint not null check (ease between 1 and 5),
  recommend   smallint not null check (recommend between 0 and 10),
  most_used   text check (most_used is null or most_used in
                ('academy', 'mentors', 'teams', 'gallery', 'market', 'messages', 'ai', 'profile', 'other')),
  pains       text[] not null default '{}'
                check (pains <@ array['slow', 'confusing', 'mobile', 'content', 'prices', 'mentors', 'bugs', 'language', 'nothing']),
  suggestion  text check (suggestion is null or char_length(suggestion) <= 1000),
  created_at  timestamptz not null default now()
);

create index ux_survey_profile_idx on public.ux_survey_responses (profile_id, created_at desc);
create index ux_survey_created_idx on public.ux_survey_responses (created_at desc);

alter table public.ux_survey_responses enable row level security;
create policy ux_survey_own on public.ux_survey_responses for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
revoke all on public.ux_survey_responses from anon, authenticated;
grant select on public.ux_survey_responses to authenticated;

-- Should this member be invited now? Never answered, or last answered 90+ days ago.
create or replace function public.ux_survey_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.ux_survey_responses r
     where r.profile_id = (select auth.uid()) and r.created_at > now() - interval '90 days');
$$;

revoke execute on function public.ux_survey_due() from public, anon;
grant execute on function public.ux_survey_due() to authenticated;

create or replace function public.submit_ux_survey(
  p_ease smallint, p_recommend smallint, p_most_used text, p_pains text[], p_suggestion text, p_role text default null
)
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
  if not public.ux_survey_due() then
    raise exception 'شكراً — أجبت على الاستبيان مؤخراً، ونعود إليك بعد 90 يوماً';
  end if;
  insert into public.ux_survey_responses (profile_id, role, ease, recommend, most_used, pains, suggestion)
  values (v_me, nullif(p_role, ''), p_ease, p_recommend, nullif(p_most_used, ''),
          coalesce(p_pains, '{}'), nullif(btrim(coalesce(p_suggestion, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_ux_survey(smallint, smallint, text, text[], text, text) from public, anon;
grant execute on function public.submit_ux_survey(smallint, smallint, text, text[], text, text) to authenticated;

-- The admin's view: totals only, over a window.
create or replace function public.ux_survey_stats(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 90), 1));
  v_out   jsonb;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  with r as (select * from public.ux_survey_responses where created_at >= v_since)
  select jsonb_build_object(
    'responses', (select count(*) from r),
    'all_time', (select count(*) from public.ux_survey_responses),
    'ease_avg', (select round(avg(ease)::numeric, 2) from r),
    'recommend_avg', (select round(avg(recommend)::numeric, 1) from r),
    'nps', (select case when count(*) = 0 then null else
              round(100.0 * (count(*) filter (where recommend >= 9) - count(*) filter (where recommend <= 6)) / count(*)) end
              from r),
    'promoters', (select count(*) filter (where recommend >= 9) from r),
    'passives', (select count(*) filter (where recommend between 7 and 8) from r),
    'detractors', (select count(*) filter (where recommend <= 6) from r),
    'ease', (select coalesce(jsonb_object_agg(e::text, (select count(*) from r where r.ease = e)), '{}')
               from generate_series(1, 5) e),
    'most_used', (select coalesce(jsonb_object_agg(most_used, n), '{}')
                    from (select most_used, count(*) n from r where most_used is not null group by 1) x),
    'pains', (select coalesce(jsonb_object_agg(p, n), '{}')
                from (select unnest(pains) p, count(*) n from r group by 1) x),
    'roles', (select coalesce(jsonb_object_agg(coalesce(role, '—'), n), '{}')
                from (select role, count(*) n from r group by 1) x),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'n', n, 'ease', e) order by w), '[]')
                 from (select date_trunc('week', created_at)::date w, count(*) n, round(avg(ease)::numeric, 2) e
                         from r group by 1) x),
    'suggestions', (select coalesce(jsonb_agg(jsonb_build_object('text', suggestion, 'ease', ease, 'recommend', recommend,
                                                                   'role', role, 'at', created_at) order by created_at desc), '[]')
                      from (select * from r where suggestion is not null order by created_at desc limit 50) s)
  ) into v_out;
  return v_out;
end;
$$;

revoke execute on function public.ux_survey_stats(integer) from public, anon;
grant execute on function public.ux_survey_stats(integer) to authenticated;
