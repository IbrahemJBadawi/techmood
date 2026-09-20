-- =============================================================================
-- TechMood — 0005 Certificates
--
-- A certificate is issued from proven work, never from a checkbox: the eligibility
-- functions below require the lessons to be completed AND every required piece of
-- work to have an APPROVED evaluation. This is what keeps the platform an evidence
-- record rather than a video-watching tracker.
--
-- Every certificate carries a public Certificate ID which resolves through a QR
-- code to /verify/<code>.
-- =============================================================================

create or replace function public.generate_certificate_code(p_kind public.certificate_kind)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  prefix   constant text := case when p_kind = 'path' then 'TM-P-' else 'TM-C-' end;
  candidate text;
  i int;
begin
  loop
    candidate := prefix;
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.certificates c where c.certificate_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.certificates (
  id               uuid primary key default extensions.gen_random_uuid(),
  certificate_code text not null unique,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  kind             public.certificate_kind not null,
  course_id        uuid references public.courses (id) on delete restrict,
  path_id          uuid references public.learning_paths (id) on delete restrict,
  status           public.certificate_status not null default 'active',
  issued_at        timestamptz not null default now(),
  revoked_at       timestamptz,
  revoked_reason   text,
  -- Frozen at issue time. A certificate must keep saying what it said on the day
  -- it was issued even if the catalogue, the name or the scores change later.
  snapshot         jsonb not null,

  constraint certificates_target_matches_kind check (
    (kind = 'course' and course_id is not null and path_id is null) or
    (kind = 'path'   and path_id is not null and course_id is null)
  )
);

create unique index certificates_one_per_course on public.certificates (profile_id, course_id)
  where kind = 'course' and status = 'active';
create unique index certificates_one_per_path on public.certificates (profile_id, path_id)
  where kind = 'path' and status = 'active';
create index certificates_profile_idx on public.certificates (profile_id, issued_at desc);

comment on column public.certificates.snapshot is
  'Immutable record shown on the printed certificate and the verification page: '
  'holder name, TechMood ID, title, stars, xp, issue date.';

-- ---------------------------------------------------------------------------
-- Eligibility
-- ---------------------------------------------------------------------------

-- Every lesson of the course is completed.
create or replace function public.course_lessons_completed(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    left join public.lesson_progress lp
           on lp.lesson_id = l.id and lp.profile_id = p_profile
    where m.course_id = p_course
      and coalesce(lp.status, 'available') <> 'completed'
  );
$$;

-- Every REQUIRED assignment of the course has an approved submission.
create or replace function public.course_work_approved(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.assignments a
    left join public.lessons l on l.id = a.lesson_id
    left join public.modules m on m.id = l.module_id
    left join public.submissions s
           on s.assignment_id = a.id and s.profile_id = p_profile
    where a.is_required
      and (a.course_id = p_course or m.course_id = p_course)
      and coalesce(s.status, 'draft') <> 'approved'
  );
$$;

-- Every REQUIRED assessment of the course is passed.
create or replace function public.course_assessments_passed(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.assessments a
    where a.course_id = p_course
      and a.is_required
      and not exists (
        select 1 from public.assessment_attempts att
        where att.assessment_id = a.id
          and att.profile_id = p_profile
          and att.passed
      )
  );
$$;

create or replace function public.is_course_complete(p_profile uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.course_lessons_completed(p_profile, p_course)
     and public.course_work_approved(p_profile, p_course)
     and public.course_assessments_passed(p_profile, p_course);
$$;

-- A path is complete when all of its REQUIRED courses are complete and its
-- required path project (if any) is approved. Electives earn XP, not completion.
create or replace function public.is_path_complete(p_profile uuid, p_path uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.path_courses pc
      where pc.path_id = p_path
        and pc.is_required
        and not public.is_course_complete(p_profile, pc.course_id)
    )
    and not exists (
      select 1
      from public.assignments a
      left join public.submissions s
             on s.assignment_id = a.id and s.profile_id = p_profile
      where a.path_id = p_path
        and a.kind = 'path_project'
        and a.is_required
        and coalesce(s.status, 'draft') <> 'approved'
    );
$$;

-- ---------------------------------------------------------------------------
-- Issuing
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(
  p_kind   public.certificate_kind,
  p_target uuid
)
returns public.certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := (select auth.uid());
  v_profile_row public.profiles%rowtype;
  v_title   text;
  v_cert    public.certificates%rowtype;
  v_existing public.certificates%rowtype;
  v_stars   numeric;
  v_xp      integer;
begin
  if v_profile is null then
    raise exception 'not authenticated';
  end if;

  select * into v_profile_row from public.profiles where id = v_profile;

  if p_kind = 'course' then
    if not public.is_course_complete(v_profile, p_target) then
      raise exception 'course requirements are not met yet';
    end if;
    select title_ar into v_title from public.courses where id = p_target;
  else
    if not public.is_path_complete(v_profile, p_target) then
      raise exception 'path requirements are not met yet';
    end if;
    select title_ar into v_title from public.learning_paths where id = p_target;
  end if;

  -- already issued? return it rather than minting a second code
  select * into v_existing
  from public.certificates
  where profile_id = v_profile
    and status = 'active'
    and ((p_kind = 'course' and course_id = p_target) or (p_kind = 'path' and path_id = p_target));

  if found then
    return v_existing;
  end if;

  select stars_avg into v_stars from public.profile_stars where profile_id = v_profile;
  select total_xp  into v_xp    from public.profile_xp    where profile_id = v_profile;

  insert into public.certificates
    (certificate_code, profile_id, kind, course_id, path_id, snapshot)
  values (
    public.generate_certificate_code(p_kind),
    v_profile,
    p_kind,
    case when p_kind = 'course' then p_target end,
    case when p_kind = 'path'   then p_target end,
    jsonb_build_object(
      'holder_name', v_profile_row.full_name,
      'techmood_id', v_profile_row.techmood_id,
      'title',       v_title,
      'kind',        p_kind,
      'stars_avg',   v_stars,
      'total_xp',    v_xp,
      'issued_on',   to_char(now(), 'YYYY-MM-DD')
    )
  )
  returning * into v_cert;

  -- completing a course or a path is itself an XP event
  perform public.award_xp(
    v_profile,
    case when p_kind = 'course' then 'course_completed' else 'path_completed' end::public.xp_source,
    case when p_kind = 'course' then 'courses' else 'learning_paths' end,
    p_target,
    null
  );

  return v_cert;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public verification — the QR target.
-- Deliberately returns only what a verifier needs, never the holder's account.
-- ---------------------------------------------------------------------------
create or replace function public.verify_certificate(p_code text)
returns table (
  certificate_code text,
  holder_name      text,
  techmood_id      text,
  title            text,
  kind             public.certificate_kind,
  issued_at        timestamptz,
  status           public.certificate_status,
  revoked_reason   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.certificate_code,
         c.snapshot ->> 'holder_name',
         c.snapshot ->> 'techmood_id',
         c.snapshot ->> 'title',
         c.kind,
         c.issued_at,
         c.status,
         c.revoked_reason
  from public.certificates c
  where upper(trim(c.certificate_code)) = upper(trim(p_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Only an admin may revoke.
create or replace function public.revoke_certificate(p_code text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may revoke a certificate';
  end if;

  update public.certificates
     set status = 'revoked', revoked_at = now(), revoked_reason = p_reason
   where certificate_code = p_code;
end;
$$;
