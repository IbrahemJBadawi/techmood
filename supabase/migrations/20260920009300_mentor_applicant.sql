-- =============================================================================
-- 0093 — Applying to mentor: the basics to start, evidence whenever you have it
--
-- The founder's flow for someone who signs up to mentor:
--
--   * they use TechMood straight away — as a learner, with every service —
--     while the application waits, and the application's state is always
--     visible to them (the shell shows it; see the layout);
--   * only the basics are required to apply: a headline, what they can mentor
--     in, and their years of experience. Motivation, experience, hours,
--     languages and links are welcome but optional; the admin asks for more
--     through "needs more information" when a decision needs it;
--   * they can add evidence — a CV link and certificate links — at any time
--     while the application is open, not only in the first submission;
--   * approval makes them a level-1 mentor (0090: 15$ = 5$ + 10$); rejection
--     leaves them exactly what they were — a learner — with the reason.
--
-- 0028's version refused an application without 40 characters of motivation
-- and of experience, and a second submission while the first was pending.
-- =============================================================================

alter table public.mentor_profiles
  add column cv_url           text,
  add column certificate_urls text[] not null default '{}';

alter table public.mentor_profiles
  add constraint mentor_profiles_cv_url_is_link
    check (cv_url is null or cv_url ~* '^https?://'),
  add constraint mentor_profiles_certificates_are_links
    check (cardinality(certificate_urls) <= 10
           and array_to_string(certificate_urls, ' ') !~* '(^|\s)(?!https?://)\S');

comment on column public.mentor_profiles.certificate_urls is
  'Links to certificates the applicant offers as evidence (up to 10). Evidence for the reviewer, not a TechMood credential.';

drop function if exists public.submit_mentor_application(
  text, text, text[], integer, integer, text, text, text, text, text[]
);

create or replace function public.submit_mentor_application(
  p_headline         text,
  p_domains          text[],
  p_years            integer,
  p_bio              text default null,
  p_weekly_hours     integer default null,
  p_motivation       text default null,
  p_experience       text default null,
  p_linkedin_url     text default null,
  p_portfolio_url    text default null,
  p_languages        text[] default '{ar}',
  p_cv_url           text default null,
  p_certificate_urls text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_request uuid;
  v_status  public.role_status;
  v_certs   text[];
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  -- The basics, and only the basics.
  if char_length(coalesce(btrim(p_headline), '')) < 5 then
    raise exception 'اكتب سطراً تعريفياً قصيراً عنك كمنتور';
  end if;
  if coalesce(array_length(p_domains, 1), 0) = 0 then
    raise exception 'اختر مجال إرشاد واحداً على الأقل';
  end if;
  if p_years is null or p_years < 0 or p_years > 60 then
    raise exception 'اكتب سنوات خبرتك (من 0 إلى 60)';
  end if;

  select coalesce(array_agg(btrim(u)), '{}') into v_certs
    from unnest(coalesce(p_certificate_urls, '{}')) as u
   where btrim(u) <> '';

  if nullif(btrim(p_cv_url), '') !~* '^https?://'
     or nullif(btrim(p_linkedin_url), '') !~* '^https?://'
     or nullif(btrim(p_portfolio_url), '') !~* '^https?://'
     or exists (select 1 from unnest(v_certs) u where u !~* '^https?://') then
    raise exception 'الروابط يجب أن تبدأ بـ https://';
  end if;
  if cardinality(v_certs) > 10 then
    raise exception 'عشر شهادات كحد أقصى';
  end if;

  select pr.id, pr.status into v_request, v_status
    from public.profile_roles pr
   where pr.profile_id = v_me and pr.role = 'mentor';

  if v_status = 'approved' then
    raise exception 'أنت منتور معتمد بالفعل';
  elsif v_status = 'suspended' then
    raise exception 'هذا الدور موقوف — تواصل مع الإدارة';
  elsif v_status in ('pending_review', 'needs_more_info') then
    -- An open application is updated in place — adding evidence is not a
    -- second application. Answering "needs more information" this way puts
    -- it back in the queue, as answer_role_request does.
    update public.profile_roles
       set status = 'pending_review'
     where id = v_request;

    insert into public.role_request_events (role_request_id, actor_id, event, note)
    values (v_request, v_me, 'more_info_provided', 'حدّث بيانات طلب المنتور');
  else
    -- No application, or a rejected one: the request comes first, because the
    -- mentor_profiles row may only exist with a live application behind it.
    v_request := public.apply_for_role('mentor', nullif(btrim(p_motivation), ''), nullif(btrim(p_portfolio_url), ''));
  end if;

  insert into public.mentor_profiles (
    profile_id, headline_ar, bio_ar, domains, years_experience,
    weekly_hours, motivation_ar, experience_ar, linkedin_url, portfolio_url,
    languages, cv_url, certificate_urls, is_accepting
  )
  values (
    v_me, btrim(p_headline), nullif(btrim(p_bio), ''), p_domains, p_years,
    p_weekly_hours, nullif(btrim(p_motivation), ''), nullif(btrim(p_experience), ''),
    nullif(btrim(p_linkedin_url), ''), nullif(btrim(p_portfolio_url), ''),
    coalesce(nullif(p_languages, '{}'), '{ar}'), nullif(btrim(p_cv_url), ''), v_certs, false
  )
  on conflict (profile_id) do update set
    headline_ar      = excluded.headline_ar,
    bio_ar           = excluded.bio_ar,
    domains          = excluded.domains,
    years_experience = excluded.years_experience,
    weekly_hours     = excluded.weekly_hours,
    motivation_ar    = excluded.motivation_ar,
    experience_ar    = excluded.experience_ar,
    linkedin_url     = excluded.linkedin_url,
    portfolio_url    = excluded.portfolio_url,
    languages        = excluded.languages,
    cv_url           = excluded.cv_url,
    certificate_urls = excluded.certificate_urls;

  return v_request;
end;
$$;

revoke execute on function public.submit_mentor_application(
  text, text[], integer, text, integer, text, text, text, text, text[], text, text[]
) from public, anon;
grant execute on function public.submit_mentor_application(
  text, text[], integer, text, integer, text, text, text, text, text[], text, text[]
) to authenticated;

-- Where my mentor application stands, for the shell to show on every page
-- while it is open (and for two weeks after a rejection, with its reason).
-- No row when there is nothing to show.
create or replace function public.my_mentor_application()
returns table (
  request_id   uuid,
  status       public.role_status,
  review_note  text,
  has_details  boolean,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.status, pr.review_note,
         exists (select 1 from public.mentor_profiles mp where mp.profile_id = pr.profile_id),
         pr.created_at
    from public.profile_roles pr
   where pr.profile_id = (select auth.uid())
     and pr.role = 'mentor'
     and (pr.status in ('pending_review', 'needs_more_info')
          or (pr.status = 'rejected' and pr.reviewed_at > now() - interval '14 days'));
$$;

revoke execute on function public.my_mentor_application() from public, anon;
grant execute on function public.my_mentor_application() to authenticated;
