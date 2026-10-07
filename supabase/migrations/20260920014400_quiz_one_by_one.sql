-- =============================================================================
-- TechMood — 0144 The lesson quiz, one answer at a time
--
-- The founder chose «تلوين فوري صح/غلط» for the lesson quiz: each answer turns
-- green or red the moment it is tapped, instead of three answers checked
-- together. The answers still never reach the page before they are earned:
--
--   * an answer is final once given — the attempt in progress remembers it
--     and refuses a second try at the same question;
--   * only that question's right answer and «why» come back with it — the
--     same thing the whole-quiz check already shows, one question earlier;
--   * when the last question is answered the attempt is scored, recorded and
--     rewarded exactly as submit_lesson_quiz does, which stays for clients
--     that still send all three together.
--
-- A quiz that is written again after an attempt began starts that attempt over.
-- =============================================================================

create table public.lesson_quiz_drafts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  answers    smallint[] not null,
  started_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

alter table public.lesson_quiz_drafts enable row level security;
revoke all on public.lesson_quiz_drafts from anon, authenticated;
grant select on public.lesson_quiz_drafts to authenticated;
create policy lesson_quiz_drafts_own on public.lesson_quiz_drafts
  for select to authenticated using (profile_id = (select auth.uid()));

comment on table public.lesson_quiz_drafts is
  'A lesson quiz being answered one question at a time (0144): the answers given so far, each final.';

create or replace function public.answer_lesson_quiz_question(p_lesson uuid, p_index smallint, p_choice smallint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_quiz    jsonb;
  v_written timestamptz;
  v_total   integer;
  v_draft   public.lesson_quiz_drafts;
  v_answers smallint[];
  q         jsonb;
  v_correct integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_passed  boolean;
  i         integer;
  v_out     jsonb;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if not public.lesson_is_open(p_lesson) then
    raise exception 'الدرس غير متاح';
  end if;

  select questions, created_at into v_quiz, v_written from public.lesson_quizzes where lesson_id = p_lesson;
  if v_quiz is null then
    raise exception 'لا اختبار لهذا الدرس بعد';
  end if;
  v_total := jsonb_array_length(v_quiz);
  if p_index is null or p_index < 0 or p_index >= v_total or p_choice is null or p_choice not between 0 and 3 then
    raise exception 'سؤال أو خيار غير صحيح';
  end if;

  select * into v_draft from public.lesson_quiz_drafts
   where profile_id = v_me and lesson_id = p_lesson
   for update;

  -- no attempt yet, or one begun on a quiz that has since been written again
  if v_draft.profile_id is null or v_draft.started_at < v_written then
    delete from public.lesson_quiz_drafts where profile_id = v_me and lesson_id = p_lesson;
    v_answers := array_fill(null::smallint, array[v_total]);
  else
    v_answers := v_draft.answers;
  end if;

  if v_answers[p_index + 1] is not null then
    raise exception 'أجبت عن هذا السؤال — الإجابة نهائية';
  end if;
  v_answers[p_index + 1] := p_choice;

  q := v_quiz -> p_index::integer;
  v_out := jsonb_build_object(
    'index', p_index,
    'answer', (q ->> 'answer')::integer,
    'chosen', p_choice,
    'ok', (q ->> 'answer')::integer = p_choice,
    'why', q ->> 'why');

  if exists (select 1 from unnest(v_answers) a where a is null) then
    insert into public.lesson_quiz_drafts (profile_id, lesson_id, answers)
    values (v_me, p_lesson, v_answers)
    on conflict (profile_id, lesson_id) do update set answers = excluded.answers;
    return v_out || jsonb_build_object('finished', false);
  end if;

  -- the last answer: score, record and reward the attempt, as submit_lesson_quiz does
  delete from public.lesson_quiz_drafts where profile_id = v_me and lesson_id = p_lesson;
  i := 0;
  for q in select value from jsonb_array_elements(v_quiz) loop
    i := i + 1;
    if (q ->> 'answer')::integer = v_answers[i] then
      v_correct := v_correct + 1;
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'answer', (q ->> 'answer')::integer, 'chosen', v_answers[i],
      'ok', (q ->> 'answer')::integer = v_answers[i], 'why', q ->> 'why'));
  end loop;
  v_passed := v_correct >= 2;

  insert into public.lesson_quiz_attempts (profile_id, lesson_id, answers, correct, total, passed)
  values (v_me, p_lesson, v_answers, v_correct, v_total, v_passed);

  if v_passed then
    perform public.award_xp(v_me, 'lesson_quiz_passed', 'lessons', p_lesson);
  end if;

  return v_out || jsonb_build_object('finished', true, 'correct', v_correct, 'total', v_total,
                                     'passed', v_passed, 'results', v_results);
end;
$$;
revoke execute on function public.answer_lesson_quiz_question(uuid, smallint, smallint) from public, anon;
grant execute on function public.answer_lesson_quiz_question(uuid, smallint, smallint) to authenticated;

comment on function public.answer_lesson_quiz_question(uuid, smallint, smallint) is
  'One answer of the lesson quiz, final once given; returns that question''s answer, and the score after the last (0144).';

-- What this member has already answered in the attempt in progress, so a page
-- opened again shows those answers coloured instead of asking them again.
create or replace function public.lesson_quiz_progress(p_lesson uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me      uuid := (select auth.uid());
  v_quiz    jsonb;
  v_written timestamptz;
  v_draft   public.lesson_quiz_drafts;
  v_out     jsonb := '[]'::jsonb;
  q         jsonb;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  select questions, created_at into v_quiz, v_written from public.lesson_quizzes where lesson_id = p_lesson;
  select * into v_draft from public.lesson_quiz_drafts where profile_id = v_me and lesson_id = p_lesson;
  if v_quiz is null or v_draft.profile_id is null or v_draft.started_at < v_written then
    return v_out;
  end if;
  for i in 1 .. jsonb_array_length(v_quiz) loop
    if v_draft.answers[i] is not null then
      q := v_quiz -> (i - 1);
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'index', i - 1, 'answer', (q ->> 'answer')::integer, 'chosen', v_draft.answers[i],
        'ok', (q ->> 'answer')::integer = v_draft.answers[i], 'why', q ->> 'why'));
    end if;
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.lesson_quiz_progress(uuid) from public, anon;
grant execute on function public.lesson_quiz_progress(uuid) to authenticated;
