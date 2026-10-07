'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useT } from '@/lib/i18n.client';
import { track } from '@/lib/analytics';

import { celebrate } from '@/components/Confetti';

import { answerQuizQuestion, prepareLessonQuiz, quizProgress, type QuizAnswer, type QuizResult, type QuizState } from './actions';

const LETTERS = { ar: ['أ', 'ب', 'ج', 'د'], en: ['A', 'B', 'C', 'D'] } as const;

/**
 * The lesson's short quiz (0139): three questions written from the lesson, two
 * right answers pass. The answers stay on the server — this page only ever
 * holds the questions. Each tap is one final answer (0144) and comes back
 * green or red at once (design lab 3: «تلوين فوري صح/غلط»).
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
  const [answered, setAnswered] = useState<(QuizAnswer | null)[]>(() => initial.questions.map(() => null));
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
        setAnswered(next.questions.map(() => null));
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
    // an attempt left half-way: show the answers already given, coloured
    if (initial.ready && !initial.passed) {
      void quizProgress(lessonId).then((done) => {
        if (!done.length) return;
        setAnswered((a) => a.map((v, i) => done.find((d) => d.index === i) ?? v));
        setChosen((c) => c.map((v, i) => done.find((d) => d.index === i)?.chosen ?? v));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.ready) {
    if (!canWrite) return null;
    return (
      <section className="panel section-block lq">
        <h3 className="lq-title">✦ {t('اختبر فهمك — 3 أسئلة', 'Check your understanding — 3 questions')}</h3>
        {writing || state.generating ? (
          <div className="lq-wait" role="status"><p className="muted">{t('يكتب الذكاء الاصطناعي ثلاثة أسئلة من هذا الدرس…', 'Writing three questions from this lesson…')}</p><div className="sk-lines" aria-hidden="true"><div className="sk" /><div className="sk" /><div className="sk" /></div></div>
        ) : (
          <>
            {error && <p className="notice">{error}</p>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={write}>{t('جهّز الاختبار', 'Prepare the quiz')}</button>
          </>
        )}
      </section>
    );
  }

  // One answer at a time (0144): a tap is final, and turns green or red at once.
  const pick = (qi: number, oi: number) => {
    if (answered[qi] || pending || result) return;
    setError(null);
    setChosen((c) => c.map((v, i) => (i === qi ? oi : v)));
    start(async () => {
      const out = await answerQuizQuestion(lessonId, qi, oi, revalidate);
      if (out.error || !out.answer) {
        setChosen((c) => c.map((v, i) => (i === qi ? null : v)));
        setError(out.error ?? t('تعذّر إرسال الإجابة — حاول مرة أخرى.', 'The answer did not go through — try again.'));
        return;
      }
      setAnswered((a) => a.map((v, i) => (i === qi ? out.answer! : v)));
      if (out.result) {
        setResult(out.result);
        track(out.result.passed ? 'quiz_passed' : 'quiz_failed', { lesson: lessonId, correct: out.result.correct });
        if (out.result.passed) {
          setState((s) => ({ ...s, passed: true }));
          celebrate();
          router.refresh();
        }
      }
    });
  };

  const retry = () => {
    setResult(null);
    setChosen(state.questions.map(() => null));
    setAnswered(state.questions.map(() => null));
  };

  const right = answered.filter((a) => a?.ok).length;

  return (
    <section className={`panel section-block lq${state.passed && !result ? ' is-passed' : ''}`}>
      <div className="row-between">
        <h3 className="lq-title">✦ {t('اختبر فهمك — 3 أسئلة', 'Check your understanding — 3 questions')}</h3>
        {state.passed && <span className="status-pill status-ok">{t('✓ اجتزته', '✓ Passed')}</span>}
      </div>
      {!state.passed && !result && (
        <p className="muted lq-hint">
          {t('اضغط إجابتك وتعرف فوراً إن كانت صحيحة — الإجابة نهائية. إجابتان صحيحتان من ثلاث تكفي.',
             'Tap an answer and see at once whether it is right — it is final. Two right of three are enough.')}
        </p>
      )}

      {(!state.passed || result) && (
        <ol className="lq-list">
          {state.questions.map((question, qi) => {
            const r = answered[qi];
            return (
              <li key={qi} className={`lq-q${r ? (r.ok ? ' is-ok' : ' is-miss') : ''}`}>
                <p className="lq-text">{question.q}</p>
                <div className="lq-options" role="radiogroup" aria-label={question.q}>
                  {question.options.map((option, oi) => {
                    const picked = chosen[qi] === oi;
                    const mark = r ? (oi === r.answer ? ' is-right' : oi === r.chosen ? ' is-wrong' : ' is-dim') : '';
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        key={oi}
                        className={`lq-option${picked ? ' is-picked' : ''}${mark}`}
                        disabled={Boolean(r) || Boolean(result) || (pending && !picked)}
                        onClick={() => pick(qi, oi)}
                      >
                        <span className="lq-letter" aria-hidden="true">{LETTERS[t.locale][oi] ?? oi + 1}</span>
                        <span className="lq-option-text">{option}</span>
                        {r && oi === r.answer && <span className="lq-mark" aria-label={t('الإجابة الصحيحة', 'The right answer')}>✓</span>}
                        {r && !r.ok && oi === r.chosen && <span className="lq-mark" aria-label={t('إجابتك', 'Your answer')}>✗</span>}
                      </button>
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
        !state.passed && answered.some(Boolean) && (
          <p className="muted lq-tally" aria-live="polite">
            {t(`${right} صحيحة حتى الآن من ${answered.filter(Boolean).length}`, `${right} right so far of ${answered.filter(Boolean).length}`)}
          </p>
        )
      )}
    </section>
  );
}
