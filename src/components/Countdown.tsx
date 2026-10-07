'use client';

import { useEffect, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * The time left on an offer (design lab 4: «عرض لفترة محدودة مع عدّاد»).
 * Days, hours, minutes and seconds in small tiles; when it reaches zero it
 * says the offer ended — the database stops charging the discount at the same
 * moment, so the page never promises a price that is gone.
 */
export function Countdown({ endsAt, compact = false, label: heading, overLabel }: {
  endsAt: string; compact?: boolean;
  /** what the time counts down to (an offer by default) */
  label?: string;
  overLabel?: string;
}) {
  const t = useT();
  const end = Date.parse(endsAt);
  // the first render matches the server's (no clock), then the clock runs
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  if (now === null) return <span className={`countdown${compact ? ' is-compact' : ''}`} aria-hidden>⏳</span>;
  const left = Math.max(0, end - now);
  if (left === 0) return <span className="countdown is-over">{overLabel ?? t('انتهى العرض', 'Offer ended')}</span>;

  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const title = heading ?? t('ينتهي العرض بعد', 'Offer ends in');
  const label = `${title} ${days}d ${hours}h`;

  if (compact) {
    return (
      <span className="countdown is-compact" role="timer" aria-label={label}>
        ⏳ <span className="eng">{days > 0 ? `${days}d ` : ''}{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>
      </span>
    );
  }
  return (
    <span className="countdown" role="timer" aria-label={label}>
      <span className="countdown-label">⏳ {title}</span>
      <span className="countdown-tiles eng" aria-hidden>
        {days > 0 && <span><b>{days}</b>{t('ي', 'd')}</span>}
        <span><b>{pad(hours)}</b>{t('س', 'h')}</span>
        <span><b>{pad(minutes)}</b>{t('د', 'm')}</span>
        <span><b>{pad(seconds)}</b>{t('ث', 's')}</span>
      </span>
    </span>
  );
}
