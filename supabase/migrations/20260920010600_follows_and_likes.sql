-- =============================================================================
-- 0106 — Following people, liking projects
--
-- The MVP's social layer, kept small on purpose:
--   * a member follows another member — a student, a mentor, a mentee; the
--     person followed is told the first time, never again for the same
--     follower however often they unfollow and follow back;
--   * a member likes a project they can see, but not their own or their
--     team's — a like is somebody else's opinion; the owner is told once per
--     person, the same way.
--
-- Counts are public (a profile or a project page shows them to anybody);
-- who follows whom, and who liked what, is visible to the two people it
-- concerns and to the admins, and to nobody else.
--
-- A row is never deleted when somebody changes their mind — `active` goes
-- false — which is what makes "told once" hold.
-- =============================================================================

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  changed_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id) where active;

alter table public.follows enable row level security;

create policy follows_read on public.follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()) or public.is_admin());

grant select on public.follows to authenticated;
revoke all on public.follows from anon;
revoke insert, update, delete on public.follows from authenticated;

create table public.project_likes (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create index project_likes_profile_idx on public.project_likes (profile_id) where active;

alter table public.project_likes enable row level security;

create policy project_likes_read on public.project_likes
  for select to authenticated
  using (profile_id = (select auth.uid())
         or exists (select 1 from public.projects p
                     where p.id = project_id
                       and (p.owner_id = (select auth.uid())
                            or (p.team_id is not null and public.is_team_member(p.team_id))))
         or public.is_admin());

grant select on public.project_likes to authenticated;
revoke all on public.project_likes from anon;
revoke insert, update, delete on public.project_likes from authenticated;

-- ---------------------------------------------------------------------------
-- Following
-- ---------------------------------------------------------------------------
create or replace function public.toggle_follow(p_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_row   public.follows%rowtype;
  v_name  text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_profile = v_me then
    raise exception 'لا يمكنك متابعة نفسك';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'الحساب غير موجود';
  end if;

  select * into v_row from public.follows
   where follower_id = v_me and followee_id = p_profile for update;

  if not found then
    insert into public.follows (follower_id, followee_id) values (v_me, p_profile);
    select coalesce(display_name, full_name) into v_name from public.profiles where id = v_me;
    perform public.notify(p_profile, 'system', 'متابع جديد',
      coalesce(v_name, 'عضو') || ' بدأ بمتابعتك.',
      '/u/' || coalesce((select techmood_id from public.profiles where id = v_me), ''));
    return true;
  end if;

  update public.follows
     set active = not v_row.active, changed_at = now()
   where follower_id = v_me and followee_id = p_profile;
  return not v_row.active;
end;
$$;

revoke execute on function public.toggle_follow(uuid) from public, anon;
grant execute on function public.toggle_follow(uuid) to authenticated;

create or replace function public.follow_stats(p_profile uuid)
returns table (followers integer, following integer, i_follow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer from public.follows where followee_id = p_profile and active),
         (select count(*)::integer from public.follows where follower_id = p_profile and active),
         coalesce((select active from public.follows
                    where follower_id = (select auth.uid()) and followee_id = p_profile), false);
$$;

revoke execute on function public.follow_stats(uuid) from public;
grant execute on function public.follow_stats(uuid) to anon, authenticated;

-- The people I follow, newest first.
create or replace function public.my_following()
returns table (profile_id uuid, full_name text, techmood_id text, avatar_url text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.display_name, p.full_name), p.techmood_id, p.avatar_url, f.changed_at
    from public.follows f
    join public.profiles p on p.id = f.followee_id
   where f.follower_id = (select auth.uid()) and f.active
   order by f.changed_at desc;
$$;

revoke execute on function public.my_following() from public, anon;
grant execute on function public.my_following() to authenticated;

-- ---------------------------------------------------------------------------
-- Liking a project
-- ---------------------------------------------------------------------------
create or replace function public.toggle_project_like(p_project uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_p    public.projects%rowtype;
  v_row  public.project_likes%rowtype;
  v_name text;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_p from public.projects where id = p_project;
  if not found or not (v_p.is_public or public.is_admin()) then
    raise exception 'المشروع غير موجود';
  end if;
  if v_p.owner_id = v_me or (v_p.team_id is not null and public.is_team_member(v_p.team_id)) then
    raise exception 'الإعجاب لمشاريع الآخرين — لا لمشروعك أو مشروع فريقك';
  end if;

  select * into v_row from public.project_likes
   where project_id = p_project and profile_id = v_me for update;

  if not found then
    insert into public.project_likes (project_id, profile_id) values (p_project, v_me);
    select coalesce(display_name, full_name) into v_name from public.profiles where id = v_me;
    perform public.notify(v_p.owner_id, 'project', 'أُعجب أحدهم بمشروعك',
      coalesce(v_name, 'عضو') || ' أُعجب بـ«' || v_p.title_ar || '».', '/projects/' || p_project::text);
    return true;
  end if;

  update public.project_likes
     set active = not v_row.active, changed_at = now()
   where project_id = p_project and profile_id = v_me;
  return not v_row.active;
end;
$$;

revoke execute on function public.toggle_project_like(uuid) from public, anon;
grant execute on function public.toggle_project_like(uuid) to authenticated;

create or replace function public.project_like_stats(p_projects uuid[])
returns table (project_id uuid, likes integer, i_like boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         (select count(*)::integer from public.project_likes l where l.project_id = p.id and l.active),
         coalesce((select l.active from public.project_likes l
                    where l.project_id = p.id and l.profile_id = (select auth.uid())), false)
    from public.projects p
   where p.id = any (p_projects)
     and (p.is_public or p.owner_id = (select auth.uid())
          or (p.team_id is not null and public.is_team_member(p.team_id)) or public.is_admin());
$$;

revoke execute on function public.project_like_stats(uuid[]) from public;
grant execute on function public.project_like_stats(uuid[]) to anon, authenticated;
