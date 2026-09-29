-- =============================================================================
-- 0120 — Three mentor levels for the MVP, a price range each, and an upgrade
--        the admin decides on the whole picture
--
-- The founder's decision for launch (replacing the six-level ladder):
--
--   🟢 Peer / Junior        10$ – 30$  an hour
--   🔵 Professional         25$ – 75$
--   🟣 Senior / Specialist  50$ – 150$
--
-- **The level sets the allowed price range, not the price.** Inside their
-- level's range a mentor names their own price for each kind of session
-- (0077: set_session_price / session_quote — unchanged, they read the bands
-- from here). The ranges overlap on purpose: an experienced Professional and
-- a new Senior may charge the same.
--
-- **The way up:** Member → Mentor (application approved, starts at Peer /
-- Junior unless the admin places them higher) → «Request level upgrade» →
-- the admin reviews → approved or declined, with the reason on the record.
-- Stars alone never move anyone: the admin reads experience, specialty,
-- works and projects (with links that open), what learners said, and the
-- sessions record, side by side. The sessions and rating a level lists are
-- now a guide shown to the admin (and the mentor), not a gate — a person with
-- ten years in the field is not made to wait for platform sessions first.
-- Guardrails that stay: one level at a time, one open request at a time, and
-- a wait after a decline (platform setting `level_upgrade_cooldown_days`).
--
-- The enum keeps its six values (Postgres cannot drop enum values, and old
-- upgrade requests name them); checks make L1–L3 the only ones a mentor or a
-- level row can hold.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. What each level is called and who it is for
-- ---------------------------------------------------------------------------
alter table public.mentor_levels
  add column title   text,
  add column badge   text,
  add column fits_ar text,
  add column fits_en text;

-- ---------------------------------------------------------------------------
-- 2. Anyone above the new top comes down to it; requests beyond it close
-- ---------------------------------------------------------------------------
update public.level_upgrade_requests
   set status = 'withdrawn',
       review_note = 'أُعيد تنظيم مستويات المنتورز إلى ثلاثة؛ قدّم طلباً جديداً إن أردت.',
       reviewed_at = now()
 where status = 'pending' and (to_level > 'L3' or from_level >= 'L3');

update public.mentor_profiles set level = 'L3' where level > 'L3';

delete from public.mentor_levels where level > 'L3';

-- ---------------------------------------------------------------------------
-- 3. The three levels: range, default, TechMood's percentage, and the guide
--    numbers the admin sees beside a request.
--    Level 1 keeps the founder's 33.33% (a 15$ hour: 5$ + 10$), 0090.
-- ---------------------------------------------------------------------------
update public.mentor_levels as ml
   set title              = v.title,
       badge              = v.badge,
       fits_ar            = v.fits_ar,
       fits_en            = v.fits_en,
       min_session_usd    = v.lo,
       session_price_usd  = v.dflt,
       max_session_usd    = v.hi,
       commission_pct     = v.pct,
       platform_share_usd = round(v.dflt * v.pct / 100, 2),
       mentor_share_usd   = v.dflt - round(v.dflt * v.pct / 100, 2),
       min_sessions       = v.sessions,
       min_rating         = v.rating,
       sort_order         = v.sort
  from (values
    ('L1'::public.mentor_level, 'Peer / Junior', '🟢',
     'منتور في بدايته أو زميل متقدّم يرشد من هم بعده بخطوة: متابعة، مراجعة واجبات، وإرشاد في البدايات.',
     'A mentor starting out, or an advanced peer guiding those a step behind: follow-ups, homework reviews, first steps.',
     10::numeric, 15::numeric, 30::numeric, 33.33::numeric, 0, 0::numeric, 1),
    ('L2', 'Professional', '🔵',
     'محترف يعمل في مجاله: مراجعة مشاريع، إرشاد تقني ومهني، وتحضير لسوق العمل والمقابلات.',
     'A working professional: project reviews, technical and career mentoring, getting ready for the job market.',
     25, 40, 75, 30, 20, 4.0, 2),
    ('L3', 'Senior / Specialist', '🟣',
     'خبير أو متخصص بخبرة عميقة: استشارات تخصصية، مراجعة معمارية، وتوجيه مهني متقدّم.',
     'A senior expert or specialist: specialist consulting, architecture reviews, advanced career guidance.',
     50, 100, 150, 30, 60, 4.5, 3)
  ) as v(level, title, badge, fits_ar, fits_en, lo, dflt, hi, pct, sessions, rating, sort)
 where ml.level = v.level;

