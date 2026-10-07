-- ============================================================================
-- 0147 — a notification category for the admins: new members (design lab 4)
--
-- Its own migration, because a new enum value can only be used once the
-- statement that added it has committed; 0148 uses it.
-- ============================================================================

alter type public.notification_kind add value if not exists 'new_members';
