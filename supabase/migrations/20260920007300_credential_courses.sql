-- =============================================================================
-- 0073 — Credential-based courses
--
-- The idea: TechMood does not try to out-produce IBM, Google, AWS, Kaggle,
-- Microsoft, HubSpot, Cisco, Fortinet or Anthropic. It takes the free
-- credentials they already issue and wraps each one in the part they cannot
-- supply — a practical task, a mentor who judges it, a skill on a record, and
-- a path that adds up to something.
--
-- What already existed, and is used rather than rebuilt:
--
--   * the path a career follows — `career_goals` and their ordered steps (0035),
--     which is exactly the "TechMood Career Path" the spec describes;
--   * the practical application — a lesson's assignment, submitted and judged
--     by a mentor (0004), which already turns approval into verified skills;
--   * the certificate at the end — course and path certificates, issued only
--     when `is_course_complete()` says so;
--   * the pattern for "somebody pasted evidence from elsewhere and a person
--     checked it" — `external_exhibitions` (0038).
--
-- What was missing is the credential itself: a lesson that says "this one is
-- earned with that provider's credential", a place for the learner to hand it
-- in, a person to check it, and a rule that the lesson — and so the course,
-- and so the certificate — is not complete until both halves are done.
--
-- The line this migration refuses to cross: **TechMood never presents another
-- organisation's credential as its own.** The provider's credential is labelled
-- as the provider's, everywhere. TechMood's certificate is for completing the
-- TechMood course around it, and says so.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Who issues
-- ---------------------------------------------------------------------------
create table public.credential_providers (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  website_url text check (website_url is null or website_url ~* '^https://'),
  -- how a reviewer confirms one of theirs is real, in a line
  verify_hint_ar text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

alter table public.credential_providers enable row level security;

create policy credential_providers_read on public.credential_providers
  for select to anon, authenticated using (true);

create policy credential_providers_admin on public.credential_providers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.credential_providers to anon, authenticated;
grant insert, update, delete on public.credential_providers to authenticated;

-- The organisations named in the spec. Only names and home pages are seeded;
-- which of their credentials a course uses is a decision made course by
-- course, against the provider's own catalogue, not a list typed in here.
insert into public.credential_providers (slug, name, website_url, verify_hint_ar, sort_order) values
  ('anthropic',   'Anthropic',                     'https://www.anthropic.com',   'افتح رابط الشهادة وتأكّد أن الاسم واسم الدورة يطابقان.', 1),
  ('ibm',         'IBM SkillsBuild',               'https://skillsbuild.org',     'الشارة الرقمية تُعرض على صفحة المُصدِر؛ طابق الاسم والتاريخ.', 2),
  ('google',      'Google Skills',                 null,                          'طابق اسم صاحب الشارة واسم المهارة على صفحتها العامة.', 3),
  ('aws',         'AWS Skill Builder',             'https://skillbuilder.aws',    'الشارة الرقمية تُعرض على صفحة المُصدِر؛ طابق الاسم والتاريخ.', 4),
  ('kaggle',      'Kaggle Learn',                  'https://www.kaggle.com/learn','شهادة Kaggle تحمل اسم الحساب واسم الدورة.', 5),
  ('microsoft',   'Microsoft Learn',               'https://learn.microsoft.com', 'فرّق بين شارة إتمام تدريب وشهادة رسمية تتطلّب امتحاناً.', 6),
  ('hubspot',     'HubSpot Academy',               'https://academy.hubspot.com', 'طابق الاسم وتاريخ الانتهاء إن وُجد.', 7),
  ('cisco',       'Cisco Networking Academy',      'https://www.netacad.com',     'الشارة الرقمية تُعرض على صفحة المُصدِر؛ طابق الاسم والتاريخ.', 8),
  ('fortinet',    'Fortinet Training Institute',   null,                          'طابق المستوى المذكور في الشهادة مع المطلوب في الدرس.', 9);

-- ---------------------------------------------------------------------------
-- A lesson that is earned with a credential
--
-- A lesson with a row here is a credential lesson. The row can exist before
-- the exact credential is chosen — `credential_name` and `credential_url` stay
-- empty while a course is being drafted — but a course cannot be published
-- with an empty slot, because a learner cannot earn a credential nobody named.
-- ---------------------------------------------------------------------------
create table public.lesson_credentials (
  lesson_id       uuid primary key references public.lessons (id) on delete cascade,
  provider_id     uuid not null references public.credential_providers (id) on delete restrict,
  credential_name text,
  -- the provider's own page for the course or badge, where it is earned
  credential_url  text check (credential_url is null or credential_url ~* '^https://'),
  -- a credential lesson may, rarely, be the credential alone; by default the
  -- practical task is required, because collecting links is not learning
  requires_application boolean not null default true,
  note_ar         text,
  created_at      timestamptz not null default now()
);

alter table public.lesson_credentials enable row level security;

create policy lesson_credentials_read on public.lesson_credentials
  for select to anon, authenticated using (true);

create policy lesson_credentials_admin on public.lesson_credentials
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.lesson_credentials to anon, authenticated;
grant insert, update, delete on public.lesson_credentials to authenticated;

-- ---------------------------------------------------------------------------
-- What the learner hands in
-- ---------------------------------------------------------------------------
create table public.credential_submissions (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  provider_id    uuid not null references public.credential_providers (id) on delete restrict,
  -- the credential itself, frozen as it was named when it was earned: a
  -- provider renaming a course later must not rewrite somebody's record
  credential_name text not null,
  evidence_url   text not null check (evidence_url ~* '^https?://'),
  credential_code text,
  issued_on      date,
  status         public.credential_status not null default 'submitted',
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  submitted_at   timestamptz not null default now(),

  unique (profile_id, lesson_id),
  constraint credential_issued_not_future check (issued_on is null or issued_on <= current_date)
);

create index credential_submissions_queue_idx on public.credential_submissions (status, submitted_at);

alter table public.credential_submissions enable row level security;

-- Your own, always. A reviewer's, while it is theirs to review. Everybody's
-- once verified — a verified credential is a public claim on a public profile,
-- which is why `profile_credentials()` below still asks the profile's own
-- visibility before showing it.
create policy credential_submissions_read on public.credential_submissions
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
    or public.is_mentor()
  );

