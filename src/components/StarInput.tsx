'use client';

import { useId, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * Rating by tapping stars (design lab: «نجوم تُضغط»), in place of a dropdown
 * of ★ strings or a slider.
 *
 * Underneath it is five ordinary radio buttons sharing `name`, so the form
 * posts the same value a <select name> did, `required` works natively, and the
 * arrow keys move between stars. Nothing picked posts nothing, as «—» did.
 */
export function StarInput({
  name,
  defaultValue = 0,
  value: controlled,
  onChange,
  required,
  labelledBy,
  label,
  size = 'md',
}: {
  name: string;
  defaultValue?: number;
  value?: number;
  onChange?: (stars: number) => void;
  required?: boolean;
  /** id of the visible text that names this rating */
  labelledBy?: string;
  /** used when there is no visible label */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const t = useT();
  const groupId = useId();
  const [own, setOwn] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const value = controlled ?? own;
  const shown = hover || value;
  const words = [
    t('ضعيف', 'Poor'), t('مقبول', 'Fair'), t('جيد', 'Good'), t('جيد جداً', 'Very good'), t('ممتاز', 'Excellent'),
  ];

  return (
    <span
      className={`star-input star-input-${size}`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label ?? t('التقييم', 'Rating')}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={`star${n <= shown ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)}>
          <input
            type="radio"
            name={name}
            value={n}
            required={required}
            checked={value === n}
            onChange={() => { setOwn(n); onChange?.(n); }}
            aria-label={`${n} — ${words[n - 1]}`}
            id={`${groupId}-${n}`}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l2.83 5.74 6.34.92-4.59 4.47 1.08 6.31L12 17.27l-5.66 2.97 1.08-6.31-4.59-4.47 6.34-.92z" />
          </svg>
        </label>
      ))}
      <span className="star-word" aria-hidden="true">{shown ? words[shown - 1] : ''}</span>
    </span>
  );
}
