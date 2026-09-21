'use client';

import { useT } from '@/lib/i18n.client';

/**
 * Stars are the quality signal and are always rendered from an evaluation
 * average — never derived from XP, which measures activity instead.
 *
 * A client component only so the spoken label follows the reader's language;
 * the glyphs themselves are the same in both.
 */
export function Stars({ value, max = 5 }: { value: number | null | undefined; max?: number }) {
  const t = useT();
  const filled = Math.max(0, Math.min(max, Math.round(value ?? 0)));

  return (
    <span aria-label={t(`${filled} من ${max} نجوم`, `${filled} out of ${max} stars`)} role="img">
      <span className="stars-filled" aria-hidden="true">{'★'.repeat(filled)}</span>
      <span className="stars-empty" aria-hidden="true">{'☆'.repeat(max - filled)}</span>
    </span>
  );
}
