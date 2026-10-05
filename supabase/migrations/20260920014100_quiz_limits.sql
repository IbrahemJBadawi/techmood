-- =============================================================================
-- 0141 — Lesson quizzes within Google's free limits, and never ambiguous
--
-- The first live run of 0139 met two facts:
--   * Gemini's free tier gives the main Flash model only 20 requests a day for
--     the whole platform — shared with the assistant. Quizzes are now written
--     by the Flash-Lite model (ai_quiz_model), which has its own, larger
--     allowance, leaving Flash to the assistant.
--   * A limit reached (429) is not the lesson's fault: it no longer counts as
--     a failed attempt, and it pauses the background job for two hours
--     (quiz_paused_until) instead of asking again every two minutes. A busy
--     moment (503) is simply tried again later.
--   * One question offered two options that were both right. The instruction
--     now insists on exactly one right answer and complete options.
-- Two runs of the job can no longer overlap (an advisory lock).
-- =============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('ai_quiz_model', 'gemini-flash-lite-latest', 'نموذج Gemini الذي يكتب اختبارات الدروس والفحص الأولي')
on conflict (key) do nothing;

-- The four requests the first run lost to the limit are tried again.
update public.lesson_quiz_jobs set attempts = 0 where last_error in ('429', '503');

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
      || 'ولا تسأل عن شيء غير موجود في مادة الدرس. '
      || 'شرط أساسي: خيار واحد فقط صحيح بلا أي لبس، والخيارات الثلاثة الأخرى خاطئة قطعاً لمن فهم الدرس — '
      || 'لا تضع خيارين يمكن أن يكون كلاهما صحيحاً، ولا خياراً ناقصاً أو مبتوراً؛ كل خيار جملة أو تعبير كامل واضح. '
      || 'اجعل الخيارات الخاطئة معقولة لمن لم يفهم، لا سخيفة. '
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
      'temperature', 0.3,
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
  -- One run at a time: a slow run and the next one must not ask twice.
  if not pg_try_advisory_xact_lock(hashtext('techmood-lesson-quizzes')) then
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
      values (r.lesson_id, v_quiz, coalesce(r.content::jsonb ->> 'modelVersion', 'gemini'))
      on conflict (lesson_id) do nothing;
      delete from public.lesson_quiz_jobs where lesson_id = r.lesson_id;
      v_done := v_done + 1;
    elsif r.status_code in (429, 503) then
      -- Google's limit or a busy moment: not the lesson's fault, so not an
      -- attempt. A limit pauses the asking for two hours.
      update public.lesson_quiz_jobs
         set request_id = null, last_error = r.status_code::text
       where lesson_id = r.lesson_id;
      if r.status_code = 429 then
        insert into public.platform_settings (key, value, description_ar)
        values ('quiz_paused_until', (now() + interval '2 hours')::text, 'إيقاف مؤقت لكتابة الاختبارات بعد بلوغ حدّ Gemini')
        on conflict (key) do update set value = excluded.value;
      end if;
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
  if coalesce((select nullif(value, '')::timestamptz from public.platform_settings where key = 'quiz_paused_until'), '-infinity') > now() then
    return v_done;
  end if;

  select count(*) into v_today from public.lesson_quizzes where created_at > now() - interval '1 day';
  v_today := v_today + (select count(*) from public.lesson_quiz_jobs where request_id is not null);
  if v_today >= v_cap then
    return v_done;
  end if;
  v_batch := least(v_batch, v_cap - v_today);

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'gemini_api_key' limit 1;
  v_model := coalesce((select nullif(value, '') from public.platform_settings where key = 'ai_quiz_model'), 'gemini-flash-lite-latest');

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
