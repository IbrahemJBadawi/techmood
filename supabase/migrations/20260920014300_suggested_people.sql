-- 0143 — «اقتراحات للمتابعة»: people to follow, shown before anyone searches.
--
-- The follow graph (0106) and the following home (0128) assume you already
-- know whom to follow. New members don't, so «ابحث عن زملاء» opened an empty
-- search. This returns public profiles you don't follow yet, liveliest first
-- (active this month, then this week's XP), so there is always a starting point.
--
-- SECURITY DEFINER with an empty search_path: it reads across members, but only
-- ever returns is_public = true profiles — the same line the rest of the
-- platform holds — and never yourself or someone you already follow.
create or replace function public.suggested_people(p_limit integer default 12)
returns table (techmood_id text, name text, avatar_url text, headline text, xp integer, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select f.followee_id as id from public.follows f
     where f.follower_id = (select auth.uid()) and f.active
  ),
  cand as (
    select pr.id, pr.techmood_id, coalesce(pr.display_name, pr.full_name) as name,
           pr.avatar_url, pr.headline,
           coalesce((select sum(x.xp) from public.xp_events x
                      where x.profile_id = pr.id and x.created_at >= date_trunc('week', now())), 0)::int as xp,
           coalesce((select count(*) from public.lesson_progress lp
                      where lp.profile_id = pr.id and lp.status = 'completed'
                        and lp.completed_at > now() - interval '45 days'), 0) as recent,
           coalesce((select count(*) from public.follows f
                      where f.followee_id = pr.id and f.active), 0)::int as followers
      from public.profiles pr
     where pr.is_public
       and pr.id <> (select auth.uid())
       and pr.id not in (select id from mine)
  )
  select techmood_id, name, avatar_url, headline, xp, followers
    from cand
   order by (recent > 0) desc, xp desc, recent desc, followers desc, random()
   limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke execute on function public.suggested_people(integer) from public, anon;
grant execute on function public.suggested_people(integer) to authenticated;
