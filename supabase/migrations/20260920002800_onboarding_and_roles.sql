-- =============================================================================
-- TechMood — 0028 Onboarding, taxonomies and the role lifecycle
--
-- What the onboarding document asks for that the schema did not have:
--   * a member-chosen username, a display name and an interface language,
--     alongside the machine-issued TechMood ID (the ID stays: it is the
--     permanent key everything else hangs off, the username is only a handle)
--   * a primary role, which must be a role the member actually holds
--   * Fields (max 3), Interests (unlimited) and Skills (unlimited) as three
--     SEPARATE axes — matching, search and recommendations all depend on the
--     separation, so one shared "tags" table would have been the wrong shape
--   * "suggest a new term", which parks the term in review instead of
--     publishing it
--   * "Request More Information" as a third admin decision, and an audit trail
--     that says how a request reached its current state
--
-- What it does NOT change: profile_roles stays the single source of truth for
-- who may enter which workspace. No parallel role table, no client-trusted
-- "active role" — the switcher in 0028's UI reads approved rows from here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profile: handle, display name, language, primary role, onboarding state
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column username                text,
  add column display_name            text,
  add column language                public.ui_language not null default 'ar',
  add column primary_role            public.user_role,
  add column onboarding_completed_at timestamptz;

-- Stored already-lowercased so a plain unique index is also the case-insensitive
-- one, and so PostgREST filters behave predictably.
alter table public.profiles
  add constraint profiles_username_unique unique (username),
  add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  add constraint profiles_username_not_reserved
    check (username is null or username not in (
      'admin', 'administrator', 'api', 'about', 'academy', 'applications',
      'auth', 'bookings', 'certificates', 'exhibition', 'help', 'home',
      'incubator', 'login', 'logout', 'marketplace', 'mentors',
      'mentor-requests', 'messages', 'new', 'onboarding', 'passport', 'review',
      'root', 'settings', 'signup', 'startups', 'support', 'system', 'teams',
      'techmood', 'verify', 'wallet', 'work'
    )),
  add constraint profiles_display_name_len
    check (display_name is null or char_length(display_name) between 2 and 60);

comment on column public.profiles.username is
  'Member-chosen handle. The TechMood ID stays the permanent identifier; this is only a readable alias.';
comment on column public.profiles.primary_role is
  'The role the app opens on. Not a rank: roles are access, not hierarchy.';

-- A primary role you do not hold would be a lie the interface then acts on.
create or replace function public.enforce_primary_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_role is not null and not exists (
    select 1 from public.profile_roles pr
    where pr.profile_id = new.id
      and pr.role = new.primary_role
      and pr.status = 'approved'
  ) then
    raise exception 'الدور الأساسي يجب أن يكون دوراً معتمداً لديك';
  end if;
  return new;
end;
$$;

create trigger profiles_primary_role_guard
  before insert or update of primary_role on public.profiles
  for each row execute function public.enforce_primary_role();

-- Losing a role must also lose it as the primary one, or the shell keeps
-- opening on a workspace the member can no longer enter.
create or replace function public.clear_revoked_primary_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := coalesce(new.profile_id, old.profile_id);
  v_role    public.user_role := coalesce(new.role, old.role);
begin
  if tg_op = 'DELETE' or new.status <> 'approved' then
    update public.profiles
       set primary_role = null
     where id = v_profile and primary_role = v_role;
  end if;
  return null;
end;
$$;

create trigger profile_roles_clear_primary
  after update or delete on public.profile_roles
  for each row execute function public.clear_revoked_primary_role();

-- Signing up with Google hands us a name and a picture in the identity payload.
-- Taking them here saves the person retyping what Google already knows, and
-- onboarding still lets them change both. Google is used to sign in and for
-- nothing else: no contacts, no calendar, no drive.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_avatar text;
begin
  v_name := coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  v_avatar := coalesce(
    nullif(btrim(v_meta ->> 'avatar_url'), ''),
    nullif(btrim(v_meta ->> 'picture'), '')
  );

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, v_name, v_avatar);

  -- everyone starts as a student, always approved
  insert into public.profile_roles (profile_id, role, status)
  values (new.id, 'student', 'approved');

  return new;
