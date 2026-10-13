-- ============================================================================
-- 0170 — The members a team is looking for
--
-- A leader says, while creating the team or later, which people it still
-- needs: a role («مطوّر واجهات»), how many, the skills that fit. Open seats of
-- listed teams make up the «teams looking for members» board; a member applies
-- for one seat, and the leader sees which seat each request is for. A seat is
-- closed by hand, or on its own once enough people were accepted for it.
-- ============================================================================

create table public.team_openings (
  id          uuid primary key default extensions.gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  role_ar     text not null check (char_length(btrim(role_ar)) between 2 and 60),
  seats       smallint not null default 1 check (seats between 1 and 10),
  skills      text[] not null default '{}' check (cardinality(skills) <= 8),
  note_ar     text check (note_ar is null or char_length(note_ar) <= 300),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

create index team_openings_team_idx on public.team_openings (team_id) where is_open;

alter table public.team_applications
  add column opening_id uuid references public.team_openings (id) on delete set null;
create index team_applications_opening_idx on public.team_applications (opening_id);

alter table public.team_openings enable row level security;
-- what a team needs is as visible as the team itself
create policy team_openings_read on public.team_openings for select to authenticated
  using (exists (select 1 from public.teams tm where tm.id = team_id
                  and (tm.visibility = 'listed' or tm.leader_id = (select auth.uid())
                       or public.is_team_member(tm.id) or public.is_admin())));
create policy team_openings_write on public.team_openings for all to authenticated
  using (public.is_team_leader(team_id) or public.is_admin())
  with check (public.is_team_leader(team_id) or public.is_admin());
revoke all on public.team_openings from anon, authenticated;
grant select, insert, update, delete on public.team_openings to authenticated;

-- Applying for one seat: the usual join request, with the seat on it.
create or replace function public.apply_to_team_opening(p_opening uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open public.team_openings%rowtype;
  v_id   uuid;
begin
  select * into v_open from public.team_openings where id = p_opening;
  if not found or not v_open.is_open then
    raise exception 'هذا المقعد لم يعد متاحاً';
  end if;
  v_id := public.request_to_join_team(v_open.team_id, p_message);
  update public.team_applications set opening_id = v_open.id, role_wanted = v_open.role_ar where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.apply_to_team_opening(uuid, text) from public, anon;
grant execute on function public.apply_to_team_opening(uuid, text) to authenticated;

-- The board: open seats of listed teams that take requests, newest first,
-- with how many were already accepted for each and whether I asked.
create or replace function public.team_openings_board(p_limit integer default 30)
returns table (
  opening_id uuid, team_id uuid, team_title text, team_kind text, team_focus text, leader_name text,
  members integer, role_ar text, seats integer, filled integer, skills text[], note_ar text,
  my_status text, my_opening uuid, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, tm.id, tm.title_ar, tm.kind::text, tm.focus_ar,
         (select coalesce(p.display_name, p.full_name) from public.profiles p where p.id = tm.leader_id),
         (select count(*)::int from public.team_members m where m.team_id = tm.id and coalesce(m.is_active, true)),
         o.role_ar, o.seats,
         (select count(*)::int from public.team_applications a where a.opening_id = o.id and a.status = 'accepted'),
         o.skills, o.note_ar,
         (select a.status::text from public.team_applications a
           where a.team_id = tm.id and a.profile_id = (select auth.uid())),
         (select a.opening_id from public.team_applications a
           where a.team_id = tm.id and a.profile_id = (select auth.uid())),
         o.created_at
    from public.team_openings o
    join public.teams tm on tm.id = o.team_id
   where (select auth.uid()) is not null
     and o.is_open and tm.is_open
     and tm.visibility = 'listed' and tm.join_policy = 'request_allowed'
     and tm.status = 'active'
   order by o.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function public.team_openings_board(integer) from public, anon;
grant execute on function public.team_openings_board(integer) to authenticated;

-- A seat fills itself: once as many people as it wanted were accepted for it.
create or replace function public.close_filled_opening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and new.opening_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    update public.team_openings o set is_open = false
     where o.id = new.opening_id
       and (select count(*) from public.team_applications a
             where a.opening_id = o.id and a.status = 'accepted') >= o.seats;
  end if;
  return new;
end;
$$;

revoke execute on function public.close_filled_opening() from public, anon, authenticated;

create trigger team_applications_fill_opening after insert or update of status on public.team_applications
  for each row execute function public.close_filled_opening();
