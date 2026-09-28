-- =============================================================================
-- 0090 — The founder's prices: 10–150$ a session, 30% to TechMood, 15% on a
--        project sale
--
-- Decided by the founder (docs/master-plan.md, «قرار مطلوب», option 3):
--
--   * Sessions are priced between 10$ and 150$ an hour across the levels (the
--     bands 0077 set already span exactly that).
--   * TechMood takes 30% of every session at every level — except level 1, the
--     new mentor's level, whose default 15$ session stays 5$ to TechMood and
--     10$ to the mentor (33.33%). A mentor leaves that rate by being promoted.
--   * A finished project sold in the market pays 15% flat, whatever its price
--     (it was 10%, then 8% from 1000$).
--
-- All of these stay editable by an admin at Admin → Pricing; this migration
-- only changes the starting values. Bookings already made keep the figures
-- they were made with — a booking stores its own price and split.
-- =============================================================================

update public.mentor_levels
   set commission_pct     = v.pct,
       platform_share_usd = round(session_price_usd * v.pct / 100, 2),
       mentor_share_usd   = session_price_usd - round(session_price_usd * v.pct / 100, 2)
  from (values ('L1'::public.mentor_level, 33.33::numeric), ('L2', 30), ('L3', 30),
               ('L4', 30), ('L5', 30), ('L6', 30)) as v(level, pct)
 where public.mentor_levels.level = v.level;

delete from public.commission_tiers where kind = 'project_sale' and min_amount_usd > 0;

update public.commission_tiers
   set rate_percent = 15.00,
       note_ar      = 'عمولة بيع مشروع جاهز — 15% ثابتة'
 where kind = 'project_sale' and min_amount_usd = 0;