end;
$$;

-- Accounts that existed before onboarding did keep onboarding_completed_at null
-- on purpose: they have no username, no fields and no interests, so the shell
-- sends them through the same six steps once, then never again.

-- ---------------------------------------------------------------------------
-- Three taxonomies, deliberately kept apart
--
--   fields    — what you work in      (max 3, they steer matching)
--   interests — what you care about   (unlimited, they steer recommendations)
--   skills    — what you can do       (unlimited, evidence can verify them)
-- ---------------------------------------------------------------------------
create table public.fields (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         text not null unique,
  name_ar      text not null,
  name_en      text not null,
  status       public.taxonomy_status not null default 'approved',
  suggested_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint fields_slug_format check (slug ~ '^[a-z0-9-]{2,60}$')
);

create table public.interests (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         text not null unique,
  name_ar      text not null,
  name_en      text not null,
  status       public.taxonomy_status not null default 'approved',
  suggested_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint interests_slug_format check (slug ~ '^[a-z0-9-]{2,60}$')
);

-- Skills already existed as a closed list; it becomes an open catalogue too.
alter table public.skills
  add column status       public.taxonomy_status not null default 'approved',
  add column suggested_by uuid references public.profiles (id) on delete set null,
  add column created_at   timestamptz not null default now();

create table public.profile_fields (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  field_id   uuid not null references public.fields (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (profile_id, field_id)
);

create table public.profile_interests (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

-- Search over ~100 terms in two languages, without shipping the list twice.
create index fields_name_trgm    on public.fields    using gin (name_ar extensions.gin_trgm_ops, name_en extensions.gin_trgm_ops);
create index interests_name_trgm on public.interests using gin (name_ar extensions.gin_trgm_ops, name_en extensions.gin_trgm_ops);

-- The cap and the "approved terms only" rule are enforced in the database, not
-- in the form: RLS can express the second, but a row count needs a trigger, and
-- both need to hold for a direct PostgREST call too.
create or replace function public.enforce_profile_fields_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.fields f where f.id = new.field_id and f.status = 'approved'
  ) then
    raise exception 'لا يمكن اختيار مجال غير معتمد';
  end if;

  if (select count(*) from public.profile_fields where profile_id = new.profile_id) > 3 then
    raise exception 'المجالات: ثلاثة كحد أقصى';
  end if;

  return null;
end;
$$;

create constraint trigger profile_fields_rules
  after insert on public.profile_fields
  for each row execute function public.enforce_profile_fields_rules();

create or replace function public.enforce_approved_interest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.interests i where i.id = new.interest_id and i.status = 'approved'
  ) then
    raise exception 'لا يمكن اختيار اهتمام غير معتمد';
  end if;
  return null;
end;
$$;

create constraint trigger profile_interests_rules
  after insert on public.profile_interests
  for each row execute function public.enforce_approved_interest();

create or replace function public.enforce_approved_skill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.skills s where s.id = new.skill_id and s.status = 'approved'
  ) then
    raise exception 'لا يمكن اختيار مهارة غير معتمدة';
  end if;
  return null;
end;
$$;

create constraint trigger profile_skills_rules
  after insert on public.profile_skills
  for each row execute function public.enforce_approved_skill();

