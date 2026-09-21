'use client';

import { useT } from '@/lib/i18n.client';

/**
 * The bar the rest of TechMood uses, with the number said in text beside it:
 * a screen reader and a reader who cannot see the fill get the same answer.
 */
export function ProgressIndicator({
  percent,
  label,
  detail,
}: {
  percent: number;
  label?: string;
  detail?: string;
}) {
  const t = useT();
  const text = label ?? t('التقدّم', 'Progress');

  return (
    <div className="academy-progress">
      <div className="row-between">
        <span className="muted">{text}</span>
        <span className="eng">{percent}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={text}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {detail && <p className="muted academy-progress-detail">{detail}</p>}
    </div>
  );
}
