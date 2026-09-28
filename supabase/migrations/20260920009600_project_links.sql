-- =============================================================================
-- 0096 — A project is handed in with a link to the project; the video and the
--        write-up are welcome, not required
--
-- The founder's rule for course and path projects: the project's own link is
-- required; a YouTube walkthrough is optional. Until now every seeded project
-- required three links — GitHub, a LinkedIn post and a YouTube video — so a
-- learner without a channel, or whose work is a design on Behance, could not
-- hand in at all.
--
-- A "project link" is whichever of these the work lives at: a repository, a
-- website, a portfolio page, a Drive folder or a file. At least one is
-- required. YouTube and LinkedIn may be added; when a YouTube link is given it
-- has to be a YouTube link. Every link must be a web address.
-- =============================================================================

update public.assignments
   set required_evidence = array(
         select k from unnest(required_evidence) k
          where k not in ('github', 'linkedin', 'youtube'))
 where kind in ('course_project', 'path_project')
   and required_evidence && array['github', 'linkedin', 'youtube']::public.evidence_kind[];

-- The seeded briefs said the same three links; they now say what is asked.
update public.assignments
   set brief_ar = replace(replace(brief_ar,
         'يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
         'يُسلَّم برابط المشروع (مستودع أو موقع أو ملفات)، ويمكن إضافة فيديو شرح على YouTube ومنشور على LinkedIn.'),
         'قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
         'قابل للعرض. يُسلَّم برابط المشروع (مستودع أو موقع أو ملفات)، ويمكن إضافة فيديو شرح على YouTube ومنشور على LinkedIn.')
 where kind in ('course_project', 'path_project');

comment on column public.assignments.required_evidence is
  'Evidence kinds a submission must include. A course or path project additionally needs one project link (github, website, portfolio, drive or file) — enforced by submit_work(), 0096.';

create or replace function public.submit_work(
  p_assignment_id uuid,
  p_evidence      jsonb,               -- [{"kind":"github","url":"https://...","label":"repo"}]
  p_note          text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile    uuid := (select auth.uid());
  v_submission public.submissions%rowtype;
  v_version_id uuid;
  v_next       integer;
  v_required   public.evidence_kind[];
  v_kind       public.submission_kind;
  v_given      public.evidence_kind[];
  v_missing    public.evidence_kind[];
  v_item       jsonb;
begin
  if v_profile is null then
    raise exception 'not authenticated';
  end if;

  select required_evidence, kind into v_required, v_kind
  from public.assignments where id = p_assignment_id;

  if not found then
    raise exception 'assignment % not found', p_assignment_id;
  end if;

  -- Only non-empty links count, and every link is a web address.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) e
     where coalesce(btrim(e ->> 'url'), '') <> ''
       and (e ->> 'url') !~* '^https?://'
  ) then
    raise exception 'الروابط يجب أن تبدأ بـ http أو https';
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) e
     where e ->> 'kind' = 'youtube'
       and coalesce(btrim(e ->> 'url'), '') <> ''
       and (e ->> 'url') !~* '^https?://([a-z0-9-]+\.)?(youtube\.com|youtu\.be)/'
  ) then
    raise exception 'رابط الشرح يجب أن يكون من YouTube';
  end if;

  select coalesce(array_agg(distinct (e ->> 'kind')::public.evidence_kind), '{}')
    into v_given
  from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) as e
  where coalesce(btrim(e ->> 'url'), '') <> '';

  -- every required evidence kind must be present
  select coalesce(array_agg(r), '{}') into v_missing
  from unnest(v_required) as r
  where not (r = any (v_given));

  if array_length(v_missing, 1) is not null then
    raise exception 'missing required evidence: %', v_missing;
  end if;

  -- a project is handed in with a link to the project itself
  if v_kind in ('course_project', 'path_project')
     and not (v_given && array['github', 'website', 'portfolio', 'drive', 'file']::public.evidence_kind[]) then
    raise exception 'رابط المشروع مطلوب (مستودع أو موقع أو معرض أعمال أو ملفات)';
  end if;

  insert into public.submissions (assignment_id, profile_id, status, current_version)
  values (p_assignment_id, v_profile, 'submitted', 1)
  on conflict (assignment_id, profile_id) do update
    set status          = 'submitted',
        current_version = public.submissions.current_version + 1,
        updated_at      = now()
  returning * into v_submission;

  v_next := v_submission.current_version;

  insert into public.submission_versions (submission_id, version, note_ar)
  values (v_submission.id, v_next, p_note)
  returning id into v_version_id;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) e
     where coalesce(btrim(e ->> 'url'), '') <> ''
  loop
    insert into public.submission_evidence (version_id, kind, url, label)
    values (
      v_version_id,
      (v_item ->> 'kind')::public.evidence_kind,
      btrim(v_item ->> 'url'),
      v_item ->> 'label'
    );
  end loop;

  return v_submission.id;
end;
$$;
