-- =============================================================================
-- 0034 — A lesson is a place, not a row
--
-- Until now a lesson existed only as a line on the course page: a title, a
-- duration and a checkbox. The academy document describes something else —
-- videos, what you will learn, review material, a practical assignment, a case
-- study, deliverables, a portfolio home, an optional challenge, and the next
-- lesson — and it asks for a board and a timer beside it.
--
-- What that needs, and what it does not:
--
-- * A lesson needs an address. `slug` is backfilled from the course and the
--   lesson's position, so the URL reads like the lesson code in the document.
-- * Several videos per lesson. `lessons.video_url` held exactly one and was
--   never written to or read; `lesson_videos` replaces it.
-- * Outcomes, a case study and a challenge are text the lesson carries.
-- * Deliverables are NOT new: `assignments.required_evidence` has always said
--   what a piece of work must come with.
-- * The LinkedIn draft and the portfolio folder are NOT stored. Both are a
--   function of the path, the course and the lesson, so the page writes them
--   from the names it already has — two fewer things that can go stale.
-- * The board is NOT a new table either. Every step it shows is already
--   recorded somewhere: progress, a submission, a review, a published link.
--   lesson_board() reads them as the caller and says where the lesson stands.
-- * The timer already exists. focus_sessions carries ref_table/ref_id, so a
--   pomodoro started on a lesson is the same row the home page writes.
-- =============================================================================

alter table public.lessons
  add column slug            text,
  add column outcomes_ar     text[] not null default '{}',
  add column case_study_ar   text,
  add column case_question_ar text,
  add column challenge_ar    text;

comment on column public.lessons.outcomes_ar is
  'What the learner should be able to do after this lesson. Empty until an author writes it — the page shows no section for an empty list.';

-- The address: the course slug and the lesson's position in it, which is also
-- how the document numbers lessons (TM-CODE-L01).
update public.lessons l
   set slug = c.slug || '-l' || numbered.position
  from (
    select l2.id,
           row_number() over (partition by c2.id order by m2.sort_order, l2.sort_order) as position,
           c2.id as course_id
      from public.lessons l2
      join public.modules m2 on m2.id = l2.module_id
      join public.courses c2 on c2.id = m2.course_id
  ) numbered
  join public.courses c on c.id = numbered.course_id
 where numbered.id = l.id;

-- New lessons get the same address without the author having to think about
-- it: the course slug and the next free position in that course.
create or replace function public.set_lesson_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_slug text;
  v_position    integer;
begin
  if new.slug is not null then
    return new;
  end if;

  select c.slug,
         1 + count(l.id)
    into v_course_slug, v_position
    from public.modules m
    join public.courses c on c.id = m.course_id
    left join public.modules m2 on m2.course_id = c.id
    left join public.lessons l on l.module_id = m2.id
   where m.id = new.module_id
   group by c.slug;

  new.slug := v_course_slug || '-l' || v_position;
  return new;
end;
$$;

create trigger lessons_set_slug before insert on public.lessons
  for each row execute function public.set_lesson_slug();

alter table public.lessons
  alter column slug set not null,
  add constraint lessons_slug_unique unique (slug);

alter table public.lessons drop column video_url;

-- ---------------------------------------------------------------------------
-- The videos of a lesson
-- ---------------------------------------------------------------------------
create table public.lesson_videos (
  id               uuid primary key default extensions.gen_random_uuid(),
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  title_ar         text not null,
  title_en         text,
  description_ar   text,
  url              text not null,
  duration_minutes integer check (duration_minutes between 0 and 600),
  sort_order       integer not null default 0,

  constraint lesson_videos_url_is_http check (url ~* '^https?://')
);

create index lesson_videos_lesson_idx on public.lesson_videos (lesson_id, sort_order);

alter table public.lesson_videos enable row level security;

create policy lesson_videos_read_all on public.lesson_videos
  for select to anon, authenticated using (true);

create policy lesson_videos_admin_write on public.lesson_videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.lesson_videos to anon, authenticated;
grant insert, update, delete on public.lesson_videos to authenticated;

-- ---------------------------------------------------------------------------
-- Where this lesson stands, as a board
-- ---------------------------------------------------------------------------
-- Four steps, each read from the row that already records it. Nothing here is
-- stored: move the underlying work and the board moves with it, which is why
-- it can never drift from the course page or the review queue.
--
-- Publishing is a step, never a requirement, unless the assignment itself asks
-- for a public link: the academy does not make anyone post their work.
create or replace function public.lesson_board(p_lesson uuid)
returns table (
  step_key    text,
  title_ar    text,
  title_en    text,
  column_key  text,
  detail_ar   text,
  is_optional boolean,
  sort_order  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  progress as (
    select lp.status
      from public.lesson_progress lp cross join me
     where lp.lesson_id = p_lesson and lp.profile_id = me.id
  ),
  work as (
    select a.required_evidence,
           s.id as submission_id,
           s.status as submission_status
      from public.assignments a
      cross join me
      left join public.submissions s
        on s.assignment_id = a.id and s.profile_id = me.id
     where a.lesson_id = p_lesson and a.kind = 'lesson_assignment'
     limit 1
  ),
  published as (
    select exists (
      select 1
        from public.submission_evidence se
        join public.submission_versions sv on sv.id = se.version_id
       where sv.submission_id = (select submission_id from work)
         and se.kind in ('linkedin', 'github', 'youtube', 'portfolio')
    ) as shared
  )
  select 'watch', 'شاهد الدرس', 'Watch the lesson',
         case (select status from progress)
           when 'completed' then 'done'
           when 'in_progress' then 'doing'
           else 'todo'
         end,
         null::text, false, 1
  union all
  select 'practice', 'نفّذ التكليف', 'Do the assignment',
         case
           when (select submission_status from work) in ('submitted', 'under_review', 'approved') then 'done'
           when (select submission_status from work) in ('draft', 'changes_requested') then 'doing'
           else 'todo'
         end,
         null, false, 2
  union all
  select 'review', 'مراجعة المنتور', 'Mentor review',
         case (select submission_status from work)
           when 'approved' then 'done'
           when 'submitted' then 'doing'
           when 'under_review' then 'doing'
           when 'changes_requested' then 'doing'
           else 'todo'
         end,
         case (select submission_status from work)
           when 'changes_requested' then 'المنتور طلب تعديلات'
           else null
         end,
         false, 3
  union all
  select 'publish', 'وثّق ما بنيته', 'Document what you built',
         case when (select shared from published) then 'done'
              when (select submission_id from work) is not null then 'doing'
              else 'todo' end,
         null,
         -- optional unless the assignment itself requires a public link
         not coalesce((select required_evidence from work) && array['linkedin','github','youtube']::public.evidence_kind[], false),
         4
   where (select submission_id from work) is not null
      or (select required_evidence from work) is not null;
$$;

comment on function public.lesson_board is
  'The four steps of a lesson, read from the rows that already record them. It resolves the caller through auth.uid(), so it can only ever show your own standing.';

grant execute on function public.lesson_board(uuid) to authenticated;
