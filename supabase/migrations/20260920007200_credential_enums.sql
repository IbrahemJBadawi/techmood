-- =============================================================================
-- 0072 — The states of a credential somebody else issued
--
-- A credential from IBM, Google, AWS, Kaggle, Microsoft, HubSpot, Cisco,
-- Fortinet or Anthropic is *their* statement about a person. TechMood's part is
-- narrower and has to stay narrow: checking that the link a learner pasted is
-- really theirs, really that credential, and really issued. Three states say
-- everything that check can say.
-- =============================================================================

create type public.credential_status as enum (
  'submitted',  -- the learner pasted a link; nobody has opened it yet
  'verified',   -- somebody opened it at the provider and it is what it claims
  'rejected'    -- it is not: wrong person, wrong credential, or not issued
);