grant select on public.credential_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- The four halves of a credential lesson, in one place
-- ---------------------------------------------------------------------------
create or replace function public.is_credential_lesson(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lesson_credentials lc where lc.lesson_id = p_lesson);
$$;

grant execute on function public.is_credential_lesson(uuid) to anon, authenticated;

-- The practical half: every required assignment on the lesson approved. A
-- lesson with no required assignment has nothing to apply — which is why the
-- publish guard below refuses a credential lesson that requires application
-- and has no task to apply it in.
create or replace function public.credential_application_done(p_profile uuid, p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not coalesce((select lc.requires_application from public.lesson_credentials lc
                        where lc.lesson_id = p_lesson), false) then true
    else exists (
      select 1 from public.assignments a
       where a.lesson_id = p_lesson and a.is_required
    ) and not exists (
      select 1 from public.assignments a
      left join public.submissions s
             on s.assignment_id = a.id and s.profile_id = p_profile
       where a.lesson_id = p_lesson and a.is_required
         and coalesce(s.status, 'draft') <> 'approved'
    )
  end;
$$;

create or replace function public.credential_verified(p_profile uuid, p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.credential_submissions cs
     where cs.profile_id = p_profile and cs.lesson_id = p_lesson and cs.status = 'verified'
  );
$$;

-- Learning → Applied → Credential submitted → Verified → Completed, read off
-- the records rather than stored beside them.
create or replace function public.credential_lesson_state(p_lesson uuid)
returns table (
  is_credential   boolean,
  provider_name   text,
  credential_name text,
  credential_url  text,
  requires_application boolean,
  applied         boolean,
  submitted       boolean,
  credential_status public.credential_status,
  review_note     text,
  verified        boolean,
  completed       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select true,
         p.name,
         lc.credential_name,
         lc.credential_url,
         lc.requires_application,
         public.credential_application_done(me.id, p_lesson),
         cs.id is not null,
         cs.status,
         cs.review_note,
         coalesce(cs.status = 'verified', false),
         exists (select 1 from public.lesson_progress lp
                  where lp.profile_id = me.id and lp.lesson_id = p_lesson
                    and lp.status = 'completed')
    from public.lesson_credentials lc
    join public.credential_providers p on p.id = lc.provider_id
    cross join me
    left join public.credential_submissions cs
           on cs.lesson_id = lc.lesson_id and cs.profile_id = me.id
   where lc.lesson_id = p_lesson;
$$;

grant execute on function public.credential_lesson_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Handing it in, and checking it
-- ---------------------------------------------------------------------------
create or replace function public.submit_credential(
  p_lesson   uuid,
  p_url      text,
  p_code     text default null,
  p_issued   date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_lc   public.lesson_credentials%rowtype;
  v_id   uuid;
  v_prev public.credential_status;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_lc from public.lesson_credentials where lesson_id = p_lesson;
  if not found then
    raise exception 'هذا الدرس لا يطلب شهادة خارجية';
  end if;

  if v_lc.credential_name is null then
    raise exception 'لم تُحدَّد شهادة هذا الدرس بعد';
  end if;

  if coalesce(btrim(p_url), '') !~* '^https?://' then
    raise exception 'رابط الشهادة يجب أن يبدأ بـ http أو https';
  end if;

  select cs.id, cs.status into v_id, v_prev
    from public.credential_submissions cs
   where cs.profile_id = v_me and cs.lesson_id = p_lesson;

  if v_prev = 'verified' then
    raise exception 'هذه الشهادة موثّقة بالفعل';
  end if;

  if v_id is null then
    insert into public.credential_submissions
      (profile_id, lesson_id, provider_id, credential_name, evidence_url, credential_code, issued_on)
    values (v_me, p_lesson, v_lc.provider_id, v_lc.credential_name, btrim(p_url),
            nullif(btrim(coalesce(p_code, '')), ''), p_issued)
    returning id into v_id;
  else
    -- a rejected one can be handed in again; the old verdict is cleared, not kept
    -- beside the new link, because it was about a different link
    update public.credential_submissions
       set evidence_url    = btrim(p_url),
           credential_code = nullif(btrim(coalesce(p_code, '')), ''),
           issued_on       = p_issued,
           status          = 'submitted',
           reviewed_by     = null,
           reviewed_at     = null,
           review_note     = null,
           submitted_at    = now()
     where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.submit_credential(uuid, text, text, date) to authenticated;

-- The lesson's own skills, once both halves are done — whichever finished last
-- calls this, so the order a learner does them in does not matter.
create or replace function public.grant_credential_lesson_skills(p_profile uuid, p_lesson uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.credential_verified(p_profile, p_lesson)
          and public.credential_application_done(p_profile, p_lesson)) then
    return;
  end if;

  insert into public.profile_skills (profile_id, skill_id, is_verified)
  select p_profile, ls.skill_id, true
    from public.lesson_skills ls
    join public.skills s on s.id = ls.skill_id and s.status = 'approved'
   where ls.lesson_id = p_lesson
  on conflict (profile_id, skill_id) do update set is_verified = true;
end;
$$;

revoke execute on function public.grant_credential_lesson_skills(uuid, uuid) from public, anon, authenticated;

-- Checking is a person opening the link at the provider. There is no API here
-- that could do it — a provider's badge page is the only authority — so the
-- honest mechanism is the one external exhibitions already use: a reviewer
-- who is not the learner, and a note when the answer is no.
create or replace function public.review_credential(
  p_submission uuid,
  p_accept     boolean,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_row public.credential_submissions%rowtype;
begin
  if not (public.is_admin() or public.is_mentor()) then
    raise exception 'التوثيق للإدارة والمنتورز فقط';
  end if;

  select * into v_row from public.credential_submissions where id = p_submission;
  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if v_row.profile_id = v_me then
    raise exception 'لا يوثّق أحد شهادته بنفسه';
  end if;

  if v_row.status <> 'submitted' then
    raise exception 'تمّت مراجعة هذه الشهادة';
  end if;

  if not p_accept and coalesce(btrim(p_note), '') = '' then
    raise exception 'الرفض يحتاج سبباً يقرؤه صاحب الشهادة';
  end if;

  update public.credential_submissions
     set status      = case when p_accept then 'verified' else 'rejected' end::public.credential_status,
         reviewed_by = v_me,
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_submission;

  if p_accept then
    perform public.grant_credential_lesson_skills(v_row.profile_id, v_row.lesson_id);
  end if;

  perform public.notify(
    v_row.profile_id, 'academy',
    case when p_accept then 'وُثّقت شهادتك' else 'لم تُوثَّق شهادتك' end,
    coalesce(p_note, v_row.credential_name),
    null, 'lesson', v_row.lesson_id);
end;
$$;

grant execute on function public.review_credential(uuid, boolean, text) to authenticated;

create or replace function public.credential_review_queue()
returns table (
  id              uuid,
  learner_name    text,
  techmood_id     text,
  provider_name   text,
  credential_name text,
  evidence_url    text,
  credential_code text,
  issued_on       date,
  lesson_title    text,
  course_title    text,
  application_done boolean,
  submitted_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cs.id, coalesce(pr.display_name, pr.full_name), pr.techmood_id,
         p.name, cs.credential_name, cs.evidence_url, cs.credential_code, cs.issued_on,
         l.title_ar, c.title_ar,
         public.credential_application_done(cs.profile_id, cs.lesson_id),
         cs.submitted_at
    from public.credential_submissions cs
    join public.profiles pr on pr.id = cs.profile_id
    join public.credential_providers p on p.id = cs.provider_id
    join public.lessons l on l.id = cs.lesson_id
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
   where cs.status = 'submitted'
     and (public.is_admin() or public.is_mentor())
     and cs.profile_id <> (select auth.uid())
   order by cs.submitted_at;
$$;

grant execute on function public.credential_review_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- The rule: a credential lesson is not complete until both halves are
--
-- `toggleLesson` lets a learner tick an ordinary lesson done — reading is
-- theirs to vouch for. A credential lesson is not: ticking it would let a
-- course, and then a certificate, be finished by collecting links. So the
-- database refuses the tick until the credential is verified and the practical
-- task approved. Everything downstream — `course_lessons_completed()`,
-- `is_course_complete()`, `issue_certificate()` — follows without a change.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_credential_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and public.is_credential_lesson(new.lesson_id) then

    if not public.credential_application_done(new.profile_id, new.lesson_id) then
      raise exception 'هذا الدرس يكتمل بالتطبيق العملي: سلّم المهمة ويعتمدها منتور أولاً';
    end if;

    if not public.credential_verified(new.profile_id, new.lesson_id) then
      raise exception 'هذا الدرس يكتمل بشهادة موثّقة: سلّم رابطها وانتظر التوثيق';
    end if;
  end if;

  return new;
end;
$$;

create trigger lesson_progress_credential_gate
  before insert or update of status on public.lesson_progress
  for each row execute function public.enforce_credential_lesson();

-- The practical task's approval still grants the skills the *task* demands.
-- What it no longer grants alone is the lesson's own skills on a credential
-- lesson — those wait for the credential too, then open together.
create or replace function public.on_evaluation_grant_skills()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner      uuid;
  v_assignment uuid;
  v_lesson     uuid;
  v_held       boolean := false;
begin
  if new.decision <> 'approved' then
    return new;
  end if;

  select s.profile_id, a.id, a.lesson_id into v_owner, v_assignment, v_lesson
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
   where s.id = new.submission_id;

  v_held := v_lesson is not null
            and public.is_credential_lesson(v_lesson)
            and not public.credential_verified(v_owner, v_lesson);

  -- The owner of the submission, the same person the XP goes to (see 0036).
  insert into public.profile_skills (profile_id, skill_id, is_verified)
  select v_owner, sk.id, true
    from public.submission_skills(new.submission_id) sk
   where not (
     v_held
     and exists (select 1 from public.lesson_skills ls
                  where ls.lesson_id = v_lesson and ls.skill_id = sk.id)
     and not exists (select 1 from public.assignment_skills asg
                      where asg.assignment_id = v_assignment and asg.skill_id = sk.id)
   )
  on conflict (profile_id, skill_id) do update set is_verified = true;

  if v_lesson is not null and public.is_credential_lesson(v_lesson) then
    perform public.grant_credential_lesson_skills(v_owner, v_lesson);
  end if;

  return new;
end;
$$;

-- A course is not published with an empty credential slot, nor with a
-- credential lesson that demands practice and gives no task to practise in.
create or replace function public.guard_course_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1 from public.modules m
        join public.lessons l on l.module_id = m.id
       where m.course_id = new.id
    ) then
      raise exception 'لا يمكن نشر دورة بلا دروس: اكتب دروسها أولاً';
    end if;

    if exists (
      select 1 from public.lesson_credentials lc
        join public.lessons l on l.id = lc.lesson_id
        join public.modules m on m.id = l.module_id
       where m.course_id = new.id
         and (lc.credential_name is null or lc.credential_url is null)
    ) then
      raise exception 'في الدورة درس شهادة لم تُحدَّد شهادته بعد: اسمها ورابطها عند المُصدِر';
    end if;

    if exists (
      select 1 from public.lesson_credentials lc
        join public.lessons l on l.id = lc.lesson_id
        join public.modules m on m.id = l.module_id
       where m.course_id = new.id
         and lc.requires_application
         and not exists (select 1 from public.assignments a
                          where a.lesson_id = lc.lesson_id and a.is_required)
    ) then
      raise exception 'في الدورة درس شهادة يطلب تطبيقاً عملياً ولا مهمة فيه';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- What the record shows
-- ---------------------------------------------------------------------------
-- A course's credential progress for the person reading it: "7/7 verified".
create or replace function public.course_credential_progress(p_course uuid)
returns table (
  credential_lessons integer,
  applied            integer,
  submitted          integer,
  verified           integer,
  completed          integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  lessons as (
    select lc.lesson_id
      from public.lesson_credentials lc
      join public.lessons l on l.id = lc.lesson_id
      join public.modules m on m.id = l.module_id
     where m.course_id = p_course
  )
  select
    (select count(*)::int from lessons),
    (select count(*)::int from lessons, me
      where public.credential_application_done(me.id, lessons.lesson_id)),
    (select count(*)::int from lessons, me
      where exists (select 1 from public.credential_submissions cs
                     where cs.lesson_id = lessons.lesson_id and cs.profile_id = me.id)),
    (select count(*)::int from lessons, me
      where public.credential_verified(me.id, lessons.lesson_id)),
    (select count(*)::int from lessons, me
      where exists (select 1 from public.lesson_progress lp
                     where lp.lesson_id = lessons.lesson_id and lp.profile_id = me.id
                       and lp.status = 'completed'));
$$;

grant execute on function public.course_credential_progress(uuid) to authenticated;

-- The profile's "Credentials" section: other organisations' credentials, named
-- as theirs, and only the ones a person checked. It follows the same
-- visibility switch as TechMood's own certificates.
create or replace function public.profile_credentials(p_profile uuid)
returns table (
  provider_slug   text,
  provider_name   text,
  credential_name text,
  evidence_url    text,
  issued_on       date,
  verified_at     timestamptz,
  course_title    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.name, cs.credential_name, cs.evidence_url, cs.issued_on, cs.reviewed_at, c.title_ar
    from public.credential_submissions cs
    join public.credential_providers p on p.id = cs.provider_id
    join public.lessons l on l.id = cs.lesson_id
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
   where cs.profile_id = p_profile
     and cs.status = 'verified'
     and public.can_see_profile_section(p_profile, 'certificates')
   order by p.sort_order, cs.reviewed_at;
$$;

grant execute on function public.profile_credentials(uuid) to anon, authenticated;

-- Why a skill is on a profile. A verified skill with no reason behind it is a
-- tag; with its evidence — the provider's credential, the practical task a
-- mentor approved and the stars they gave — it is a claim a reader can check.
create or replace function public.profile_skill_evidence(p_profile uuid)
returns table (
  skill_slug   text,
  skill_name   text,
  source_kind  text,
  source_label text,
  provider     text,
  stars        smallint,
  link         text,
  at           timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- an external credential, on a lesson that teaches the skill
  select s.slug, s.name_ar, 'credential', cs.credential_name, p.name, null::smallint,
         cs.evidence_url, cs.reviewed_at
    from public.credential_submissions cs
    join public.credential_providers p on p.id = cs.provider_id
    join public.lesson_skills ls on ls.lesson_id = cs.lesson_id
    join public.skills s on s.id = ls.skill_id
   where cs.profile_id = p_profile and cs.status = 'verified'
     and public.can_see_profile_section(p_profile, 'skills')

  union all

  -- practical work a mentor approved, with the stars they gave it
  select sk.slug, sk.name_ar, 'application', a.title_ar, null, e.stars,
         null, e.created_at
    from public.submissions sub
    join public.assignments a on a.id = sub.assignment_id
    join public.evaluations e on e.submission_id = sub.id and e.decision = 'approved'
    cross join lateral public.submission_skills(sub.id) sk
   where sub.profile_id = p_profile
     and public.can_see_profile_section(p_profile, 'skills')

  order by 2, 8;
$$;

grant execute on function public.profile_skill_evidence(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A starting point: the Claude Code course, as a draft
--
-- The structure the spec describes, with the one lesson and the final project
-- it spelled out. The lesson's credential slot names the provider and leaves
-- the credential itself empty on purpose: which Anthropic credential it maps to
-- is checked against Anthropic's own catalogue before it is typed in, and the
-- publish guard above will not let the course go live until it is.
-- ---------------------------------------------------------------------------
insert into public.skills (slug, name_ar, name_en, status) values
  ('claude-code',             'Claude Code',                 'Claude Code',             'approved'),
  ('ai-assisted-development', 'التطوير بمساعدة الذكاء الاصطناعي', 'AI-Assisted Development', 'approved'),
  ('ai-coding-workflow',      'سير عمل البرمجة بالذكاء الاصطناعي', 'AI Coding Workflow',      'approved')
on conflict (slug) do nothing;

do $$
declare
  v_course uuid;
  v_module uuid;
  v_final  uuid;
  v_lesson uuid;
begin
  insert into public.courses (slug, title_ar, title_en, description_ar, status, estimated_hours)
  values ('claude-code', 'Claude Code', 'Claude Code',
          'دورة مبنية على شهادات: كل درس يُكسب بشهادة من Anthropic وتطبيق عملي يقيّمه منتور، وتنتهي بمشروع متكامل.',
          'draft', 20)
  on conflict (slug) do nothing
  returning id into v_course;

  if v_course is null then
    return;  -- already there; a re-run must not duplicate it
  end if;

  insert into public.modules (course_id, title_ar, sort_order)
  values (v_course, 'دروس الشهادات', 1) returning id into v_module;

  insert into public.modules (course_id, title_ar, sort_order)
  values (v_course, 'المشروع النهائي', 2) returning id into v_final;

  insert into public.lessons (module_id, title_ar, title_en, kind, summary_ar, sort_order)
  values (v_module, 'أساسيات Claude Code', 'Claude Code Fundamentals', 'reading',
          'المهارات التي تغطيها الشهادة، المفاهيم المطلوبة، الأدوات، وسير العمل.', 1)
  returning id into v_lesson;

  insert into public.lesson_credentials (lesson_id, provider_id, requires_application, note_ar)
  select v_lesson, p.id, true, 'حدّد الشهادة من كتالوج Anthropic قبل نشر الدورة.'
    from public.credential_providers p where p.slug = 'anthropic';

  insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
  values ('lesson_assignment', v_lesson, 'تطبيق عملي: تحسين مشروع موجود بـ Claude Code',
          'استخدم Claude Code لتحليل مشروع موجود، حدّد المشاكل، ونفّذ تحسينات محدّدة، ثم ارفع رابط النتيجة.',
          array['github']::public.evidence_kind[], true);

  insert into public.lesson_skills (lesson_id, skill_id)
  select v_lesson, s.id from public.skills s
   where s.slug in ('claude-code', 'ai-assisted-development', 'ai-coding-workflow');

  insert into public.lessons (module_id, title_ar, title_en, kind, summary_ar, sort_order)
  values (v_final, 'المشروع النهائي', 'Final Claude Code Project', 'exercise',
          'ابنِ أو حسّن مشروعاً برمجياً حقيقياً باستخدام Claude Code.', 1);

  insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
  values ('course_project', v_course, 'مشروع نهائي: بناء أو تحسين مشروع حقيقي بـ Claude Code',
          'المستودع، العرض، وصف المشروع، التقنيات، سير العمل مع الذكاء الاصطناعي، ما استُخدم Claude Code فيه، وتأمّلك الشخصي.',
          array['github']::public.evidence_kind[], true);
end;
$$;
