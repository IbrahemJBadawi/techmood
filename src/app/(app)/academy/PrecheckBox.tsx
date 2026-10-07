'use client';

import { useEffect, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { track } from '@/lib/analytics';

import { runPrecheck, type Precheck } from './actions';

const MARK: Record<'found' | 'missing' | 'unclear', string> = { found: '✓', missing: '✗', unclear: '?' };

/**
 * The first look at submitted work (0140): a checklist of what the brief asks
 * for, found / missing / unclear, written seconds after submitting. It is
 * advice — the mentor's review decides, and this changes nothing in it.
 *
 * A newly submitted version that has not been looked at asks for its look as
 * soon as the page shows it.
 */
export function PrecheckBox({
  submissionId, version, initial, canRun, revalidate,
}: {
  submissionId: string;
  version: number;
  initial: Precheck | null;
  canRun: boolean;
  revalidate: string;
}) {
  const t = useT();
  const [precheck, setPrecheck] = useState<Precheck | null>(initial);
  // A version not looked at yet is looked at as soon as it shows: it starts "running".
  const autoRun = canRun && !initial;
  const [running, setRunning] = useState(autoRun);
  const [error, setError] = useState<string | null>(null);

  const ask = () =>
    runPrecheck(submissionId, revalidate).then(({ precheck: next, error: failed }) => {
      setRunning(false);
      if (next) setPrecheck(next);
      if (next?.status === 'done') track('precheck_shown', { missing: next.result?.items.filter((i) => i.status === 'missing').length ?? 0 });
      if (!next || next.status !== 'done') {
        setError(failed && /حدّ|limit|بالفعل/.test(failed)
          ? failed
          : t('تعذّر الفحص الأولي هذه المرة — المنتور سيراجع عملك كالمعتاد.', 'The first look did not work this time — your mentor will review your work as usual.'));
      }
    });

  const run = () => {
    setRunning(true);
    setError(null);
    void ask();
  };

  useEffect(() => {
    if (autoRun) void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (!precheck && !running && !canRun) return null;

  return (
    <div className="pc-box">
      <div className="row-between">
        <strong className="pc-title">✦ {t('فحص أولي فوري', 'Instant first look')}</strong>
        <span className="muted pc-note">{t('نصيحة فقط — القرار للمنتور', 'Advice only — the mentor decides')}</span>
      </div>

      {running || precheck?.status === 'pending' ? (
        <div className="pc-wait" role="status"><p className="muted">{t('يقرأ الذكاء الاصطناعي ما سلّمته ويقارنه بالتكليف…', 'Reading what you submitted against the brief…')}</p><div className="sk-lines" aria-hidden="true"><div className="sk" /><div className="sk" /><div className="sk" /></div></div>
      ) : precheck?.status === 'done' && precheck.result ? (
        <>
          <p className="pc-summary">{precheck.result.summary}</p>
          <ul className="pc-list">
            {precheck.result.items.map((item, i) => (
              <li key={i} className={`pc-item is-${item.status}`}>
                <span className="pc-mark" aria-hidden>{MARK[item.status]}</span>
                <span>
                  <strong>{item.item}</strong>
                  {item.note && <span className="muted"> — {item.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          {precheck.result.next && <p className="pc-next">👉 {precheck.result.next}</p>}
        </>
      ) : (
        <>
          {error && <p className="muted pc-note">{error}</p>}
          {canRun && <button type="button" className="btn btn-ghost btn-sm" onClick={run}>{t('افحص تسليمي الآن', 'Look at my submission now')}</button>}
        </>
      )}
      {error && precheck?.status === 'done' && <p className="muted pc-note">{error}</p>}
    </div>
  );
}
