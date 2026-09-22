-- =============================================================================
-- 0064 — The categories a notification can belong to
--
-- `notification_kind` was written in 0001 for the platform that existed then:
-- an evaluation, a booking, a payment, a team, a message, a certificate, a role
-- review, and everything else as 'system'. Since then the platform grew an
-- academy, a market, an exhibition, a workspace and money that moves — and all
-- of those have been arriving as 'system', which is how a notification centre
-- becomes a single undifferentiated stream nobody filters.
--
-- Four values, matching the four things that were being flattened. 'security'
-- is separate from 'account' on purpose: one of them is a thing a person may
-- switch off, and the other never is.
-- =============================================================================

alter type public.notification_kind add value if not exists 'academy'  after 'evaluation';
alter type public.notification_kind add value if not exists 'work'     after 'team';
alter type public.notification_kind add value if not exists 'project'  after 'work';
alter type public.notification_kind add value if not exists 'security' after 'role_review';
