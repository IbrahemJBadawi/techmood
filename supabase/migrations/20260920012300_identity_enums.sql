-- =============================================================================
-- 0123 — A CV is one of a member's main links
--
-- The founder's profile rule: the main accounts — CV, LinkedIn, YouTube,
-- GitHub, Behance — are set apart from every other link, in Settings and on
-- the portfolio. LinkedIn, YouTube, GitHub and Behance were link kinds since
-- 0042; a CV was not. (An enum value is added in a file of its own: Postgres
-- cannot use a new value in the transaction that adds it.)
-- =============================================================================

alter type public.link_kind add value if not exists 'cv' before 'linkedin';