-- ---------------------------------------------------------------------------
-- Suggesting a term. It is filed, never published.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_taxonomy_term(
  p_kind    text,
  p_name_ar text,
  p_name_en text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_slug  text;
  v_id    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  v_table := case p_kind
    when 'field'    then 'fields'
    when 'interest' then 'interests'
    when 'skill'    then 'skills'
  end;
  if v_table is null then
    raise exception 'نوع غير معروف: %', p_kind;
  end if;

  if char_length(coalesce(btrim(p_name_ar), '')) < 2
     or char_length(coalesce(btrim(p_name_en), '')) < 2 then
    raise exception 'الاسم العربي والإنجليزي مطلوبان';
  end if;

  v_slug := btrim(regexp_replace(lower(btrim(p_name_en)), '[^a-z0-9]+', '-', 'g'), '-');
  if char_length(v_slug) < 2 then
    raise exception 'تعذّر توليد معرّف من الاسم الإنجليزي';
  end if;

  -- An existing term simply comes back; suggesting it again is not an error,
  -- and must not overwrite an already-approved one.
  execute format(
    $f$
      insert into public.%I (slug, name_ar, name_en, status, suggested_by)
      values ($1, $2, $3, 'pending_review', $4)
      on conflict (slug) do update set slug = excluded.slug
      returning id
    $f$, v_table)
  into v_id
  using v_slug, btrim(p_name_ar), btrim(p_name_en), (select auth.uid());

  return v_id;
end;
$$;

create or replace function public.review_taxonomy_term(
  p_kind    text,
  p_term_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
begin
  if not public.is_admin() then
    raise exception 'مراجعة المصطلحات للإدارة فقط';
  end if;

  v_table := case p_kind
    when 'field'    then 'fields'
    when 'interest' then 'interests'
    when 'skill'    then 'skills'
  end;
  if v_table is null then
    raise exception 'نوع غير معروف: %', p_kind;
  end if;

  execute format('update public.%I set status = $1 where id = $2', v_table)
  using (case when p_approve then 'approved' else 'rejected' end)::public.taxonomy_status, p_term_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The role request trail. profile_roles says where a request stands;
-- this says how it got there, and it is append-only.
-- ---------------------------------------------------------------------------
create table public.role_request_events (
  id              uuid primary key default extensions.gen_random_uuid(),
  role_request_id uuid not null references public.profile_roles (id) on delete cascade,
  actor_id        uuid references public.profiles (id) on delete set null,
  event           public.role_request_event not null,
  note            text,
  created_at      timestamptz not null default now()
);

create index role_request_events_request on public.role_request_events (role_request_id, created_at);

-- ---------------------------------------------------------------------------
-- The mentor application. It is not a separate table: an application IS a
-- mentor_profiles row whose approved_at is still null, so approval is one
-- timestamp rather than a copy from one table into another.
-- ---------------------------------------------------------------------------
alter table public.mentor_profiles
  add column motivation_ar  text,
  add column experience_ar  text,
  add column linkedin_url   text,
  add column portfolio_url  text,
  add column weekly_hours   smallint check (weekly_hours between 1 and 40),
  add column languages      text[] not null default '{}';

comment on column public.mentor_profiles.approved_at is
  'Null means this row is still an application. Nothing public reads an unapproved mentor.';

-- A mentor could previously raise their own level through the self-update
-- policy, and the level is what sets the session price. Price, standing and
-- approval are the platform''s to set, never the mentor''s.
create or replace function public.guard_mentor_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Platform-maintained columns are still maintained: the session-completed and
  -- rating triggers update this table from inside another trigger, and an admin
  -- sets the level deliberately. Everything else is a client statement.
  if public.is_admin() or pg_trigger_depth() > 1 then
    return new;
  end if;

  new.level          := old.level;
  new.sessions_count := old.sessions_count;
  new.rating_avg     := old.rating_avg;
  new.approved_at    := old.approved_at;
  return new;
end;
$$;

create trigger mentor_profiles_guard_columns
  before update on public.mentor_profiles
  for each row execute function public.guard_mentor_profile_columns();

-- 0006 refused a mentor_profiles row to anyone without an APPROVED mentor role,
-- which made "the application is the unapproved row" impossible. The rule it was
-- protecting still holds, one step later: an unapproved row needs a live mentor
-- request behind it, and an approved row needs the approved role.
create or replace function public.enforce_mentor_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approved_at is not null then
    if not exists (
      select 1 from public.profile_roles pr
      where pr.profile_id = new.profile_id
        and pr.role = 'mentor'
        and pr.status = 'approved'
    ) then
      raise exception 'profile % does not hold an approved mentor role', new.profile_id;
    end if;
  else
    if not exists (
      select 1 from public.profile_roles pr
      where pr.profile_id = new.profile_id
        and pr.role = 'mentor'
        and pr.status in ('pending_review', 'needs_more_info', 'approved', 'suspended')
    ) then
      raise exception 'profile % has not applied to be a mentor', new.profile_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mentor_profiles_require_role on public.mentor_profiles;
create trigger mentor_profiles_require_role
  before insert or update of profile_id, approved_at on public.mentor_profiles
  for each row execute function public.enforce_mentor_role();

revoke execute on function public.enforce_mentor_role() from public, anon, authenticated;

create or replace function public.submit_mentor_application(
  p_headline      text,
  p_bio           text,
  p_domains       text[],
  p_years         integer,
  p_weekly_hours  integer,
  p_motivation    text,
  p_experience    text,
  p_linkedin_url  text default null,
  p_portfolio_url text default null,
  p_languages     text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_request uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;

  if char_length(coalesce(btrim(p_motivation), '')) < 40 then
    raise exception 'اشرح دافعك للإرشاد في 40 حرفاً على الأقل';
  end if;
  if char_length(coalesce(btrim(p_experience), '')) < 40 then
    raise exception 'اشرح خبرتك العملية في 40 حرفاً على الأقل';
  end if;
  if coalesce(array_length(p_domains, 1), 0) = 0 then
    raise exception 'اختر مجال إرشاد واحداً على الأقل';
  end if;

  -- The request comes first: the mentor_profiles row is only allowed to exist
  -- because a live application stands behind it.
  v_request := public.apply_for_role('mentor', btrim(p_motivation), p_portfolio_url);

  insert into public.mentor_profiles (
    profile_id, headline_ar, bio_ar, domains, years_experience,
    weekly_hours, motivation_ar, experience_ar, linkedin_url, portfolio_url,
    languages, is_accepting
  )
  values (
    v_me, p_headline, p_bio, p_domains, p_years,
    p_weekly_hours, btrim(p_motivation), btrim(p_experience), p_linkedin_url, p_portfolio_url,
    p_languages, false
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
    languages        = excluded.languages;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applying, answering, deciding
-- ---------------------------------------------------------------------------
create or replace function public.apply_for_role(
  p_role         public.user_role,
  p_note         text default null,
  p_evidence_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_id     uuid;
  v_status public.role_status;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_role = 'admin' then
    raise exception 'دور الإدارة لا يُطلب — يُمنح من إدارة أخرى';
  end if;
  if p_role = 'student' then
    raise exception 'دور الطالب مفعّل تلقائياً لكل حساب';
  end if;

  select pr.id, pr.status into v_id, v_status
    from public.profile_roles pr
   where pr.profile_id = v_me and pr.role = p_role;

  if v_id is not null then
    if v_status = 'approved' then
      raise exception 'هذا الدور مفعّل لديك بالفعل';
    end if;
    if v_status = 'suspended' then
      raise exception 'هذا الدور موقوف — تواصل مع الإدارة';
    end if;
    if v_status = 'pending_review' then
      raise exception 'طلبك قيد المراجعة بالفعل';
    end if;

    update public.profile_roles
       set status           = 'pending_review',
           application_note = coalesce(p_note, application_note),
           evidence_url     = coalesce(p_evidence_url, evidence_url),
           reviewed_by      = null,
           reviewed_at      = null,
           review_note      = null
     where id = v_id;
  else
    insert into public.profile_roles (profile_id, role, status, application_note, evidence_url)
    values (v_me, p_role, 'pending_review', p_note, p_evidence_url)
    returning id into v_id;
  end if;

  insert into public.role_request_events (role_request_id, actor_id, event, note)
  values (v_id, v_me, 'submitted', p_note);

  return v_id;
end;
$$;

-- Answering a "we need more information" without opening a second request.
create or replace function public.answer_role_request(p_request uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  rec   record;
begin
  select * into rec from public.profile_roles where id = p_request;
  if rec is null then
    raise exception 'الطلب غير موجود';
  end if;
  if rec.profile_id <> v_me then
    raise exception 'هذا الطلب ليس لك';
  end if;
  if rec.status <> 'needs_more_info' then
    raise exception 'هذا الطلب لا ينتظر معلومات إضافية';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'اكتب ردّاً واضحاً';
  end if;

  update public.profile_roles
     set status           = 'pending_review',
         application_note = btrim(p_note)
   where id = p_request;

  insert into public.role_request_events (role_request_id, actor_id, event, note)
  values (p_request, v_me, 'more_info_provided', btrim(p_note));
end;
$$;

create or replace function public.decide_role_request(
  p_request  uuid,
  p_decision public.role_request_event,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  rec      record;
  v_status public.role_status;
  v_title  text;
begin
  if not public.is_admin() then
    raise exception 'مراجعة طلبات الأدوار للإدارة فقط';
  end if;

  select * into rec from public.profile_roles where id = p_request;
  if rec is null then
    raise exception 'الطلب غير موجود';
  end if;

  v_status := case p_decision
    when 'approved'            then 'approved'
    when 'rejected'            then 'rejected'
    when 'more_info_requested' then 'needs_more_info'
    when 'suspended'           then 'suspended'
    when 'reinstated'          then 'approved'
  end::public.role_status;

  if v_status is null then
    raise exception 'قرار غير صالح: %', p_decision;
  end if;
  if p_decision = 'more_info_requested' and char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'وضّح للمتقدّم ما المعلومات المطلوبة';
  end if;
  if p_decision = 'rejected' and char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'سبب الرفض مطلوب — الحساب يبقى، والشخص يستحق تفسيراً';
  end if;

  update public.profile_roles
     set status      = v_status,
         reviewed_by = v_me,
         reviewed_at = now(),
         review_note = btrim(p_note)
   where id = p_request;

  insert into public.role_request_events (role_request_id, actor_id, event, note)
  values (p_request, v_me, p_decision, btrim(p_note));

  -- Approving a mentor turns their application into a live mentor profile.
  if rec.role = 'mentor' then
    if v_status = 'approved' then
      insert into public.mentor_profiles (profile_id, approved_at, is_accepting)
      values (rec.profile_id, now(), true)
      on conflict (profile_id) do update
        set approved_at  = coalesce(mentor_profiles.approved_at, now()),
            is_accepting = true;
    elsif v_status = 'suspended' then
      update public.mentor_profiles set is_accepting = false where profile_id = rec.profile_id;
    end if;
  end if;

  v_title := case p_decision
    when 'approved'            then 'تم اعتماد دورك'
    when 'reinstated'          then 'أُعيد تفعيل دورك'
    when 'rejected'            then 'طلب الدور لم يُقبل'
    when 'more_info_requested' then 'نحتاج معلومات إضافية'
    when 'suspended'           then 'تم إيقاف دورك مؤقتاً'
  end;

  perform public.notify(
    rec.profile_id, 'role_review', v_title, btrim(p_note), '/settings/roles'
  );
end;
$$;

-- Withdrawing a request you no longer want. Kept as a function so the trail
-- records it; the delete policy on profile_roles still exists for admins.
create or replace function public.withdraw_role_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  select * into rec from public.profile_roles where id = p_request;
  if rec is null or rec.profile_id <> (select auth.uid()) then
    raise exception 'هذا الطلب ليس لك';
  end if;
  if rec.status = 'approved' then
    raise exception 'لا يمكن سحب دور معتمد — تواصل مع الإدارة';
  end if;

  insert into public.role_request_events (role_request_id, actor_id, event, note)
  values (p_request, rec.profile_id, 'withdrawn', null);

  delete from public.profile_roles where id = p_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers the interface needs
-- ---------------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,30}$'
     and not exists (
       select 1 from public.profiles p
        where p.username = p_username and p.id is distinct from (select auth.uid())
     );
$$;

-- The one question the shell asks on every request: may this person enter?
create or replace function public.can_enter_role(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_role);
$$;

comment on function public.can_enter_role is
  'A pending role is visible but not enterable. Visibility is the UI''s business; entry is this function''s.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fields             enable row level security;
alter table public.interests          enable row level security;
alter table public.profile_fields     enable row level security;
alter table public.profile_interests  enable row level security;
alter table public.role_request_events enable row level security;

-- Catalogues: everyone reads the approved list; you also see the term you
-- suggested, so "under review" is honest rather than a term that vanished.
create policy fields_read on public.fields
  for select to anon, authenticated
  using (status = 'approved' or suggested_by = (select auth.uid()) or public.is_admin());

create policy fields_admin_write on public.fields
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy interests_read on public.interests
  for select to anon, authenticated
  using (status = 'approved' or suggested_by = (select auth.uid()) or public.is_admin());

create policy interests_admin_write on public.interests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The skills catalogue already had a read-all policy from 0011; unapproved
-- suggestions must not leak into it.
drop policy if exists skills_read_all on public.skills;
create policy skills_read on public.skills
  for select to anon, authenticated
  using (status = 'approved' or suggested_by = (select auth.uid()) or public.is_admin());

create policy profile_fields_read on public.profile_fields
  for select to anon, authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = profile_id and (p.is_public or p.id = (select auth.uid()))
  ) or public.is_admin());

create policy profile_fields_write on public.profile_fields
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

create policy profile_interests_read on public.profile_interests
  for select to anon, authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = profile_id and (p.is_public or p.id = (select auth.uid()))
  ) or public.is_admin());

create policy profile_interests_write on public.profile_interests
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- Append-only: the applicant and the admins read it, nobody updates or deletes
-- it, and only the SECURITY DEFINER functions above write to it.
create policy role_request_events_read on public.role_request_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profile_roles pr
       where pr.id = role_request_id and pr.profile_id = (select auth.uid())
    )
  );

