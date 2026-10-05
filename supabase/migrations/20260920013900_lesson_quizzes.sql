-- =============================================================================
-- 0139 — A short quiz after each lesson
--
-- Three multiple-choice questions per lesson, written once by the model from
-- the lesson's own material (its title, summary, what you will learn, its
-- case) and kept: every learner of a lesson answers the same three.
--
--   * The answers never leave the database. lesson_quiz() returns the
--     questions and their options only; submit_lesson_quiz() grades on the
--     server, records the attempt, and only then shows what was right and why.
--   * Two of three passes. Passing once earns XP once (lesson_quiz_passed).
--   * Once a lesson has its quiz, the lesson is completed only after passing
--     it — "I watched it" becomes "I understood it". A lesson whose quiz does
--     not exist yet (the model was unreachable) is never held back by it.
--
-- Where the questions come from, two ways, one validator:
--   * in the background: quiz_generation_tick(), every two minutes, asks
--     Gemini (key from Vault, through pg_net) for a few lessons that have no
--     quiz yet, and collects the answers it gets back — within a daily cap,
--     so the assistant's own quota is never used up by it;
--   * on demand: a learner who opens a lesson without a quiz claims it
--     (claim_quiz_generation) and the ai-gemini Edge Function writes it at
--     once, with the service role, through save_lesson_quiz().
-- Whatever the model returns passes quiz_valid() or is thrown away.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.lesson_quizzes (
  lesson_id  uuid primary key references public.lessons (id) on delete cascade,
  questions  jsonb not null,
  model      text,
  created_at timestamptz not null default now()
);

alter table public.lesson_quizzes enable row level security;
revoke all on public.lesson_quizzes from anon, authenticated;
grant select, delete on public.lesson_quizzes to authenticated;
-- The answers are inside: only an admin reads the table, or deletes a quiz so
-- it is written again.
create policy lesson_quizzes_admin_read on public.lesson_quizzes
  for select to authenticated using (public.is_admin());
create policy lesson_quizzes_admin_delete on public.lesson_quizzes
  for delete to authenticated using (public.is_admin());

create table public.lesson_quiz_attempts (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  answers    smallint[] not null,
  correct    smallint not null,
  total      smallint not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);

create index lesson_quiz_attempts_member_idx on public.lesson_quiz_attempts (profile_id, lesson_id, created_at desc);

alter table public.lesson_quiz_attempts enable row level security;
revoke all on public.lesson_quiz_attempts from anon, authenticated;
grant select on public.lesson_quiz_attempts to authenticated;
create policy lesson_quiz_attempts_own on public.lesson_quiz_attempts
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());

-- A quiz being written: by the background job (request_id) or for a learner
-- who is waiting (claimed_by).
create table public.lesson_quiz_jobs (
  lesson_id  uuid primary key references public.lessons (id) on delete cascade,
  request_id bigint,
  claimed_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  attempts   smallint not null default 1,
  last_error text
);

alter table public.lesson_quiz_jobs enable row level security;
revoke all on public.lesson_quiz_jobs from anon, authenticated;

