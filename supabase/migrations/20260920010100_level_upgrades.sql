-- =============================================================================
-- 0101 — Moving up a level: earned by numbers, then asked for in writing
--
-- 0006 decided a mentor's level is earned — sessions held and a rating kept —
-- and only an admin may set it, never above what was earned. What was missing
-- was the way up from the mentor's side, and a person reading the case.
--
-- The founder's upgrade rule: a mentor who has met the next level's numbers
-- answers a short, precise questionnaire (what their sessions changed, how
-- they write reviews, where they have grown and the evidence, how much time
-- they can give, what learners asked them to improve). An admin reads it with
-- the numbers beside it and approves — the level, and so the price band, move
-- up — or declines with a reason. The questions live in a table, so the admin
-- can sharpen them without a release.
-- =============================================================================

create table public.level_upgrade_questions (
  key         text primary key,
  question_ar text not null,
  hint_ar     text,
  min_chars   integer not null default 40 check (min_chars between 0 and 2000),
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

alter table public.level_upgrade_questions enable row level security;

create policy level_upgrade_questions_read on public.level_upgrade_questions
  for select to authenticated using (is_active or public.is_admin());
create policy level_upgrade_questions_admin on public.level_upgrade_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.level_upgrade_questions to authenticated;

insert into public.level_upgrade_questions (key, question_ar, hint_ar, min_chars, sort_order) values
  ('impact',       'ما الذي تغيّر عند المتعلّمين بعد جلساتك منذ مستواك الحالي؟',
                   'اذكر جلستين أو ثلاثاً بعينها: ماذا كان عند المتعلّم قبلها، وماذا صار بعدها.', 80, 1),
  ('reviews',      'كيف تكتب تقييمك لعمل متعلّم؟ انقل مثالاً من تقييم كتبته وتفخر به.',
                   'التقييم الجيد يسمّي ما نجح، وما يلزم تحسينه، وخطوة تالية واضحة.', 80, 2),
  ('depth',        'في أي مجال صرت أعمق، وما الدليل؟',
                   'روابط مشاريع، شهادات، مقالات، أو أعمال راجعتها — دليل يمكن فتحه.', 60, 3),
  ('feedback',     'ما الملاحظات التي تلقيتها من المتعلّمين، وماذا غيّرت بسببها؟',
                   null, 40, 4),
  ('availability', 'كم ساعة أسبوعياً تلتزم بها في المستوى الجديد، وفي أي أوقات؟',
                   null, 10, 5);

create type public.upgrade_status as enum ('pending', 'approved', 'declined', 'withdrawn');

create table public.level_upgrade_requests (
  id          uuid primary key default extensions.gen_random_uuid(),
  mentor_id   uuid not null references public.mentor_profiles (profile_id) on delete cascade,
  from_level  public.mentor_level not null,
  to_level    public.mentor_level not null,
  answers     jsonb not null,
  sessions_at_request integer not null,
  rating_at_request   numeric(3,2),
  status      public.upgrade_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create unique index level_upgrade_one_pending on public.level_upgrade_requests (mentor_id)
  where status = 'pending';

alter table public.level_upgrade_requests enable row level security;

create policy level_upgrade_requests_read on public.level_upgrade_requests
  for select to authenticated
  using (mentor_id = (select auth.uid()) or public.is_admin());

grant select on public.level_upgrade_requests to authenticated;

-- Where a mentor stands against the next level.
create or replace function public.my_level_progress()
returns table (
  current_level    public.mentor_level,
  next_level       public.mentor_level,
  sessions_count   integer,
  sessions_needed  integer,
  rating_avg       numeric,
  rating_needed    numeric,
  eligible         boolean,
  pending_request  uuid,
  last_status      public.upgrade_status,
  last_note        text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select mp.profile_id, mp.level, mp.sessions_count, mp.rating_avg,
           (select sort_order from public.mentor_levels where level = mp.level) as sort_order
      from public.mentor_profiles mp
     where mp.profile_id = (select auth.uid()) and mp.approved_at is not null
  ),
  nxt as (
    select ml.* from public.mentor_levels ml, me
     where ml.sort_order > me.sort_order
     order by ml.sort_order limit 1
  ),
  last_req as (
    select r.* from public.level_upgrade_requests r, me
     where r.mentor_id = me.profile_id
     order by r.created_at desc limit 1
  )
  select me.level, nxt.level, me.sessions_count, nxt.min_sessions,
         me.rating_avg, nxt.min_rating,
         nxt.level is not null
           and me.sessions_count >= nxt.min_sessions
           and coalesce(me.rating_avg, 0) >= nxt.min_rating,
         (select id from last_req where status = 'pending'),
         (select status from last_req),
         (select review_note from last_req)
    from me left join nxt on true;
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
  if not v_progress.eligible then
    raise exception 'لم تبلغ متطلبات المستوى التالي بعد: % جلسة وتقييم % على الأقل',
      v_progress.sessions_needed, v_progress.rating_needed;
  end if;

  for q in select * from public.level_upgrade_questions where is_active order by sort_order loop
    if char_length(coalesce(btrim(p_answers ->> q.key), '')) < q.min_chars then
      raise exception 'أجب عن: % (% حرفاً على الأقل)', q.question_ar, q.min_chars;
    end if;
  end loop;

  insert into public.level_upgrade_requests
    (mentor_id, from_level, to_level, answers, sessions_at_request, rating_at_request)
  values (v_me, v_progress.current_level, v_progress.next_level, p_answers,
          v_progress.sessions_count, v_progress.rating_avg)
  returning id into v_id;

  perform public.notify_admins('طلب ترقية مستوى منتور',
    'طلب الانتقال من ' || v_progress.current_level || ' إلى ' || v_progress.next_level,
    '/admin/levels', 'level_upgrade', v_id, 'normal');

  return v_id;
end;
$$;

revoke execute on function public.submit_level_upgrade(jsonb) from public, anon;
grant execute on function public.submit_level_upgrade(jsonb) to authenticated;

create or replace function public.review_level_upgrade(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_req public.level_upgrade_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'مراجعة الترقيات للإدارة فقط';
  end if;

  select * into v_req from public.level_upgrade_requests where id = p_request for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'الطلب غير موجود أو لا ينتظر مراجعة';
  end if;

  if p_approve then
    -- 0006's guard still holds: never above what the numbers earned.
    perform public.set_mentor_level(v_req.mentor_id, v_req.to_level);
  elsif char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'سبب عدم القبول مطلوب — يصل للمنتور';
  end if;

  update public.level_upgrade_requests
     set status = case when p_approve then 'approved' else 'declined' end::public.upgrade_status,
         review_note = nullif(btrim(p_note), ''), reviewed_by = v_me, reviewed_at = now()
   where id = p_request;

  perform public.notify(v_req.mentor_id, 'role_review',
    case when p_approve then 'تمت ترقيتك إلى ' || v_req.to_level else 'لم تُقبل الترقية هذه المرة' end,
    coalesce(nullif(btrim(p_note), ''),
             case when p_approve then 'نطاق أسعارك تغيّر مع مستواك الجديد.' else null end),
    '/mentor-requests/level');

  insert into public.admin_audit_log (actor_id, action, entity_table, entity_id, before_data, after_data)
  values (v_me, case when p_approve then 'level_upgrade_approved' else 'level_upgrade_declined' end,
          'level_upgrade_requests', p_request,
          jsonb_build_object('level', v_req.from_level),
          jsonb_build_object('level', case when p_approve then v_req.to_level else v_req.from_level end,
                             'note', nullif(btrim(p_note), '')));
end;
$$;

revoke execute on function public.review_level_upgrade(uuid, boolean, text) from public, anon;
grant execute on function public.review_level_upgrade(uuid, boolean, text) to authenticated;

-- What waits for the admin, with the numbers beside the answers.
create or replace function public.admin_level_upgrades()
returns table (
  id uuid, mentor_id uuid, mentor_name text, from_level public.mentor_level, to_level public.mentor_level,
  answers jsonb, sessions_at_request integer, rating_at_request numeric,
  sessions_now integer, rating_now numeric, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.mentor_id, p.full_name, r.from_level, r.to_level, r.answers,
         r.sessions_at_request, r.rating_at_request, mp.sessions_count, mp.rating_avg, r.created_at
    from public.level_upgrade_requests r
    join public.profiles p on p.id = r.mentor_id
    join public.mentor_profiles mp on mp.profile_id = r.mentor_id
   where public.is_admin() and r.status = 'pending'
   order by r.created_at;
$$;

revoke execute on function public.admin_level_upgrades() from public, anon;
grant execute on function public.admin_level_upgrades() to authenticated;
