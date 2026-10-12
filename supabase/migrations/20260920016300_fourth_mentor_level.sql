-- ============================================================================
-- 0163 — A fourth mentor level with no ceiling, and 10$ the floor for all
--
-- The founder's decision:
--   🟢 Peer / Junior        10$ – 30$
--   🔵 Professional         10$ – 75$
--   🟣 Senior / Specialist  10$ – 150$
--   🟡 Expert / Elite       10$ – no ceiling
-- and no session, whatever its length, is priced under 10$.
--
-- «No ceiling» is an empty max_session_usd. Every place that read the band
-- already copes with it — least()/greatest() skip a null, and a comparison
-- with null never refuses — except the two messages that print the band,
-- which now say «بلا سقف».
-- ============================================================================

alter table public.mentor_levels drop constraint if exists mentor_levels_mvp_three;
alter table public.mentor_levels add constraint mentor_levels_mvp_three check (level in ('L1', 'L2', 'L3', 'L4'));
alter table public.mentor_profiles drop constraint if exists mentor_profiles_level_mvp;
alter table public.mentor_profiles add constraint mentor_profiles_level_mvp check (level in ('L1', 'L2', 'L3', 'L4'));
alter table public.mentor_levels alter column max_session_usd drop not null;

update public.mentor_levels set min_session_usd = 10 where min_session_usd <> 10;

insert into public.mentor_levels
  (level, title, badge, fits_ar, fits_en, min_session_usd, session_price_usd, max_session_usd,
   commission_pct, platform_share_usd, mentor_share_usd, min_sessions, min_rating, sort_order)
values
  ('L4', 'Expert / Elite', '🟡',
   'خبير معروف في مجاله أو قائد تقني: استشارات عالية القيمة، ومراجعات قرارات كبرى، وإرشاد قيادي — يحدّد سعره بلا سقف.',
   'A recognised expert or technical leader: high-value consulting, major decision reviews and leadership mentoring — prices without a ceiling.',
   10, 150, null, 30, 45, 105, 100, 4.7, 4)
on conflict (level) do update
  set title = excluded.title, badge = excluded.badge, fits_ar = excluded.fits_ar, fits_en = excluded.fits_en,
      min_session_usd = 10, max_session_usd = null, sort_order = 4;

comment on column public.mentor_levels.max_session_usd is
  'The top of the band per 60 minutes; empty means no ceiling (0163).';

-- No session under 10$, whatever its length; and the two messages that print
-- the band say «بلا سقف» when there is none. Rewritten from the live
-- definitions so nothing else in them changes.
do $rewrite$
declare
  v_def text;
begin
  select pg_get_functiondef('public.session_quote(uuid, uuid)'::regprocedure) into v_def;
  v_def := replace(v_def,
    'round(lv.min_session_usd   * st.duration_minutes / 60.0, 2) as lo',
    'greatest(10.00, round(lv.min_session_usd   * st.duration_minutes / 60.0, 2)) as lo');
  if position('greatest(10.00, round(lv.min_session_usd' in v_def) = 0 then
    raise exception 'session_quote did not have the expected shape';
  end if;
  execute v_def;

  select pg_get_functiondef('public.admin_place_mentor(uuid, public.mentor_level, text)'::regprocedure) into v_def;
  execute replace(v_def, '|| v_to.max_session_usd ||', '|| coalesce(v_to.max_session_usd::text, ''بلا سقف'') ||');

  select pg_get_functiondef('public.review_level_upgrade(uuid, boolean, text)'::regprocedure) into v_def;
  execute replace(v_def, '|| v_to.max_session_usd ||', '|| coalesce(v_to.max_session_usd::text, ''بلا سقف'') ||');
end
$rewrite$;
