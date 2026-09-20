-- =============================================================================
-- TechMood — 0023 Incubator vocabulary
-- Enum values in their own migration; 0024 uses them.
-- =============================================================================

-- The nine blocks of the Business Model Canvas, fixed by the model itself.
create type public.canvas_block as enum (
  'key_partners', 'key_activities', 'key_resources', 'value_propositions',
  'customer_relationships', 'channels', 'customer_segments',
  'cost_structure', 'revenue_streams'
);

-- A named palette, not free hex: every colour maps to a design token, so a card
-- stays readable in both themes and the canvas keeps the platform's identity.
create type public.card_colour as enum (
  'default', 'royal', 'sky', 'green', 'amber', 'rose', 'violet', 'slate'
);

-- The ten sections of a business plan.
create type public.plan_section as enum (
  'executive_summary', 'company_description', 'market_analysis',
  'competitive_analysis', 'product_and_service', 'marketing_and_sales',
  'operations', 'team_and_management', 'financial_plan', 'risks_and_mitigation'
);

create type public.swot_quadrant as enum ('strength', 'weakness', 'opportunity', 'threat');

create type public.goal_status as enum ('planned', 'on_track', 'at_risk', 'achieved', 'missed');

create type public.startup_member_role as enum ('founder', 'cofounder', 'member', 'advisor');
