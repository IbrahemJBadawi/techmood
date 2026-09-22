-- =============================================================================
-- 0051 — An application carries a proposal, and says what it shares
--
-- 0050 gave `opportunity_applications` three columns it could not fill: what
-- the applicant proposes to charge, how long they think it takes, and which
-- parts of their identity they are putting in front of this poster. They are
-- part of applying, not a second step afterwards, so `apply_to_opportunity()`
-- takes them.
--
-- The third one is the point of the whole market: applying with a TechMood
-- identity rather than a CV means choosing what of it to share — and a
-- deliberate choice is only meaningful if it is recorded.
-- =============================================================================

drop function if exists public.apply_to_opportunity(uuid, text);

create or replace function public.apply_to_opportunity(
  p_opportunity uuid,
  p_cover       text default null,
  p_amount      numeric default null,
  p_days        integer default null,
  p_sections    text[] default '{}'
)
returns public.opportunity_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := (select auth.uid());
  v_opportunity public.opportunities%rowtype;
  v_team_app    uuid;
  v_application public.opportunity_applications%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select * into v_opportunity from public.opportunities where id = p_opportunity;
  if not found then
    raise exception 'opportunity % not found', p_opportunity;
  end if;

  if v_opportunity.status <> 'published' then
    raise exception 'this opportunity is not open for applications';
  end if;

  if v_opportunity.closes_on is not null and v_opportunity.closes_on < current_date then
    raise exception 'applications for this opportunity have closed';
  end if;

  if v_opportunity.filled_count >= v_opportunity.seats then
    raise exception 'this opportunity has been filled';
  end if;

  if v_opportunity.posted_by = v_me then
    raise exception 'you cannot apply to your own posting';
  end if;

  -- A team seat is the team's decision, made where the leader already works.
  if v_opportunity.kind = 'team_seat' and v_opportunity.team_id is not null then
    if public.is_team_member(v_opportunity.team_id) then
      raise exception 'you are already a member of this team';
    end if;

    insert into public.team_applications (team_id, profile_id, role_wanted, message_ar)
    values (v_opportunity.team_id, v_me, v_opportunity.title_ar, p_cover)
    on conflict (team_id, profile_id) do update set message_ar = excluded.message_ar
    returning id into v_team_app;
  end if;

  insert into public.opportunity_applications
    (opportunity_id, profile_id, cover_note_ar, team_application_id,
     proposed_amount_usd, proposed_days, shared_sections)
  values (
    p_opportunity, v_me, p_cover, v_team_app,
    case when p_amount is null then null else greatest(0, p_amount) end,
    case when p_days is null then null else least(365, greatest(1, p_days)) end,
    coalesce(p_sections, '{}')
  )
  returning * into v_application;

  perform public.notify(
    v_opportunity.posted_by,
    'system',
    'طلب جديد على: ' || v_opportunity.title_ar,
    case when p_amount is null then null
         else 'عرض بقيمة ' || p_amount::text || ' دولار' end,
    '/marketplace/' || p_opportunity
  );

  return v_application;
end;
$$;

grant execute on function public.apply_to_opportunity(uuid, text, numeric, integer, text[]) to authenticated;
