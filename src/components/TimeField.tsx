'use client';

import type { SelectHTMLAttributes } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * A time as a list of times every 15 minutes («6:00 م»), in place of the
 * browser's time field, which on many phones shows an empty box until it is
 * tapped. Posts the same HH:MM value. A saved time that is off the grid
 * (08:21) stays in the list, so nothing is lost by opening the form.
 */
export function TimeField({
  defaultValue, step = 15, placeholder, ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue'> & {
  defaultValue?: string; step?: number; placeholder?: string;
}) {
  const t = useT();
  const times: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  const current = defaultValue?.slice(0, 5) ?? '';
  if (current && !times.includes(current)) {
    times.push(current);
    times.sort();
  }

  const label = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const hour = h % 12 === 0 ? 12 : h % 12;
    const half = h < 12 ? t('ص', 'AM') : t('م', 'PM');
    return `${hour}:${String(m).padStart(2, '0')} ${half}`;
  };

  return (
    <select {...props} defaultValue={current} className={`time-select${props.className ? ` ${props.className}` : ''}`}>
      <option value="">{placeholder ?? t('— الوقت —', '— time —')}</option>
      {times.map((value) => <option key={value} value={value}>{label(value)}</option>)}
    </select>
  );
}
