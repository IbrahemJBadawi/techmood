'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useT } from '@/lib/i18n.client';
import { track } from '@/lib/analytics';

import { answerLessonQuiz, prepareLessonQuiz, type QuizResult, type QuizState } from './actions';

/**
 * The lesson's short quiz (0139): three questions written from the lesson, two
 * right answers pass. The answers stay on the server — this page only ever
 * holds the questions, and learns what was right after it answers.
 *
 * A lesson whose quiz is not written yet asks for it as soon as it opens, so
 * the learner rarely waits; until it exists, the lesson completes as before.
 */
export function LessonQuiz({
  lessonId, initial, canWrite, revalidate,
}: {
  lessonId: string;
  initial: QuizState;
  canWrite: boolean;
  revalidate: string;
}) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<QuizState>(initial);
  const [chosen, setChosen] = useState<(number | null)[]>(() => initial.questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A lesson without its quiz asks for it as soon as it opens: it starts "writing".
  const autoWrite = !initial.ready && !initial.generating && canWrite;
  const [writing, setWriting] = useState(autoWrite);
  const [pending, start] = useTransition();

  const ask = () =>
    prepareLessonQuiz(lessonId).then(({ state: next, error: failed }) => {
      setWriting(false);
      if (next) {
        setState(next);
        setChosen(next.questions.map(() => null));
      }
      if (!next?.ready) {
        setError(failed && /حدّ|limit/.test(failed)
          ? failed
          : t('لم يجهز الاختبار هذه المرة — حاول بعد قليل.', 'The quiz is not ready this time — try again in a moment.'));
      }
    });

  const write = () => {
    setWriting(true);
    setError(null);
    void ask();
  };

  useEffect(() => {
    if (autoWrite) void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.ready) {
    if (!canWrite) return null;
    return (
      <section className="panel section-block lq">
        <h3 className="lq-title">✦ {t('اختبر فهمك — 3 أسئلة', 'Check your understanding — 3 questions')}</h3>
        {writing || state.generating ? (
          <p className="muted lq-wait"><span className="ai-dots" aria-hidden><i /><i /><i /></span> {t('يكتب الذكاء الاصطناعي ثلاثة أسئلة من هذا الدرس…', 'Writing three questions from this lesson…')}</p>
        ) : (
          <>
            {error && <p className="notice">{error}</p>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={write}>{t('جهّز الاختبار', 'Prepare the quiz')}</button>
          </>
        )}
      </section>
    );
  }

  const submit = () => {
    if (chosen.some((c) => c === null)) {
      setError(t('أجب عن الأسئلة الثلاثة.', 'Answer all three questions.'));
      return;
    }
    setError(null);
    start(async () => {
      const out = await answerLessonQuiz(lessonId, chosen as number[], revalidate);
      if (out.error) {
        setError(out.error);
        return;
      }
      setResult(out.result ?? null);
      if (out.result) track(out.result.passed ? 'quiz_passed' : 'quiz_failed', { lesson: lessonId, correct: out.result.correct });
      if (out.result?.passed) {
        setState((s) => ({ ...s, passed: true }));
        router.refresh();
      }
    });
  };

  const retry = () => {
    setResult(null);
    setChosen(state.questions.map(() => null));
  };

  return (
    <section className={`panel section-block lq${state.passed && !result ? ' is-passed' : ''}`}>
      <div className="row-between">
        <h3 className="lq-title">✦ {t('اختبر فهمك — 3 أسئلة', 'Check your understanding — 3 questions')}</h3>
        {state.passed && <span className="status-pill status-ok">{t('✓ اجتزته', '✓ Passed')}</span>}
      </div>
      {!state.passed && !result && (
        <p className="muted lq-hint">{t('إجابتان صحيحتان من ثلاث تكفي لإكمال الدرس.', 'Two right answers of three complete the lesson.')}</p>
      )}

      {(!state.passed || result) && (
        <ol className="lq-list">
          {state.questions.map((question, qi) => {
            const r = result?.results[qi];
            return (
              <li key={qi} className="lq-q">
                <p className="lq-text">{question.q}</p>
                <div className="lq-options" role="radiogroup">
                  {question.options.map((option, oi) => {
                    const picked = chosen[qi] === oi;
                    const mark = r ? (oi === r.answer ? ' is-right' : picked ? ' is-wrong' : '') : '';
                    return (
                      <label key={oi} className={`lq-option${picked ? ' is-picked' : ''}${mark}`}>
                        <input
                          type="radio"
                          name={`q${qi}`}
                          checked={picked}
                          disabled={Boolean(result) || pending}
                          onChange={() => setChosen((c) => c.map((v, i) => (i === qi ? oi : v)))}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
                {r?.why && <p className={`lq-why${r.ok ? ' is-ok' : ''}`}>{r.ok ? '✓ ' : '✗ '}{r.why}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {error && <p className="notice notice-danger">{error}</p>}

      {result ? (
        <div className="lq-result">
          <strong>{t(`${result.correct} من ${result.total} صحيحة`, `${result.correct} of ${result.total} right`)}</strong>
          {result.passed
            ? <span>{t(' — اجتزت الاختبار، ويمكنك إكمال الدرس الآن.', ' — passed; you can complete the lesson now.')}</span>
            : <button type="button" className="btn btn-primary btn-sm" onClick={retry}>{t('حاول مرة أخرى', 'Try again')}</button>}
        </div>
      ) : (
        !state.passed && (
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={pending}>
            {pending ? t('يُصحَّح…', 'Checking…') : t('تحقّق من إجاباتي', 'Check my answers')}
          </button>
        )
      )}
    </section>
  );
}