alter table public.mentor_levels
  alter column title set not null,
  alter column badge set not null,
  add constraint mentor_levels_mvp_three check (level in ('L1', 'L2', 'L3'));

alter table public.mentor_profiles
  add constraint mentor_profiles_level_mvp check (level in ('L1', 'L2', 'L3'));

comment on table public.mentor_levels is
  'Three levels (MVP). A level sets the allowed price range per hour (min..max); '
  'the mentor names their own price inside it. The shares always sum to the default price. '
  'min_sessions / min_rating are a guide for the admin reviewing an upgrade, not a gate.';

-- A price a mentor set before this change is held to their level's new range
-- (session_quote already clamps when it quotes; this keeps the stored figure
-- honest on the mentor's own pricing screen too).
update public.mentor_session_types mst
   set price_usd = least(greatest(mst.price_usd, round(lv.min_session_usd * st.duration_minutes / 60.0, 2)),
                         round(lv.max_session_usd * st.duration_minutes / 60.0, 2))
  from public.mentor_profiles mp, public.mentor_levels lv, public.session_types st
 where mst.price_usd is not null
   and mp.profile_id = mst.mentor_id
   and lv.level = mp.level
   and st.id = mst.session_type_id;

insert into public.platform_settings (key, value, description_ar) values
  ('level_upgrade_cooldown_days', '30', 'كم يوماً ينتظر المنتور بعد رفض طلب ترقية قبل أن يطلب من جديد')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. The questionnaire asks for the whole picture
-- ---------------------------------------------------------------------------
alter table public.level_upgrade_questions
  add column needs_link boolean not null default false;

update public.level_upgrade_questions set is_active = false where key = 'reviews';

insert into public.level_upgrade_questions (key, question_ar, hint_ar, min_chars, sort_order, needs_link) values
  ('experience',   'ما خبرتك العملية حتى الآن؟ كم سنة، وأين، وبأي دور؟',
                   'الوظائف والمشاريع والتدريس — ما يؤهّلك للمستوى الذي تطلبه.', 60, 1, false),
  ('depth',        'ما تخصصك الذي ترشد فيه، وأين صرت أعمق؟',
                   'مجال أو اثنان بوضوح، مع ما يثبت العمق.', 60, 2, false),
  ('works',        'أعمالك ومشاريعك: ضع روابط لما بنيته أو راجعته.',
                   'مستودعات، مواقع منشورة، معرض أعمال، مقالات — رابط واحد على الأقل يمكن فتحه.', 20, 3, true),
  ('impact',       'ماذا تغيّر عند من أرشدتهم بعد جلساتك؟',
                   'من جلساتك على TechMood أو خارجها: ماذا كان عند المتعلّم قبلها، وماذا صار بعدها.', 60, 4, false),
  ('feedback',     'ماذا قال المتعلّمون في تقييماتهم، وماذا غيّرت بسببه؟',
                   null, 40, 5, false),
  ('availability', 'كم ساعة أسبوعياً تلتزم بها في المستوى الجديد، وفي أي أوقات؟',
                   null, 10, 6, false)
on conflict (key) do update
  set question_ar = excluded.question_ar, hint_ar = excluded.hint_ar, min_chars = excluded.min_chars,
      sort_order = excluded.sort_order, needs_link = excluded.needs_link, is_active = true;

-- ---------------------------------------------------------------------------
-- 5. Setting a level is the admin's decision — no longer capped by numbers
-- ---------------------------------------------------------------------------
create or replace function public.set_mentor_level(p_mentor uuid, p_level public.mentor_level)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may change a mentor level';
  end if;
  if not exists (select 1 from public.mentor_levels where level = p_level) then
    raise exception 'مستوى غير موجود: %', p_level;
  end if;
  update public.mentor_profiles set level = p_level where profile_id = p_mentor;
  if not found then
    raise exception 'ليس ملف منتور';
  end if;
end;
$$;

-- Placing a mentor directly (at approval, or a correction), with the reason
-- on the record and the mentor told their new range.
create or replace function public.admin_place_mentor(p_mentor uuid, p_level public.mentor_level, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.mentor_level;
  v_to   public.mentor_levels%rowtype;
begin
  if not public.is_admin() then
    raise exception 'تحديد المستوى للإدارة فقط';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'سبب تحديد المستوى مطلوب — يصل للمنتور';
  end if;

  select level into v_from from public.mentor_profiles where profile_id = p_mentor;
  if v_from = p_level then
    return;
  end if;
  perform public.set_mentor_level(p_mentor, p_level);
  select * into v_to from public.mentor_levels where level = p_level;

  perform public.notify(p_mentor, 'role_review',
    'مستواك الآن: ' || v_to.title,
    btrim(p_note) || ' — نطاق السعر المسموح لك الآن من ' || v_to.min_session_usd || ' إلى '
      || v_to.max_session_usd || ' دولاراً للساعة.',
    '/mentor-requests/level');

  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values ((select auth.uid()), 'mentor_level_set', 'mentor_profiles', p_mentor,
          jsonb_build_object('level', v_from),
          jsonb_build_object('level', p_level, 'note', btrim(p_note)));
end;
$$;

revoke execute on function public.admin_place_mentor(uuid, public.mentor_level, text) from public, anon;
grant execute on function public.admin_place_mentor(uuid, public.mentor_level, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Where a mentor stands, and whether they may ask now
-- ---------------------------------------------------------------------------
drop function public.my_level_progress();

create function public.my_level_progress()
returns table (
  current_level   public.mentor_level,
  current_title   text,
  next_level      public.mentor_level,
  next_title      text,
  sessions_count  integer,
  sessions_guide  integer,
  rating_avg      numeric,
  rating_guide    numeric,
  meets_guide     boolean,   -- the level's usual numbers: shown, not required
  eligible        boolean,   -- may send a request now
  opens_at        timestamptz, -- after a decline, when asking opens again
  pending_request uuid,
  last_status     public.upgrade_status,
  last_note       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select mp.profile_id, mp.level, mp.sessions_count, mp.rating_avg, ml.title, ml.sort_order
      from public.mentor_profiles mp
      join public.mentor_levels ml on ml.level = mp.level
     where mp.profile_id = (select auth.uid()) and mp.approved_at is not null
  ),
  nxt as (
    select ml.* from public.mentor_levels ml, me
     where ml.sort_order > me.sort_order
     order by ml.sort_order limit 1
  ),
  last_req as (
    select r.* from public.level_upgrade_requests r, me
     where r.mentor_id = me.profile_id and r.status <> 'withdrawn'
     order by r.created_at desc limit 1
  ),
  gate as (
    select (select id from last_req where status = 'pending') as pending,
           (select reviewed_at + make_interval(days => coalesce(public.setting_int('level_upgrade_cooldown_days'), 30))
              from last_req where status = 'declined') as opens
  )
  select me.level, me.title, nxt.level, nxt.title,
         me.sessions_count, nxt.min_sessions, me.rating_avg, nxt.min_rating,
         nxt.level is not null
           and me.sessions_count >= nxt.min_sessions
           and coalesce(me.rating_avg, 0) >= nxt.min_rating,
         nxt.level is not null and gate.pending is null
           and (gate.opens is null or gate.opens <= now()),
         case when gate.opens > now() then gate.opens end,
         gate.pending,
         (select status from last_req),
         (select review_note from last_req)
    from me cross join gate left join nxt on true;
$$;

revoke execute on function public.my_level_progress() from public, anon;
grant execute on function public.my_level_progress() to authenticated;

create or replace function public.submit_level_upgrade(p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := (select auth.uid());
  v_progress record;
  q          record;
  v_answer   text;
  v_id       uuid;
begin
  select * into v_progress from public.my_level_progress();
  if v_progress.current_level is null then
    raise exception 'الترقية للمنتورز المعتمدين';
  end if;
  if v_progress.next_level is null then
    raise exception 'أنت في أعلى مستوى';
  end if;
  if v_progress.pending_request is not null then
    raise exception 'لديك طلب ترقية قيد المراجعة';
  end if;
  if v_progress.opens_at is not null then
    raise exception 'يمكنك إعادة طلب الترقية بعد %', to_char(v_progress.opens_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD');
  end if;

  for q in select * from public.level_upgrade_questions where is_active order by sort_order loop
    v_answer := coalesce(btrim(p_answers ->> q.key), '');
    if char_length(v_answer) < q.min_chars then
      raise exception 'أجب عن: % (% حرفاً على الأقل)', q.question_ar, q.min_chars;
    end if;
    if q.needs_link and v_answer !~* 'https?://[^[:space:]]+\.[^[:space:]]+' then
      raise exception 'أضف رابطاً واحداً على الأقل يمكن فتحه في: %', q.question_ar;
    end if;
  end loop;

  insert into public.level_upgrade_requests
    (mentor_id, from_level, to_level, answers, sessions_at_request, rating_at_request)
  values (v_me, v_progress.current_level, v_progress.next_level, p_answers,
          v_progress.sessions_count, v_progress.rating_avg)
  returning id into v_id;

  perform public.notify_admins('طلب ترقية مستوى منتور',
    'طلب الانتقال من ' || v_progress.current_title || ' إلى ' || v_progress.next_title,
    '/admin/levels', 'level_upgrade', v_id, 'normal');

  return v_id;
end;
$$;

revoke execute on function public.submit_level_upgrade(jsonb) from public, anon;
grant execute on function public.submit_level_upgrade(jsonb) to authenticated;

-- The admin decides, and says why either way: the reason is part of the record
-- and reaches the mentor.
create or replace function public.review_level_upgrade(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_req public.level_upgrade_requests%rowtype;
  v_to  public.mentor_levels%rowtype;
begin
  if not public.is_admin() then
    raise exception 'مراجعة الترقيات للإدارة فقط';
  end if;

  select * into v_req from public.level_upgrade_requests where id = p_request for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'الطلب غير موجود أو لا ينتظر مراجعة';
  end if;

  if char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'سبب القرار مطلوب — يصل للمنتور';
  end if;

  select * into v_to from public.mentor_levels where level = v_req.to_level;

  if p_approve then
    perform public.set_mentor_level(v_req.mentor_id, v_req.to_level);
  end if;

  update public.level_upgrade_requests
     set status = case when p_approve then 'approved' else 'declined' end::public.upgrade_status,
         review_note = btrim(p_note), reviewed_by = v_me, reviewed_at = now()
   where id = p_request;

  perform public.notify(v_req.mentor_id, 'role_review',
    case when p_approve then 'تمت ترقيتك إلى ' || v_to.title else 'لم تُقبل الترقية هذه المرة' end,
    btrim(p_note) || case when p_approve
      then ' — نطاق السعر المسموح لك الآن من ' || v_to.min_session_usd || ' إلى ' || v_to.max_session_usd || ' دولاراً للساعة.'
      else '' end,
    '/mentor-requests/level');

  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values (v_me, case when p_approve then 'level_upgrade_approved' else 'level_upgrade_declined' end,
          'level_upgrade_requests', p_request,
          jsonb_build_object('level', v_req.from_level),
          jsonb_build_object('level', case when p_approve then v_req.to_level else v_req.from_level end,
                             'note', btrim(p_note)));
end;
$$;

revoke execute on function public.review_level_upgrade(uuid, boolean, text) from public, anon;
grant execute on function public.review_level_upgrade(uuid, boolean, text) to authenticated;

-- What waits for the admin: the answers, with the whole picture beside them.
drop function public.admin_level_upgrades();

create function public.admin_level_upgrades()
returns table (
  id uuid, mentor_id uuid, mentor_name text,
  from_level public.mentor_level, from_title text, to_level public.mentor_level, to_title text,
  answers jsonb, sessions_at_request integer, rating_at_request numeric,
  sessions_now integer, rating_now numeric, sessions_guide integer, rating_guide numeric,
  years_experience integer, domains text[], headline_ar text, experience_ar text,
  portfolio_url text, linkedin_url text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.mentor_id, p.full_name,
         r.from_level, fl.title, r.to_level, tl.title,
         r.answers, r.sessions_at_request, r.rating_at_request,
         mp.sessions_count, mp.rating_avg, tl.min_sessions, tl.min_rating,
         mp.years_experience, mp.domains, mp.headline_ar, mp.experience_ar,
         mp.portfolio_url, mp.linkedin_url, r.created_at
    from public.level_upgrade_requests r
    join public.profiles p on p.id = r.mentor_id
    join public.mentor_profiles mp on mp.profile_id = r.mentor_id
    left join public.mentor_levels fl on fl.level = r.from_level
    left join public.mentor_levels tl on tl.level = r.to_level
   where public.is_admin() and r.status = 'pending'
   order by r.created_at;
$$;

revoke execute on function public.admin_level_upgrades() from public, anon;
grant execute on function public.admin_level_upgrades() to authenticated;
