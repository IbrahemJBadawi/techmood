-- =============================================================================
-- 0039 — A certificate reads in English
--
-- The certificate is the artefact people attach to an application, a CV or a
-- LinkedIn profile, and that audience does not only read Arabic. Everything on
-- the sheet was already written in English except the one line that matters
-- most: the name of the course or path it was earned on.
--
-- The snapshot is what the document renders, so the English title has to be
-- frozen into it at issue like everything else — reading it live would let a
-- later rename rewrite somebody's certificate, which is the whole reason the
-- snapshot exists. Certificates issued before this migration are backfilled
-- from the catalogue row they point at.
-- =============================================================================

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
  v_profile     uuid := (select auth.uid());
  v_profile_row public.profiles%rowtype;
  v_title       text;
  v_title_en    text;
  v_existing    public.certificates%rowtype;
  v_cert        public.certificates%rowtype;
  v_stars       numeric;
  v_xp          integer;
begin
  if v_profile is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  select * into v_profile_row from public.profiles where id = v_profile;

  if p_kind = 'course' then
    if not public.is_course_complete(v_profile, p_target) then
      raise exception 'لم تكتمل متطلبات الدورة بعد';
    end if;
    select title_ar, title_en into v_title, v_title_en from public.courses where id = p_target;
  else
    if not public.is_path_complete(v_profile, p_target) then
      raise exception 'لم تكتمل متطلبات المسار بعد';
    end if;
    select title_ar, title_en into v_title, v_title_en from public.learning_paths where id = p_target;
  end if;

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
      'title_en',    v_title_en,
      'kind',        p_kind,
      'stars_avg',   v_stars,
      'total_xp',    v_xp,
      'issued_on',   to_char(now(), 'YYYY-MM-DD')
    )
  )
  returning * into v_cert;

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

-- Certificates already issued keep their frozen Arabic title and gain the
-- English one from the row they were issued against.
update public.certificates c
   set snapshot = jsonb_set(c.snapshot, '{title_en}', to_jsonb(co.title_en))
  from public.courses co
 where co.id = c.course_id and co.title_en is not null and c.snapshot -> 'title_en' is null;

update public.certificates c
   set snapshot = jsonb_set(c.snapshot, '{title_en}', to_jsonb(lp.title_en))
  from public.learning_paths lp
 where lp.id = c.path_id and lp.title_en is not null and c.snapshot -> 'title_en' is null;

-- The returned row gains a column, so the old function has to go first.
drop function if exists public.verify_certificate(text);

create or replace function public.verify_certificate(p_code text)
returns table (
  certificate_code text,
  holder_name      text,
  techmood_id      text,
  title            text,
  title_en         text,
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
         c.snapshot ->> 'title_en',
         c.kind,
         c.issued_at,
         c.status,
         c.revoked_reason
  from public.certificates c
  where upper(trim(c.certificate_code)) = upper(trim(p_code));
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
