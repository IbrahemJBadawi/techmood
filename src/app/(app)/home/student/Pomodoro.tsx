'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

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
export function Pomodoro({ suggestion }: { suggestion: string | null }) {
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
      started_at: started.toISOString(),
      ended_at: new Date().toISOString(),
      was_completed: completed,
    });
    if (!error) setSaved((count) => count + 1);
  }, [planned, subject]);

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
      <p className="kicker">جلسة تركيز</p>

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
            {value} دقيقة
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="focus-subject">على ماذا تعمل؟</label>
        <input
          id="focus-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="اسم الدرس أو المهمة"
        />
      </div>

      <div className="pomodoro-controls">
        {phase !== 'running' ? (
          <button className="btn btn-primary btn-sm" type="button" onClick={start}>
            {phase === 'paused' ? 'متابعة' : 'ابدأ'}
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPhase('paused')}>
            إيقاف مؤقت
          </button>
        )}
        <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>إعادة</button>
      </div>

      {phase === 'done' && <p className="notice notice-ok">انتهت الجلسة — خذ استراحة.</p>}
      {saved > 0 && (
        <p className="muted" style={{ fontSize: '0.76rem' }}>
          سُجِّلت {saved} {saved === 1 ? 'جلسة' : 'جلسات'} في سجلّك. جلسات التركيز
          لا تمنح XP — النقاط للعمل الذي يُراجَع.
        </p>
      )}
    </article>
  );
}
