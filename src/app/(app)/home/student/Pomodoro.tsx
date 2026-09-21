'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n.client';

type Phase = 'idle' | 'running' | 'paused' | 'done';

const MINUTES = [15, 25, 45];

/**
 * A focus timer that is written down.
 *
 * The session is recorded in `focus_sessions` when it ends, with whatever the
 * person said they were working on. It earns no XP and does not feed the
 * streak: XP is for work that produced something a mentor can look at, and
 * sitting with a timer produces nothing. What it gives back is an honest record
 * of where the hours went.
 */
export function Pomodoro({
  suggestion,
  refTable = null,
  refId = null,
}: {
  suggestion: string | null;
  /** What the session is attached to, when it is started from that thing's own page. */
  refTable?: string | null;
  refId?: string | null;
}) {
  const t = useT();
  const [planned, setPlanned] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [phase, setPhase] = useState<Phase>('idle');
  const [subject, setSubject] = useState(suggestion ?? '');
  const [saved, setSaved] = useState(0);
  const startedAt = useRef<Date | null>(null);

  const record = useCallback(async (completed: boolean) => {
    const started = startedAt.current;
    startedAt.current = null;
    if (!started) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('focus_sessions').insert({
      profile_id: user.id,
      planned_minutes: planned,
      subject_ar: subject.trim() || null,
      ref_table: refTable,
      ref_id: refId,
      started_at: started.toISOString(),
      ended_at: new Date().toISOString(),
      was_completed: completed,
    });
    if (!error) setSaved((count) => count + 1);
  }, [planned, subject, refTable, refId]);

  useEffect(() => {
    if (phase !== 'running') return;

    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(id);
          setPhase('done');
          void record(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase, record]);

  function start() {
    startedAt.current = new Date();
    setPhase('running');
  }

  function reset() {
    if (phase === 'running' || phase === 'paused') void record(false);
    setPhase('idle');
    setRemaining(planned * 60);
  }

  function choose(minutes: number) {
    setPlanned(minutes);
    setRemaining(minutes * 60);
    setPhase('idle');
    startedAt.current = null;
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <article className="panel pomodoro">
      <p className="kicker">{t('جلسة تركيز', 'Focus session')}</p>

      <div className="pomodoro-clock eng" role="timer" aria-live="off">
        {minutes}:{seconds}
      </div>

      <div className="tags-row" style={{ justifyContent: 'center' }}>
        {MINUTES.map((value) => (
          <button
            key={value}
            type="button"
            className={`tag${planned === value ? ' is-on' : ''}`}
            onClick={() => choose(value)}
            disabled={phase === 'running'}
          >
            {t(`${value} دقيقة`, `${value} min`)}
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="focus-subject">{t('على ماذا تعمل؟', 'What are you working on?')}</label>
        <input
          id="focus-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t('اسم الدرس أو المهمة', 'The lesson or task')}
        />
      </div>

      <div className="pomodoro-controls">
        {phase !== 'running' ? (
          <button className="btn btn-primary btn-sm" type="button" onClick={start}>
            {phase === 'paused' ? t('متابعة', 'Resume') : t('ابدأ', 'Start')}
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPhase('paused')}>
            {t('إيقاف مؤقت', 'Pause')}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>{t('إعادة', 'Reset')}</button>
      </div>

      {phase === 'done' && <p className="notice notice-ok">{t('انتهت الجلسة — خذ استراحة.', 'Session over — take a break.')}</p>}
      {saved > 0 && (
        <p className="muted" style={{ fontSize: '0.76rem' }}>
          {t(`سُجِّلت ${saved} ${saved === 1 ? 'جلسة' : 'جلسات'} في سجلّك. جلسات التركيز لا تمنح XP — النقاط للعمل الذي يُراجَع.`,
             `${saved} ${saved === 1 ? 'session' : 'sessions'} recorded. Focus sessions earn no XP — points are for work that gets reviewed.`)}
        </p>
      )}
    </article>
  );
}
