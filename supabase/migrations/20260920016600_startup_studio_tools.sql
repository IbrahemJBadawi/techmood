-- ============================================================================
-- 0166 — The Startup Studio, with its six tools (design lab 5)
--
-- The studio already had two of the six: the business plan (ten sections,
-- 0024) and the business model (the canvases, 0060). This adds the other
-- four, in the same room and under the same rules — the team edits, anyone
-- in the room reads, nobody outside sees any of it:
--
--   1. The market      — TAM, SAM, SOM, how they were reached, the trends.
--   2. The competitors — who else solves it, how, and where we are better;
--                        with a price/quality position for a simple map.
--   3. The users       — personas: who they are, what they want, what hurts,
--                        where to reach them, what they would pay.
--   4. Feasibility     — price, costs and growth in; break-even, a monthly
--                        projection and the month the money comes back out.
--
-- The studio opens (area_studio = on). Starting a startup is for Premium,
-- like the rest of TechMood Business (0165); joining one you were invited to
-- is not.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The market — one row per startup
-- ---------------------------------------------------------------------------
create table public.startup_market (
  startup_id     uuid primary key references public.startups (id) on delete cascade,
  segment_ar     text check (segment_ar is null or char_length(segment_ar) <= 600),
  tam_usd        numeric(16, 0) check (tam_usd is null or tam_usd >= 0),
  sam_usd        numeric(16, 0) check (sam_usd is null or sam_usd >= 0),
  som_usd        numeric(16, 0) check (som_usd is null or som_usd >= 0),
  method_ar      text check (method_ar is null or char_length(method_ar) <= 2000),
  trends_ar      text check (trends_ar is null or char_length(trends_ar) <= 2000),
  sources_ar     text check (sources_ar is null or char_length(sources_ar) <= 1000),
  -- where we stand on the competitors' map, 1 (low) to 5 (high)
  our_price      smallint check (our_price is null or our_price between 1 and 5),
  our_quality    smallint check (our_quality is null or our_quality between 1 and 5),
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  -- the three circles sit inside one another
  constraint startup_market_nested check (
    (sam_usd is null or tam_usd is null or sam_usd <= tam_usd)
    and (som_usd is null or sam_usd is null or som_usd <= sam_usd))
);

