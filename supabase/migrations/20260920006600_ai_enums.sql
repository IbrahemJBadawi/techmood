-- =============================================================================
-- 0066 — The words the assistant is allowed to use
--
-- Enum values have to exist in a migration of their own before another
-- migration can mention them (the convention since 0015), so the vocabulary of
-- the AI layer lands here and the layer itself lands in 0067.
--
-- The one worth reading twice is `ai_permission`. It is not decoration: every
-- surface and every action carries one, and `restricted` is a promise the
-- database keeps — an action marked `restricted` has no execution branch at
-- all, so there is no sequence of clicks, no prompt and no bug that ends with
-- the assistant paying somebody.
-- =============================================================================

-- Where the assistant was opened from. The surface decides which suggestions
-- appear and what the context resolver bothers to read.
create type public.ai_surface as enum (
  'general',
  'lesson',
  'course',
  'assessment',
  'assignment',
  'project',
  'profile',
  'cv',
  'market',
  'opportunity',
  'mentor',
  'booking',
  'team',
  'startup',
  'canvas',
  'goal'
);

-- How wide the person let the assistant look. This is the context chip:
-- «الصفحة الحالية / الدورة الحالية / ملفي / مشروعي / فريقي / TechMood كله».
create type public.ai_scope as enum (
  'page',
  'course',
  'profile',
  'project',
  'team',
  'startup',
  'platform'
);

create type public.ai_role as enum ('user', 'assistant', 'system');

-- 👁️ read · ✏️ suggest · ✅ act · 🔒 restricted
create type public.ai_permission as enum ('read', 'suggest', 'act', 'restricted');

create type public.ai_action_status as enum (
  'proposed',   -- the assistant offered; nothing has happened
  'confirmed',  -- the person pressed the button
  'executed',   -- and it went through
  'declined',   -- the person said no
  'failed',     -- it was confirmed and the database refused it
  'expired'     -- nobody answered in time
);

create type public.ai_memory_kind as enum (
  'goal',
  'preference',
  'skill',
  'context',
  'fact'
);