-- An unapproved mentor is an applicant, not a mentor. Before this, every
-- application would have appeared in the public mentor list.
drop policy if exists mentor_profiles_read on public.mentor_profiles;
create policy mentor_profiles_read on public.mentor_profiles
  for select to anon, authenticated
  using (
    approved_at is not null
    or profile_id = (select auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- Append-only in privilege as well as policy.
revoke insert, update, delete on public.role_request_events from authenticated;

revoke execute on function public.enforce_primary_role()             from public, anon, authenticated;
revoke execute on function public.clear_revoked_primary_role()       from public, anon, authenticated;
revoke execute on function public.enforce_profile_fields_rules()     from public, anon, authenticated;
revoke execute on function public.enforce_approved_interest()        from public, anon, authenticated;
revoke execute on function public.enforce_approved_skill()           from public, anon, authenticated;
revoke execute on function public.guard_mentor_profile_columns()     from public, anon, authenticated;

-- A policy that says "... or public.is_admin()" and applies `to anon` needs anon
-- to be able to call it. It was already written that way for profiles in 0011,
-- so a signed-out visitor reading a public profile hit "permission denied" —
-- for anon it simply answers false, because auth.uid() is null.
grant execute on function public.is_admin()                                       to anon;

grant execute on function public.is_username_available(text)                      to anon, authenticated;
grant execute on function public.can_enter_role(public.user_role)                 to authenticated;
grant execute on function public.suggest_taxonomy_term(text, text, text)          to authenticated;
grant execute on function public.review_taxonomy_term(text, uuid, boolean)        to authenticated;
grant execute on function public.apply_for_role(public.user_role, text, text)     to authenticated;
grant execute on function public.answer_role_request(uuid, text)                  to authenticated;
grant execute on function public.decide_role_request(uuid, public.role_request_event, text) to authenticated;
grant execute on function public.withdraw_role_request(uuid)                      to authenticated;
grant execute on function public.submit_mentor_application(text, text, text[], integer, integer, text, text, text, text, text[]) to authenticated;
