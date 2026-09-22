-- =============================================================================
-- 0058 — The vocabulary a company workspace needs
--
-- Two things change here, and both are corrections rather than additions.
--
-- **The incubation ladder was six rungs and the document describes eight.**
-- 'users' was always a poor name for "somebody is paying attention", and
-- 'startup' as a stage of a startup said nothing at all. So: 'users' becomes
-- 'first_customers', 'startup' becomes 'growth', and the two rungs that were
-- missing — a market test, and revenue — are added. The order a workspace shows
-- them in does not come from this enum (0059 puts it in a table), because the
-- order of a product ladder is a product decision, not a storage one.
--
-- **A workspace has more kinds of people in it than a startup did.** Founder,
-- co-founder, member and advisor cannot describe a manager, an employee, a
-- freelancer brought in for one project, or somebody who may only read.
-- =============================================================================

alter type public.startup_stage rename value 'users'   to 'first_customers';
alter type public.startup_stage rename value 'startup' to 'growth';

alter type public.startup_stage add value if not exists 'market_test' after 'mvp';
alter type public.startup_stage add value if not exists 'revenue' after 'first_customers';

alter type public.startup_member_role add value if not exists 'manager'    after 'cofounder';
alter type public.startup_member_role add value if not exists 'employee'   after 'member';
alter type public.startup_member_role add value if not exists 'freelancer' after 'employee';
alter type public.startup_member_role add value if not exists 'viewer'     after 'advisor';
