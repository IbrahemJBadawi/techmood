-- =============================================================================
-- 0080 — The criteria a finished course is judged on
--
-- In a file of its own because an enum type has to exist, committed, before
-- 0081 uses it.
-- =============================================================================
create type public.course_criterion as enum (
  'content',     -- المحتوى وجودته
  'clarity',     -- وضوح الشرح
  'practice',    -- التطبيق العملي
  'pace',        -- مناسبة الإيقاع والمدة
  'usefulness'   -- الفائدة لعملي
);
