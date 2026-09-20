-- =============================================================================
-- TechMood — 0003 Academy
-- Academy -> School -> Learning Path -> Course -> Module -> Lesson
-- A course is standalone and carries its own certificate. A path is completed
-- through its REQUIRED courses (electives count for XP, not for completion).
-- =============================================================================

create table public.schools (
  id         uuid primary key default extensions.gen_random_uuid(),
  slug       text not null unique,
  name_ar    text not null,
  name_en    text,
  sort_order integer not null default 0
);

create table public.learning_paths (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null unique,
  school_id       uuid references public.schools (id) on delete set null,
  title_ar        text not null,
  title_en        text,
  description_ar  text,
  tagline_ar      text,
  tags            text[] not null default '{}',
  status          public.content_status not null default 'draft',
  estimated_hours integer check (estimated_hours >= 0),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger learning_paths_touch before update on public.learning_paths
  for each row execute function public.touch_updated_at();

create table public.courses (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null unique,
  title_ar        text not null,
  title_en        text,
  description_ar  text,
  status          public.content_status not null default 'draft',
  estimated_hours integer check (estimated_hours >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

-- A course can belong to several paths; a path decides which of its courses
-- are required for completion.
create table public.path_courses (
  path_id     uuid not null references public.learning_paths (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  is_required boolean not null default true,
  sort_order  integer not null default 0,
  primary key (path_id, course_id)
);

create index path_courses_course_idx on public.path_courses (course_id);

create table public.modules (
  id         uuid primary key default extensions.gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  title_ar   text not null,
  sort_order integer not null default 0
);

create index modules_course_idx on public.modules (course_id, sort_order);

create table public.lessons (
  id               uuid primary key default extensions.gen_random_uuid(),
  module_id        uuid not null references public.modules (id) on delete cascade,
  title_ar         text not null,
  title_en         text,
  kind             public.lesson_kind not null default 'video',
  duration_minutes integer check (duration_minutes between 0 and 600),
  summary_ar       text,
  video_url        text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index lessons_module_idx on public.lessons (module_id, sort_order);

create table public.lesson_resources (
  id        uuid primary key default extensions.gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  label     text not null,
  url       text not null,
  kind      public.evidence_kind not null default 'website',
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Gradeable work. Each row is a "thing a student submits evidence for".
-- Keeping the three levels in one table is what lets one submission pipeline,
-- one evaluation history and one XP ledger serve all of them.
-- ---------------------------------------------------------------------------
create table public.assignments (
  id                uuid primary key default extensions.gen_random_uuid(),
  kind              public.submission_kind not null,
  lesson_id         uuid references public.lessons (id) on delete cascade,
  course_id         uuid references public.courses (id) on delete cascade,
  path_id           uuid references public.learning_paths (id) on delete cascade,
  title_ar          text not null,
  brief_ar          text,
  required_evidence public.evidence_kind[] not null default '{}',
  -- required work gates the certificate; optional work only earns XP
  is_required       boolean not null default true,
  is_group_work     boolean not null default false,
  created_at        timestamptz not null default now(),

  -- exactly one owner, matching the kind
  constraint assignments_owner_matches_kind check (
    (kind = 'lesson_assignment' and lesson_id is not null and course_id is null and path_id is null) or
    (kind in ('course_project','course_task') and course_id is not null and lesson_id is null and path_id is null) or
    (kind = 'path_project' and path_id is not null and lesson_id is null and course_id is null) or
    (kind = 'portfolio_evidence' and lesson_id is null and course_id is null and path_id is null)
  )
);

create unique index assignments_one_per_lesson on public.assignments (lesson_id)
  where kind = 'lesson_assignment';
create unique index assignments_one_project_per_course on public.assignments (course_id)
  where kind = 'course_project';
create unique index assignments_one_project_per_path on public.assignments (path_id)
  where kind = 'path_project';
create index assignments_course_idx on public.assignments (course_id);
create index assignments_path_idx   on public.assignments (path_id);

-- ---------------------------------------------------------------------------
-- Assessments (quizzes) — a course may gate its certificate on a passing score
-- ---------------------------------------------------------------------------
create table public.assessments (
  id            uuid primary key default extensions.gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  title_ar      text not null,
  passing_score integer not null default 60 check (passing_score between 0 and 100),
  is_required   boolean not null default false
);

create table public.assessment_questions (
  id            uuid primary key default extensions.gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  prompt_ar     text not null,
  choices       jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  sort_order    integer not null default 0
);

create table public.assessment_attempts (
  id            uuid primary key default extensions.gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  score         integer not null check (score between 0 and 100),
  passed        boolean not null,
  answers       jsonb,
  created_at    timestamptz not null default now()
);

create index assessment_attempts_profile_idx on public.assessment_attempts (profile_id, assessment_id);

-- ---------------------------------------------------------------------------
-- Enrollment & lesson progress
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id           uuid primary key default extensions.gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  path_id      uuid references public.learning_paths (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  completed_at timestamptz,

  constraint enrollments_one_target check (
    (path_id is not null and course_id is null) or
    (path_id is null and course_id is not null)
  )
);

create unique index enrollments_unique_path   on public.enrollments (profile_id, path_id)   where path_id is not null;
create unique index enrollments_unique_course on public.enrollments (profile_id, course_id) where course_id is not null;

create table public.lesson_progress (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  status       public.progress_status not null default 'available',
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

create index lesson_progress_profile_idx on public.lesson_progress (profile_id);

create trigger lesson_progress_touch before update on public.lesson_progress
  for each row execute function public.touch_updated_at();