-- ---------------------------------------------------------------------------
-- 2. The competitors
-- ---------------------------------------------------------------------------
create table public.startup_competitors (
  id             uuid primary key default extensions.gen_random_uuid(),
  startup_id     uuid not null references public.startups (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  kind           text not null default 'direct' check (kind in ('direct', 'indirect', 'substitute')),
  website_url    text check (website_url is null or website_url ~ '^https?://'),
  pricing_ar     text check (pricing_ar is null or char_length(pricing_ar) <= 200),
  strengths_ar   text check (strengths_ar is null or char_length(strengths_ar) <= 1000),
  weaknesses_ar  text check (weaknesses_ar is null or char_length(weaknesses_ar) <= 1000),
  our_edge_ar    text check (our_edge_ar is null or char_length(our_edge_ar) <= 1000),
  price_level    smallint check (price_level is null or price_level between 1 and 5),
  quality_level  smallint check (quality_level is null or quality_level between 1 and 5),
  sort_order     integer not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index startup_competitors_startup_idx on public.startup_competitors (startup_id, sort_order);
create index startup_competitors_created_by_idx on public.startup_competitors (created_by);

-- ---------------------------------------------------------------------------
-- 3. The users
-- ---------------------------------------------------------------------------
create table public.startup_personas (
  id             uuid primary key default extensions.gen_random_uuid(),
  startup_id     uuid not null references public.startups (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 60),
  age_range      text check (age_range is null or char_length(age_range) <= 20),
  occupation_ar  text check (occupation_ar is null or char_length(occupation_ar) <= 120),
  goals_ar       text check (goals_ar is null or char_length(goals_ar) <= 1000),
  pains_ar       text check (pains_ar is null or char_length(pains_ar) <= 1000),
  channels_ar    text check (channels_ar is null or char_length(channels_ar) <= 600),
  quote_ar       text check (quote_ar is null or char_length(quote_ar) <= 300),
  pays_usd       numeric(10, 2) check (pays_usd is null or pays_usd >= 0),
  is_primary     boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index startup_personas_startup_idx on public.startup_personas (startup_id, created_at);
create index startup_personas_created_by_idx on public.startup_personas (created_by);

-- ---------------------------------------------------------------------------
-- 4. Feasibility — the numbers in; the projection is computed, never stored
-- ---------------------------------------------------------------------------
create table public.startup_feasibility (
  startup_id        uuid primary key references public.startups (id) on delete cascade,
  unit_ar           text check (unit_ar is null or char_length(unit_ar) <= 40),
  price_usd         numeric(12, 2) not null default 0 check (price_usd >= 0),
  variable_cost_usd numeric(12, 2) not null default 0 check (variable_cost_usd >= 0),
  fixed_monthly_usd numeric(12, 2) not null default 0 check (fixed_monthly_usd >= 0),
  startup_cost_usd  numeric(14, 2) not null default 0 check (startup_cost_usd >= 0),
  units_month1      integer not null default 0 check (units_month1 between 0 and 10000000),
  growth_pct        numeric(5, 2) not null default 0 check (growth_pct between -50 and 200),
  months            smallint not null default 12 check (months between 6 and 36),
  notes_ar          text check (notes_ar is null or char_length(notes_ar) <= 2000),
  updated_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create index startup_market_updated_by_idx on public.startup_market (updated_by);
create index startup_feasibility_updated_by_idx on public.startup_feasibility (updated_by);

create trigger startup_market_touch before update on public.startup_market
  for each row execute function public.touch_updated_at();
create trigger startup_competitors_touch before update on public.startup_competitors
  for each row execute function public.touch_updated_at();
create trigger startup_personas_touch before update on public.startup_personas
  for each row execute function public.touch_updated_at();
create trigger startup_feasibility_touch before update on public.startup_feasibility
  for each row execute function public.touch_updated_at();

-- Same rules as the plan and the SWOT: the room reads, the team writes.
alter table public.startup_market      enable row level security;
alter table public.startup_competitors enable row level security;
alter table public.startup_personas    enable row level security;
alter table public.startup_feasibility enable row level security;

create policy startup_market_view on public.startup_market for select to authenticated
  using (public.can_view_startup_workspace(startup_id));
create policy startup_market_edit on public.startup_market for all to authenticated
  using (public.can_edit_startup(startup_id)) with check (public.can_edit_startup(startup_id));

create policy startup_competitors_view on public.startup_competitors for select to authenticated
  using (public.can_view_startup_workspace(startup_id));
create policy startup_competitors_edit on public.startup_competitors for all to authenticated
  using (public.can_edit_startup(startup_id)) with check (public.can_edit_startup(startup_id));

create policy startup_personas_view on public.startup_personas for select to authenticated
  using (public.can_view_startup_workspace(startup_id));
create policy startup_personas_edit on public.startup_personas for all to authenticated
  using (public.can_edit_startup(startup_id)) with check (public.can_edit_startup(startup_id));

create policy startup_feasibility_view on public.startup_feasibility for select to authenticated
  using (public.can_view_startup_workspace(startup_id));
create policy startup_feasibility_edit on public.startup_feasibility for all to authenticated
  using (public.can_edit_startup(startup_id)) with check (public.can_edit_startup(startup_id));

revoke all on public.startup_market, public.startup_competitors, public.startup_personas, public.startup_feasibility
  from anon, authenticated;
grant select, insert, update, delete on
  public.startup_market, public.startup_competitors, public.startup_personas, public.startup_feasibility
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The projection: month by month, from the numbers above
-- ---------------------------------------------------------------------------
create or replace function public.feasibility_projection(p_startup uuid)
returns table (month integer, units integer, revenue numeric, variable_costs numeric, fixed_costs numeric,
               profit numeric, cumulative numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select * from public.startup_feasibility
     where startup_id = p_startup and public.can_view_startup_workspace(p_startup)
  ), m as (
    select g.m,
           least(round(f.units_month1 * power(1 + f.growth_pct / 100.0, g.m - 1)), 1000000000)::integer as units,
           f.price_usd, f.variable_cost_usd, f.fixed_monthly_usd, f.startup_cost_usd
      from f, generate_series(1, f.months) g(m)
  )
  select m.m, m.units,
         round(m.units * m.price_usd, 2),
         round(m.units * m.variable_cost_usd, 2),
         m.fixed_monthly_usd,
         round(m.units * (m.price_usd - m.variable_cost_usd) - m.fixed_monthly_usd, 2),
         round(sum(m.units * (m.price_usd - m.variable_cost_usd) - m.fixed_monthly_usd) over (order by m.m)
               - m.startup_cost_usd, 2)
    from m
   order by m.m;
$$;

revoke execute on function public.feasibility_projection(uuid) from public, anon;
grant execute on function public.feasibility_projection(uuid) to authenticated;

-- The headline: what a unit leaves after its own cost, how many a month pay
-- the fixed costs, and the month the startup costs come back.
create or replace function public.feasibility_summary(p_startup uuid)
returns table (margin_usd numeric, margin_pct numeric, breakeven_units integer, first_profit_month integer,
               payback_month integer, total_revenue numeric, total_profit numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select f.price_usd - f.variable_cost_usd,
         case when f.price_usd > 0 then round(100 * (f.price_usd - f.variable_cost_usd) / f.price_usd, 1) end,
         case when f.price_usd > f.variable_cost_usd
              then ceil(f.fixed_monthly_usd / (f.price_usd - f.variable_cost_usd))::integer end,
         (select min(p.month) from public.feasibility_projection(p_startup) p where p.profit > 0),
         (select min(p.month) from public.feasibility_projection(p_startup) p where p.cumulative >= 0),
         (select coalesce(sum(p.revenue), 0) from public.feasibility_projection(p_startup) p),
         (select coalesce(sum(p.profit), 0) from public.feasibility_projection(p_startup) p)
    from public.startup_feasibility f
   where f.startup_id = p_startup and public.can_view_startup_workspace(p_startup);
$$;

revoke execute on function public.feasibility_summary(uuid) from public, anon;
grant execute on function public.feasibility_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. How far along each of the six tools is — for the overview and the AI
-- ---------------------------------------------------------------------------
create or replace function public.studio_snapshot(p_startup uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.can_view_startup_workspace(p_startup) then null else jsonb_build_object(
    'market', (select jsonb_build_object('tam', m.tam_usd, 'sam', m.sam_usd, 'som', m.som_usd,
                                         'segment', m.segment_ar,
                                         'done', m.tam_usd is not null and m.sam_usd is not null and m.som_usd is not null)
                 from public.startup_market m where m.startup_id = p_startup),
    'competitors', (select count(*)::int from public.startup_competitors c where c.startup_id = p_startup),
    'competitor_names', (select coalesce(jsonb_agg(c.name order by c.sort_order, c.created_at), '[]'::jsonb)
                           from (select * from public.startup_competitors c where c.startup_id = p_startup limit 8) c),
    'personas', (select count(*)::int from public.startup_personas p where p.startup_id = p_startup),
    'primary_persona', (select jsonb_build_object('name', p.name, 'pains', p.pains_ar, 'pays_usd', p.pays_usd)
                          from public.startup_personas p where p.startup_id = p_startup
                         order by p.is_primary desc, p.created_at limit 1),
    'feasibility', (select to_jsonb(s) from public.feasibility_summary(p_startup) s),
    'plan_percent', coalesce((select bp.percent from public.business_plan_progress bp where bp.startup_id = p_startup), 0),
    'model_cards', (select count(*)::int from public.canvas_cards cc where cc.startup_id = p_startup)
  ) end;
$$;

revoke execute on function public.studio_snapshot(uuid) from public, anon;
grant execute on function public.studio_snapshot(uuid) to authenticated;

-- The assistant reads the same snapshot when it is asked about a startup.
do $rewrite$
declare
  v_def text;
begin
  select pg_get_functiondef('public.ai_context_core'::regproc) into v_def;
  v_def := replace(v_def,
    '''stage'', st.stage, ''in_incubator'', st.is_in_incubator,',
    '''stage'', st.stage, ''in_incubator'', st.is_in_incubator, ''studio'', public.studio_snapshot(st.id),');
  if position('public.studio_snapshot(st.id)' in v_def) = 0 then
    raise exception 'ai_context_core did not have the expected shape';
  end if;
  execute v_def;
end
$rewrite$;

-- ---------------------------------------------------------------------------
-- 7. Starting a startup is for Premium; the studio opens
-- ---------------------------------------------------------------------------
create or replace function public.startups_need_premium()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- a person starting one; the platform's own jobs (no caller) are not asked
  if (select auth.uid()) is not null
     and not public.is_premium((select auth.uid())) and not public.is_admin() then
    raise exception 'تأسيس مشروع ناشئ في Startup Studio لمشتركي Premium' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.startups_need_premium() from public, anon, authenticated;

create trigger startups_need_premium before insert on public.startups
  for each row execute function public.startups_need_premium();

update public.platform_settings set value = 'on' where key = 'area_studio';