-- Who asked for a quiz to be written on demand, for the daily limit.
create table public.lesson_quiz_generations (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index lesson_quiz_generations_member_idx on public.lesson_quiz_generations (profile_id, requested_at desc);

alter table public.lesson_quiz_generations enable row level security;
revoke all on public.lesson_quiz_generations from anon, authenticated;

insert into public.xp_rules (source, base_xp, per_star_xp, description_ar)
values ('lesson_quiz_passed', 3, 0, 'اجتياز اختبار الدرس القصير')
on conflict (source) do nothing;

insert into public.platform_settings (key, value, description_ar) values
  ('quiz_daily_generations', '100', 'كم اختبار درس يكتبه الذكاء الاصطناعي في الخلفية يومياً'),
  ('quiz_batch_size', '2', 'كم اختبار درس يُطلب في كل دورة من دورات الخلفية'),
  ('quiz_member_daily_generations', '15', 'كم اختبار درس جديد يمكن لعضو أن يطلب كتابته يومياً')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- What the model must return, and what we keep of it
-- ---------------------------------------------------------------------------
create or replace function public.quiz_valid(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  q      jsonb;
  v_out  jsonb := '[]'::jsonb;
  v_ans  integer;
begin
  if p is null then
    return null;
  end if;
  if jsonb_typeof(p) = 'object' then
    p := p -> 'questions';
  end if;
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) <> 3 then
    return null;
  end if;

  for q in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(q -> 'q') is distinct from 'string'
       or length(btrim(q ->> 'q')) < 5 or length(q ->> 'q') > 400 then
      return null;
    end if;
    if jsonb_typeof(q -> 'options') is distinct from 'array' or jsonb_array_length(q -> 'options') <> 4 then
      return null;
    end if;
    if exists (select 1 from jsonb_array_elements(q -> 'options') o
                where jsonb_typeof(o) <> 'string' or length(btrim(o #>> '{}')) = 0 or length(o #>> '{}') > 200) then
      return null;
    end if;
    if (select count(distinct btrim(o #>> '{}')) from jsonb_array_elements(q -> 'options') o) <> 4 then
      return null;
    end if;
    if jsonb_typeof(q -> 'answer') is distinct from 'number' then
      return null;
    end if;
    v_ans := (q ->> 'answer')::numeric::integer;
    if v_ans not between 0 and 3 then
      return null;
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'q', btrim(q ->> 'q'),
      'options', (select jsonb_agg(btrim(o #>> '{}')) from jsonb_array_elements(q -> 'options') o),
      'answer', v_ans,
      'why', left(btrim(coalesce(q ->> 'why', '')), 400)));
  end loop;

  return v_out;
end;
$$;

revoke execute on function public.quiz_valid(jsonb) from public, anon, authenticated;

-- Gemini's reply → the quiz in it, or null.
create or replace function public.quiz_from_gemini(p_response jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text;
begin
  select part ->> 'text' into v_text
    from jsonb_array_elements(p_response -> 'candidates' -> 0 -> 'content' -> 'parts') part
   where part ? 'text' and not coalesce((part ->> 'thought')::boolean, false)
   limit 1;
  return public.quiz_valid(v_text::jsonb);
exception when others then
  return null;
end;
$$;

revoke execute on function public.quiz_from_gemini(jsonb) from public, anon, authenticated;

-- The request for one lesson: its own material, nothing else.
create or replace function public.lesson_quiz_request(p_lesson uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'systemInstruction', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text',
      'أنت تكتب اختباراً قصيراً لدرس في أكاديمية TechMood. اكتب 3 أسئلة اختيار من متعدد بالعربية، '
      || 'والمصطلحات التقنية بالإنجليزية كما هي. لكل سؤال 4 خيارات مختلفة وإجابة صحيحة واحدة. '
      || 'الأسئلة تقيس فهم أفكار الدرس وتطبيقها في موقف عملي، لا حفظ أرقام أو أسماء أشخاص أو أوقات، '
      || 'ولا تسأل عن شيء غير موجود في مادة الدرس. اجعل الخيارات الخاطئة معقولة وقريبة. '
      || 'answer رقم الخيار الصحيح من 0 إلى 3، ونوّع موضعه بين الأسئلة. '
      || 'why جملة واحدة قصيرة تشرح لماذا هذه الإجابة صحيحة.'))),
    'contents', jsonb_build_array(jsonb_build_object('role', 'user', 'parts', jsonb_build_array(jsonb_build_object('text',
      'الدورة: ' || c.title_ar
      || E'\nالدرس: ' || l.title_ar || coalesce(' (' || l.title_en || ')', '')
      || coalesce(E'\nالملخص: ' || l.summary_ar, '')
      || case when cardinality(l.outcomes_ar) > 0
              then E'\nما يتعلمه الطالب:\n- ' || array_to_string(l.outcomes_ar, E'\n- ') else '' end
      || coalesce(E'\nدراسة حالة: ' || l.case_study_ar, '')
      || coalesce(E'\nسؤال الحالة: ' || l.case_question_ar, ''))))),
    'generationConfig', jsonb_build_object(
      'temperature', 0.4,
      'maxOutputTokens', 8192,
      'responseMimeType', 'application/json',
      'responseSchema', jsonb_build_object(
        'type', 'OBJECT',
        'properties', jsonb_build_object('questions', jsonb_build_object(
          'type', 'ARRAY',
          'items', jsonb_build_object(
            'type', 'OBJECT',
            'properties', jsonb_build_object(
              'q', jsonb_build_object('type', 'STRING'),
              'options', jsonb_build_object('type', 'ARRAY', 'items', jsonb_build_object('type', 'STRING')),
              'answer', jsonb_build_object('type', 'INTEGER'),
              'why', jsonb_build_object('type', 'STRING')),
            'required', jsonb_build_array('q', 'options', 'answer', 'why')))),
        'required', jsonb_build_array('questions'))))
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
   where l.id = p_lesson;
$$;

revoke execute on function public.lesson_quiz_request(uuid) from public, anon, authenticated;
grant execute on function public.lesson_quiz_request(uuid) to service_role;

-- The Edge Function's way in: keeps only a valid quiz.
create or replace function public.save_lesson_quiz(p_lesson uuid, p_questions jsonb, p_model text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz jsonb := public.quiz_valid(p_questions);
begin
  if v_quiz is null then
    update public.lesson_quiz_jobs
       set last_error = 'invalid quiz', attempts = attempts + 1
     where lesson_id = p_lesson;
    return false;
  end if;
  insert into public.lesson_quizzes (lesson_id, questions, model)
  values (p_lesson, v_quiz, p_model)
  on conflict (lesson_id) do nothing;
  delete from public.lesson_quiz_jobs where lesson_id = p_lesson;
  return true;
end;
$$;

revoke execute on function public.save_lesson_quiz(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_lesson_quiz(uuid, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- For the learner
-- ---------------------------------------------------------------------------
create or replace function public.lesson_is_open(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
     where l.id = p_lesson and l.status = 'published' and c.status = 'published');
$$;

revoke execute on function public.lesson_is_open(uuid) from public, anon;
grant execute on function public.lesson_is_open(uuid) to authenticated;

-- The questions without their answers, and where the member stands.
create or replace function public.lesson_quiz(p_lesson uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_quiz public.lesson_quizzes%rowtype;
  v_last public.lesson_quiz_attempts%rowtype;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if not public.lesson_is_open(p_lesson) and not public.is_admin() then
    raise exception 'الدرس غير متاح';
  end if;

  select * into v_quiz from public.lesson_quizzes where lesson_id = p_lesson;
  select * into v_last from public.lesson_quiz_attempts
   where profile_id = v_me and lesson_id = p_lesson order by created_at desc limit 1;

  return jsonb_build_object(
    'ready', v_quiz.lesson_id is not null,
    'generating', exists (select 1 from public.lesson_quiz_jobs j
                           where j.lesson_id = p_lesson and j.started_at > now() - interval '2 minutes'),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('q', q ->> 'q', 'options', q -> 'options') order by n)
                             from jsonb_array_elements(v_quiz.questions) with ordinality as x(q, n)), '[]'::jsonb),
    'passed', exists (select 1 from public.lesson_quiz_attempts a
                       where a.profile_id = v_me and a.lesson_id = p_lesson and a.passed),
    'last', case when v_last.id is null then null
                 else jsonb_build_object('correct', v_last.correct, 'total', v_last.total, 'at', v_last.created_at) end);
end;
$$;

revoke execute on function public.lesson_quiz(uuid) from public, anon;
grant execute on function public.lesson_quiz(uuid) to authenticated;

-- Grades on the server. The answers and the reasons are shown only now.
create or replace function public.submit_lesson_quiz(p_lesson uuid, p_answers smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_quiz    jsonb;
  v_correct integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_passed  boolean;
  q         jsonb;
  i         integer := 0;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if not public.lesson_is_open(p_lesson) then
    raise exception 'الدرس غير متاح';
  end if;

  select questions into v_quiz from public.lesson_quizzes where lesson_id = p_lesson;
  if v_quiz is null then
    raise exception 'لا اختبار لهذا الدرس بعد';
  end if;
  if coalesce(array_length(p_answers, 1), 0) <> jsonb_array_length(v_quiz)
     or exists (select 1 from unnest(p_answers) a where a is null or a not between 0 and 3) then
    raise exception 'أجب عن كل الأسئلة';
  end if;
  if exists (select 1 from public.lesson_quiz_attempts
              where profile_id = v_me and lesson_id = p_lesson and created_at > now() - interval '5 seconds') then
    raise exception 'لحظة — حاول بعد ثوانٍ';
  end if;

  for q in select value from jsonb_array_elements(v_quiz) loop
    i := i + 1;
    if (q ->> 'answer')::integer = p_answers[i] then
      v_correct := v_correct + 1;
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'answer', (q ->> 'answer')::integer,
      'chosen', p_answers[i],
      'ok', (q ->> 'answer')::integer = p_answers[i],
      'why', q ->> 'why'));
  end loop;

  v_passed := v_correct >= 2;

  insert into public.lesson_quiz_attempts (profile_id, lesson_id, answers, correct, total, passed)
  values (v_me, p_lesson, p_answers, v_correct, jsonb_array_length(v_quiz), v_passed);

  if v_passed then
    perform public.award_xp(v_me, 'lesson_quiz_passed', 'lessons', p_lesson);
  end if;

  return jsonb_build_object('correct', v_correct, 'total', jsonb_array_length(v_quiz),
                            'passed', v_passed, 'results', v_results);
end;
$$;

revoke execute on function public.submit_lesson_quiz(uuid, smallint[]) from public, anon;
grant execute on function public.submit_lesson_quiz(uuid, smallint[]) to authenticated;

-- A learner opened a lesson that has no quiz yet: may the Edge Function write
-- it now, on their behalf?
create or replace function public.claim_quiz_generation(p_lesson uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_limit integer := coalesce(public.setting_int('quiz_member_daily_generations'), 15);
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if not public.lesson_is_open(p_lesson) then
    raise exception 'الدرس غير متاح';
  end if;
  if exists (select 1 from public.lesson_quizzes where lesson_id = p_lesson) then
    raise exception 'الاختبار جاهز بالفعل';
  end if;
  if exists (select 1 from public.lesson_quiz_jobs
              where lesson_id = p_lesson and started_at > now() - interval '2 minutes') then
    raise exception 'الاختبار يُجهَّز الآن';
  end if;
  if not public.is_admin()
     and (select count(*) from public.lesson_quiz_generations
           where profile_id = v_me and requested_at > now() - interval '1 day') >= v_limit then
    raise exception 'بلغت حدّ تجهيز الاختبارات لليوم';
  end if;

  insert into public.lesson_quiz_jobs (lesson_id, claimed_by, request_id, started_at)
  values (p_lesson, v_me, null, now())
  on conflict (lesson_id) do update
    set claimed_by = excluded.claimed_by, request_id = null, started_at = now(),
        attempts = public.lesson_quiz_jobs.attempts + 1;
  insert into public.lesson_quiz_generations (profile_id, lesson_id) values (v_me, p_lesson);
  return true;
end;
$$;

revoke execute on function public.claim_quiz_generation(uuid) from public, anon;
grant execute on function public.claim_quiz_generation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Completing a lesson that has a quiz needs the quiz passed
-- ---------------------------------------------------------------------------
create or replace function public.require_lesson_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and (select auth.uid()) is not null
     and not public.is_admin()
     and exists (select 1 from public.lesson_quizzes where lesson_id = new.lesson_id)
     and not exists (select 1 from public.lesson_quiz_attempts a
                      where a.profile_id = new.profile_id and a.lesson_id = new.lesson_id and a.passed) then
    raise exception 'اجتز اختبار الدرس القصير أولاً — إجابتان صحيحتان من ثلاث';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_lesson_quiz() from public, anon, authenticated;

create trigger lesson_progress_quiz_gate
  before insert or update of status on public.lesson_progress
  for each row execute function public.require_lesson_quiz();

-- ---------------------------------------------------------------------------
-- In the background
-- ---------------------------------------------------------------------------
create or replace function public.quiz_generation_tick()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  v_quiz   jsonb;
  v_key    text;
  v_model  text;
  v_cap    integer := coalesce(public.setting_int('quiz_daily_generations'), 100);
  v_batch  integer := coalesce(public.setting_int('quiz_batch_size'), 2);
  v_today  integer;
  v_req    bigint;
  v_done   integer := 0;
begin
  if to_regnamespace('net') is null then
    return 0;
  end if;

  -- 1. Collect what came back.
  for r in
    select j.lesson_id, resp.status_code, resp.content
      from public.lesson_quiz_jobs j
      join net._http_response resp on resp.id = j.request_id
     where j.request_id is not null
  loop
    v_quiz := case when r.status_code = 200 then public.quiz_from_gemini(r.content::jsonb) end;
    if v_quiz is not null then
      insert into public.lesson_quizzes (lesson_id, questions, model)
      values (r.lesson_id, v_quiz, (select coalesce(nullif(value, ''), 'gemini') from public.platform_settings where key = 'ai_gemini_model'))
      on conflict (lesson_id) do nothing;
      delete from public.lesson_quiz_jobs where lesson_id = r.lesson_id;
      v_done := v_done + 1;
    else
      update public.lesson_quiz_jobs
         set request_id = null, attempts = attempts + 1,
             last_error = coalesce(r.status_code::text, 'no answer')
       where lesson_id = r.lesson_id;
    end if;
  end loop;

  -- A request whose answer never came: forget it, try again later.
  update public.lesson_quiz_jobs j
     set request_id = null, attempts = attempts + 1, last_error = 'timed out'
   where j.request_id is not null and j.started_at < now() - interval '10 minutes'
     and not exists (select 1 from net._http_response resp where resp.id = j.request_id);

  -- 2. Ask for a few more, within the day's cap.
  if not public.ai_gemini_ready() then
    return v_done;
  end if;

  select count(*) into v_today from public.lesson_quizzes where created_at > now() - interval '1 day';
  v_today := v_today + (select count(*) from public.lesson_quiz_jobs where request_id is not null);
  if v_today >= v_cap then
    return v_done;
  end if;
  v_batch := least(v_batch, v_cap - v_today);

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'gemini_api_key' limit 1;
  v_model := coalesce((select nullif(value, '') from public.platform_settings where key = 'ai_gemini_model'), 'gemini-flash-latest');

  for r in
    select l.id
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      left join public.lesson_quiz_jobs j on j.lesson_id = l.id
     where l.status = 'published' and c.status = 'published'
       and not exists (select 1 from public.lesson_quizzes q where q.lesson_id = l.id)
       and (j.lesson_id is null
            or (j.request_id is null and j.attempts < 4 and j.started_at < now() - interval '30 minutes'))
     order by c.created_at, m.sort_order, l.sort_order
     limit v_batch
  loop
    v_req := net.http_post(
      url := 'https://generativelanguage.googleapis.com/v1beta/models/' || v_model || ':generateContent',
      body := public.lesson_quiz_request(r.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-goog-api-key', v_key),
      timeout_milliseconds := 60000);
    insert into public.lesson_quiz_jobs (lesson_id, request_id, claimed_by, started_at)
    values (r.id, v_req, null, now())
    on conflict (lesson_id) do update
      set request_id = excluded.request_id, claimed_by = null, started_at = now();
  end loop;

  return v_done;
end;
$$;

revoke execute on function public.quiz_generation_tick() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-lesson-quizzes', '*/2 * * * *', $$select public.quiz_generation_tick()$$);
  end if;
end
$migration$;
