-- =============================================================================
-- 0115 — The mentor's studio: courses and paths written the TechMood way,
--        shown in the academy under the mentor's name
--
-- The founder's rule: a mentor has a gallery of courses and paths; they add
-- them in TechMood's shape and the academy shows them under their name.
--
-- The shape is the lesson anatomy (0034) that the whole catalogue uses: a
-- course is modules, a module is lessons, and a lesson carries its summary,
-- what you will learn, videos, review sources, a case study, one practical
-- assignment with what to hand in, and an optional challenge. A path is a
-- school, a title and an ordered list of courses.
--
-- What a mentor writes stays theirs and invisible until it is reviewed — the
-- same reason the catalogue has always had statuses (0078): a learner must not
-- open half a course. So:
--
--   editing ──submit──▶ submitted ──approve──▶ approved (published)
--      ▲                   │
--      └── changes_requested (with the reviewer's note)
--
--   * Every write goes through a function that checks the author and that the
--     piece is still being edited; clients never write catalogue rows.
--   * A studio lesson and its assignment are 'draft' until the course is
--     approved, so nothing of it is readable but by its author and admins.
--   * Approving a course publishes it with its lessons and work; approving a
--     path announces it, and 0078's rule opens it once one of its courses is
--     ready. The byline is the author: courses.author_id / learning_paths.
--     author_id (empty for TechMood's own catalogue).
--   * A published piece is not edited in place — learners are studying it.
-- =============================================================================

alter table public.courses
  add column author_id    uuid references public.profiles (id) on delete set null,
  add column review_state text not null default 'none'
    check (review_state in ('none', 'editing', 'submitted', 'changes_requested', 'approved')),
  add column review_note_ar text,
  add column submitted_at timestamptz,
  add column reviewed_at  timestamptz,
  add column reviewed_by  uuid references public.profiles (id) on delete set null;

alter table public.learning_paths
  add column author_id    uuid references public.profiles (id) on delete set null,
  add column review_state text not null default 'none'
    check (review_state in ('none', 'editing', 'submitted', 'changes_requested', 'approved')),
  add column review_note_ar text,
  add column submitted_at timestamptz,
  add column reviewed_at  timestamptz,
  add column reviewed_by  uuid references public.profiles (id) on delete set null;

create index courses_author_idx on public.courses (author_id) where author_id is not null;
create index learning_paths_author_idx on public.learning_paths (author_id) where author_id is not null;
create index courses_review_idx on public.courses (review_state) where review_state = 'submitted';
create index learning_paths_review_idx on public.learning_paths (review_state) where review_state = 'submitted';

comment on column public.courses.author_id is
  'The mentor who wrote this course in the studio (0115); empty for TechMood''s own catalogue.';

-- The author reads their own drafts; everybody else still sees only what is
-- open or announced (0078).
create policy lessons_author_read on public.lessons
  for select to authenticated
  using (exists (select 1 from public.modules m join public.courses c on c.id = m.course_id
                  where m.id = module_id and c.author_id = (select auth.uid())));

create policy assignments_author_read on public.assignments
  for select to authenticated
  using (exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
                   join public.courses c on c.id = m.course_id
                  where l.id = lesson_id and c.author_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Who may write what
-- ---------------------------------------------------------------------------
create or replace function public.studio_course(p_course uuid)
returns public.courses
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.courses;
begin
  select * into v from public.courses where id = p_course;
  if not found or v.author_id is distinct from (select auth.uid()) then
    raise exception 'هذه الدورة ليست من إعدادك';
  end if;
  if not public.is_mentor() then
    raise exception 'الاستوديو للمنتورز المعتمدين';
  end if;
  if v.review_state not in ('editing', 'changes_requested') then
    raise exception 'الدورة مُرسلة للمراجعة أو منشورة — لا تُعدَّل الآن';
  end if;
  return v;
end;
$$;

create or replace function public.studio_path(p_path uuid)
returns public.learning_paths
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.learning_paths;
begin
  select * into v from public.learning_paths where id = p_path;
  if not found or v.author_id is distinct from (select auth.uid()) then
    raise exception 'هذا المسار ليس من إعدادك';
  end if;
  if not public.is_mentor() then
    raise exception 'الاستوديو للمنتورز المعتمدين';
  end if;
  if v.review_state not in ('editing', 'changes_requested') then
    raise exception 'المسار مُرسل للمراجعة أو منشور — لا يُعدَّل الآن';
  end if;
  return v;
end;
$$;

revoke execute on function public.studio_course(uuid) from public, anon, authenticated;
revoke execute on function public.studio_path(uuid) from public, anon, authenticated;

create or replace function public.studio_slug(p_title text, p_fallback text)
returns text
language sql
volatile
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g')), ''), p_fallback)
         || '-' || substr(md5(extensions.gen_random_uuid()::text), 1, 5);
$$;

revoke execute on function public.studio_slug(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create or replace function public.studio_create_course(
  p_title_ar text, p_title_en text default null, p_description_ar text default null,
  p_level public.course_level default 'beginner'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_mentor() then
    raise exception 'الاستوديو للمنتورز المعتمدين';
  end if;
  if char_length(trim(coalesce(p_title_ar, ''))) < 4 then
    raise exception 'اكتب عنواناً واضحاً للدورة';
  end if;
  if (select count(*) from public.courses where author_id = (select auth.uid()) and review_state <> 'approved') >= 20 then
    raise exception 'لديك عشرون دورة قيد الإعداد — أنهِ بعضها أولاً';
  end if;

  insert into public.courses (slug, title_ar, title_en, description_ar, status, level, author_id, review_state)
  values (public.studio_slug(p_title_en, 'course'), trim(p_title_ar), nullif(trim(coalesce(p_title_en, '')), ''),
          nullif(trim(coalesce(p_description_ar, '')), ''), 'draft', p_level, (select auth.uid()), 'editing')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.studio_update_course(
  p_course uuid, p_title_ar text, p_title_en text, p_description_ar text,
  p_level public.course_level, p_estimated_hours integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_course(p_course);
  if char_length(trim(coalesce(p_title_ar, ''))) < 4 then
    raise exception 'اكتب عنواناً واضحاً للدورة';
  end if;
  update public.courses
     set title_ar = trim(p_title_ar), title_en = nullif(trim(coalesce(p_title_en, '')), ''),
         description_ar = nullif(trim(coalesce(p_description_ar, '')), ''), level = p_level,
         estimated_hours = case when p_estimated_hours between 1 and 500 then p_estimated_hours end
   where id = p_course;
end;
$$;

create or replace function public.studio_delete_course(p_course uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_course(p_course);
  delete from public.courses where id = p_course;
end;
$$;

-- ---------------------------------------------------------------------------
-- Modules
-- ---------------------------------------------------------------------------
create or replace function public.studio_add_module(p_course uuid, p_title_ar text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.studio_course(p_course);
  if char_length(trim(coalesce(p_title_ar, ''))) < 2 then
    raise exception 'اكتب اسماً للوحدة';
  end if;
  insert into public.modules (course_id, title_ar, sort_order)
  values (p_course, trim(p_title_ar),
          (select coalesce(max(sort_order), 0) + 1 from public.modules where course_id = p_course))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.studio_update_module(p_module uuid, p_title_ar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_course((select course_id from public.modules where id = p_module));
  if char_length(trim(coalesce(p_title_ar, ''))) < 2 then
    raise exception 'اكتب اسماً للوحدة';
  end if;
  update public.modules set title_ar = trim(p_title_ar) where id = p_module;
end;
$$;

create or replace function public.studio_delete_module(p_module uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_course((select course_id from public.modules where id = p_module));
  delete from public.modules where id = p_module;
end;
$$;

-- Swap with the neighbour above (-1) or below (+1).
create or replace function public.studio_move_module(p_module uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mod   public.modules;
  v_other public.modules;
begin
  select * into v_mod from public.modules where id = p_module;
  perform public.studio_course(v_mod.course_id);
  select * into v_other from public.modules
   where course_id = v_mod.course_id
     and case when p_direction < 0 then sort_order < v_mod.sort_order else sort_order > v_mod.sort_order end
   order by case when p_direction < 0 then -sort_order else sort_order end
   limit 1;
  if found then
    update public.modules set sort_order = v_other.sort_order where id = v_mod.id;
    update public.modules set sort_order = v_mod.sort_order where id = v_other.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lessons, in the anatomy of 0034
-- ---------------------------------------------------------------------------
create or replace function public.studio_save_lesson(p_module uuid, p_lesson uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses;
  v_id     uuid := p_lesson;
  v_slug   text;
  x        jsonb;
  i        integer;
  v_kinds  public.evidence_kind[];
begin
  select c.* into v_course from public.modules m join public.courses c on c.id = m.course_id where m.id = p_module;
  perform public.studio_course(v_course.id);

  if p_lesson is not null and not exists (select 1 from public.lessons where id = p_lesson and module_id in
       (select id from public.modules where course_id = v_course.id)) then
    raise exception 'الدرس ليس في هذه الدورة';
  end if;
  if char_length(trim(coalesce(p ->> 'title_ar', ''))) < 3 then
    raise exception 'اكتب عنواناً واضحاً للدرس';
  end if;
  if jsonb_array_length(coalesce(p -> 'videos', '[]')) > 20 or jsonb_array_length(coalesce(p -> 'resources', '[]')) > 20 then
    raise exception 'عشرون فيديو وعشرون مصدراً على الأكثر في الدرس';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'videos', '[]') || coalesce(p -> 'resources', '[]')) e
              where coalesce(e ->> 'url', '') !~* '^https://[^\s]+$') then
    raise exception 'كل رابط يجب أن يبدأ بـ https://';
  end if;

  if v_id is null then
    select v_course.slug || '-l' || (coalesce(max(nullif(regexp_replace(l.slug, '^.*-l', ''), '')::integer), 0) + 1)
      into v_slug
      from public.lessons l join public.modules m on m.id = l.module_id
     where m.course_id = v_course.id and l.slug ~ ('^' || v_course.slug || '-l[0-9]+$');

    insert into public.lessons (module_id, slug, title_ar, sort_order, kind, status)
    values (p_module, coalesce(v_slug, v_course.slug || '-l1'), trim(p ->> 'title_ar'),
            (select coalesce(max(sort_order), 0) + 1 from public.lessons where module_id = p_module),
            'video', 'draft')
    returning id into v_id;
  end if;

  update public.lessons
     set title_ar = trim(p ->> 'title_ar'),
         title_en = nullif(trim(coalesce(p ->> 'title_en', '')), ''),
         kind = coalesce(nullif(p ->> 'kind', ''), 'video')::public.lesson_kind,
         duration_minutes = case when (p ->> 'duration_minutes') ~ '^[0-9]{1,3}$' then (p ->> 'duration_minutes')::integer end,
         summary_ar = nullif(trim(coalesce(p ->> 'summary_ar', '')), ''),
         outcomes_ar = coalesce(array(select trim(o) from jsonb_array_elements_text(coalesce(p -> 'outcomes_ar', '[]')) o
                                        where trim(o) <> '' limit 14), '{}'),
         case_study_ar = nullif(trim(coalesce(p ->> 'case_study_ar', '')), ''),
         case_question_ar = nullif(trim(coalesce(p ->> 'case_question_ar', '')), ''),
         challenge_ar = nullif(trim(coalesce(p ->> 'challenge_ar', '')), ''),
         status = 'draft'
   where id = v_id;

  delete from public.lesson_videos where lesson_id = v_id;
  i := 0;
  for x in select value from jsonb_array_elements(coalesce(p -> 'videos', '[]')) loop
    i := i + 1;
    insert into public.lesson_videos (lesson_id, title_ar, description_ar, url, sort_order)
    values (v_id, coalesce(nullif(trim(coalesce(x ->> 'title_ar', '')), ''), 'فيديو الشرح'),
            nullif(trim(coalesce(x ->> 'description_ar', '')), ''), trim(x ->> 'url'), i);
  end loop;

  delete from public.lesson_resources where lesson_id = v_id;
  i := 0;
  for x in select value from jsonb_array_elements(coalesce(p -> 'resources', '[]')) loop
    i := i + 1;
    insert into public.lesson_resources (lesson_id, label, url, kind, sort_order)
    values (v_id, coalesce(nullif(trim(coalesce(x ->> 'label', '')), ''), x ->> 'url'), trim(x ->> 'url'),
            case when (x ->> 'url') ~* 'youtu' then 'youtube' else 'website' end::public.evidence_kind, i);
  end loop;

  -- One practical assignment, or none.
  delete from public.assignments where lesson_id = v_id and kind = 'lesson_assignment';
  x := p -> 'assignment';
  if jsonb_typeof(x) = 'object' and char_length(trim(coalesce(x ->> 'brief_ar', ''))) > 0 then
    v_kinds := array(select k::public.evidence_kind from jsonb_array_elements_text(coalesce(x -> 'required_evidence', '[]')) k
                      where k in ('github', 'drive', 'website', 'portfolio', 'file'));
    insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required, is_group_work, status)
    values ('lesson_assignment', v_id,
            coalesce(nullif(trim(coalesce(x ->> 'title_ar', '')), ''), 'تكليف: ' || trim(p ->> 'title_ar')),
            trim(x ->> 'brief_ar'), coalesce(v_kinds, '{}'), true, false, 'draft');
  end if;

  return v_id;
end;
$$;

create or replace function public.studio_delete_lesson(p_lesson uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_course((select m.course_id from public.lessons l join public.modules m on m.id = l.module_id
                                  where l.id = p_lesson));
  delete from public.lessons where id = p_lesson;
end;
$$;

create or replace function public.studio_move_lesson(p_lesson uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_les   public.lessons;
  v_other public.lessons;
begin
  select * into v_les from public.lessons where id = p_lesson;
  perform public.studio_course((select course_id from public.modules where id = v_les.module_id));
  select * into v_other from public.lessons
   where module_id = v_les.module_id
     and case when p_direction < 0 then sort_order < v_les.sort_order else sort_order > v_les.sort_order end
   order by case when p_direction < 0 then -sort_order else sort_order end
   limit 1;
  if found then
    update public.lessons set sort_order = v_other.sort_order where id = v_les.id;
    update public.lessons set sort_order = v_les.sort_order where id = v_other.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paths
-- ---------------------------------------------------------------------------
create or replace function public.studio_create_path(
  p_title_ar text, p_title_en text, p_school text,
  p_tagline_ar text default null, p_description_ar text default null, p_tags text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_school uuid := (select id from public.schools where slug = p_school);
begin
  if not public.is_mentor() then
    raise exception 'الاستوديو للمنتورز المعتمدين';
  end if;
  if char_length(trim(coalesce(p_title_ar, ''))) < 4 then
    raise exception 'اكتب عنواناً واضحاً للمسار';
  end if;
  if v_school is null then
    raise exception 'اختر المدرسة التي ينتمي إليها المسار';
  end if;
  if (select count(*) from public.learning_paths where author_id = (select auth.uid()) and review_state <> 'approved') >= 10 then
    raise exception 'لديك عشرة مسارات قيد الإعداد — أنهِ بعضها أولاً';
  end if;

  insert into public.learning_paths (slug, school_id, title_ar, title_en, tagline_ar, description_ar, tags, status,
                                     sort_order, author_id, review_state)
  values (public.studio_slug(p_title_en, 'path'), v_school, trim(p_title_ar), nullif(trim(coalesce(p_title_en, '')), ''),
          nullif(trim(coalesce(p_tagline_ar, '')), ''), nullif(trim(coalesce(p_description_ar, '')), ''),
          coalesce(array(select trim(t) from unnest(p_tags) t where trim(t) <> '' limit 6), '{}'), 'draft',
          (select coalesce(max(sort_order), 0) + 1 from public.learning_paths), (select auth.uid()), 'editing')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.studio_update_path(
  p_path uuid, p_title_ar text, p_title_en text, p_school text,
  p_tagline_ar text, p_description_ar text, p_tags text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school uuid := (select id from public.schools where slug = p_school);
begin
  perform public.studio_path(p_path);
  if char_length(trim(coalesce(p_title_ar, ''))) < 4 then
    raise exception 'اكتب عنواناً واضحاً للمسار';
  end if;
  if v_school is null then
    raise exception 'اختر المدرسة التي ينتمي إليها المسار';
  end if;
  update public.learning_paths
     set title_ar = trim(p_title_ar), title_en = nullif(trim(coalesce(p_title_en, '')), ''), school_id = v_school,
         tagline_ar = nullif(trim(coalesce(p_tagline_ar, '')), ''),
         description_ar = nullif(trim(coalesce(p_description_ar, '')), ''),
         tags = coalesce(array(select trim(t) from unnest(p_tags) t where trim(t) <> '' limit 6), '{}')
   where id = p_path;
end;
$$;

-- A path is the author's own courses and any course already open, in order;
-- the ones marked optional are breadth rather than depth.
create or replace function public.studio_set_path_courses(p_path uuid, p_courses uuid[], p_optional uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_path(p_path);
  if cardinality(p_courses) > 15 then
    raise exception 'خمس عشرة دورة على الأكثر في المسار';
  end if;
  if exists (select 1 from unnest(p_courses) c(id)
              where not exists (select 1 from public.courses co
                                 where co.id = c.id
                                   and (co.author_id = (select auth.uid()) or co.status = 'published'))) then
    raise exception 'يضم المسار دوراتك أو دورات منشورة فقط';
  end if;

  delete from public.path_courses where path_id = p_path;
  insert into public.path_courses (path_id, course_id, is_required, sort_order)
  select p_path, c.id, not (c.id = any (coalesce(p_optional, '{}'))), c.n
    from unnest(p_courses) with ordinality as c(id, n);
end;
$$;

create or replace function public.studio_delete_path(p_path uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.studio_path(p_path);
  delete from public.learning_paths where id = p_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review
-- ---------------------------------------------------------------------------
create or replace function public.studio_submit(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if p_kind = 'course' then
    perform public.studio_course(p_id);
    if not exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id where m.course_id = p_id) then
      raise exception 'أضف وحدة فيها درس واحد على الأقل قبل الإرسال';
    end if;
    if exists (select 1 from public.modules m where m.course_id = p_id
                and not exists (select 1 from public.lessons l where l.module_id = m.id)) then
      raise exception 'في الدورة وحدة فارغة — أضف لها درساً أو احذفها';
    end if;
    update public.courses set review_state = 'submitted', submitted_at = now() where id = p_id
    returning title_ar into v_title;
  elsif p_kind = 'path' then
    perform public.studio_path(p_id);
    if not exists (select 1 from public.path_courses where path_id = p_id) then
      raise exception 'أضف دورة واحدة على الأقل إلى المسار قبل الإرسال';
    end if;
    update public.learning_paths set review_state = 'submitted', submitted_at = now() where id = p_id
    returning title_ar into v_title;
  else
    raise exception 'نوع غير معروف';
  end if;

  perform public.notify_admins('محتوى جديد للمراجعة',
    case when p_kind = 'course' then 'دورة «' else 'مسار «' end || v_title || '» من إعداد منتور — بانتظار المراجعة.',
    '/admin/studio', 'studio_' || p_kind, p_id, 'normal');
end;
$$;

-- The author may take a submission back to keep writing.
create or replace function public.studio_withdraw(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind = 'course' then
    update public.courses set review_state = 'editing'
     where id = p_id and author_id = (select auth.uid()) and review_state = 'submitted';
  elsif p_kind = 'path' then
    update public.learning_paths set review_state = 'editing'
     where id = p_id and author_id = (select auth.uid()) and review_state = 'submitted';
  end if;
  if not found then
    raise exception 'لا يوجد إرسال لسحبه';
  end if;
end;
$$;

create or replace function public.review_studio_item(p_kind text, p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_title  text;
  v_link   text;
begin
  if not public.is_admin() then
    raise exception 'المراجعة للإدارة';
  end if;
  if not p_approve and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'اكتب للمنتور ما المطلوب تعديله';
  end if;

  if p_kind = 'course' then
    select author_id, title_ar into v_author, v_title from public.courses where id = p_id and review_state = 'submitted';
    if not found then raise exception 'لا توجد دورة بانتظار المراجعة'; end if;

    if p_approve then
      update public.lessons l set status = 'published'
        from public.modules m where m.id = l.module_id and m.course_id = p_id and l.status = 'draft';
      update public.assignments a set status = 'published'
        from public.lessons l join public.modules m on m.id = l.module_id
       where a.lesson_id = l.id and m.course_id = p_id and a.status = 'draft';
      update public.courses
         set status = 'published', review_state = 'approved', review_note_ar = nullif(trim(coalesce(p_note, '')), ''),
             reviewed_at = now(), reviewed_by = (select auth.uid())
       where id = p_id;
    else
      update public.courses
         set review_state = 'changes_requested', review_note_ar = trim(p_note),
             reviewed_at = now(), reviewed_by = (select auth.uid())
       where id = p_id;
    end if;
    v_link := '/studio/courses/' || p_id;
  elsif p_kind = 'path' then
    select author_id, title_ar into v_author, v_title from public.learning_paths where id = p_id and review_state = 'submitted';
    if not found then raise exception 'لا يوجد مسار بانتظار المراجعة'; end if;

    if p_approve then
      update public.learning_paths
         set status = 'planned', review_state = 'approved', review_note_ar = nullif(trim(coalesce(p_note, '')), ''),
             reviewed_at = now(), reviewed_by = (select auth.uid())
       where id = p_id;
      -- Open once one of its courses is ready (0078).
      perform public.sync_path_status(p_id);
    else
      update public.learning_paths
         set review_state = 'changes_requested', review_note_ar = trim(p_note),
             reviewed_at = now(), reviewed_by = (select auth.uid())
       where id = p_id;
    end if;
    v_link := '/studio/paths/' || p_id;
  else
    raise exception 'نوع غير معروف';
  end if;

  perform public.notify(v_author, 'role_review',
    case when p_approve then 'نُشر «' || v_title || '» في الأكاديمية باسمك'
         else 'مطلوب تعديل على «' || v_title || '»' end,
    case when p_approve then 'شكراً لك — صار متاحاً للمتعلمين.' else trim(p_note) end,
    v_link, 'studio_' || p_kind, p_id, 'important');
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: writing is for signed-in people (the functions check who); the
-- helpers are not callable at all.
-- ---------------------------------------------------------------------------
do $grants$
declare
  f text;
begin
  foreach f in array array[
    'studio_create_course(text, text, text, public.course_level)',
    'studio_update_course(uuid, text, text, text, public.course_level, integer)',
    'studio_delete_course(uuid)',
    'studio_add_module(uuid, text)', 'studio_update_module(uuid, text)', 'studio_delete_module(uuid)',
    'studio_move_module(uuid, integer)',
    'studio_save_lesson(uuid, uuid, jsonb)', 'studio_delete_lesson(uuid)', 'studio_move_lesson(uuid, integer)',
    'studio_create_path(text, text, text, text, text, text[])',
    'studio_update_path(uuid, text, text, text, text, text, text[])',
    'studio_set_path_courses(uuid, uuid[], uuid[])', 'studio_delete_path(uuid)',
    'studio_submit(text, uuid)', 'studio_withdraw(text, uuid)',
    'review_studio_item(text, uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$grants$;
