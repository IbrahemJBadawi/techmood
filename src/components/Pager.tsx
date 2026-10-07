'use client';

import { useT } from '@/lib/i18n.client';

/**
 * Numbered pages under a long list (design lab: «صفحات مرقّمة»): previous,
 * the page numbers with gaps (1 … 4 5 6 … 12), next. Hidden when everything
 * fits on one page.
 */
export function Pager({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  const t = useT();
  if (count <= 1) return null;

  const numbers: (number | 'gap')[] = [];
  for (let n = 1; n <= count; n += 1) {
    if (n === 1 || n === count || Math.abs(n - page) <= 1) numbers.push(n);
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap');
  }

  return (
    <nav className="pager" aria-label={t('الصفحات', 'Pages')}>
      <button type="button" className="pager-step" disabled={page <= 1} onClick={() => onChange(page - 1)}
              aria-label={t('الصفحة السابقة', 'Previous page')}>
        <span aria-hidden="true">‹</span>
      </button>
      {numbers.map((n, index) => n === 'gap'
        ? <span className="pager-gap" key={`gap-${index}`} aria-hidden="true">…</span>
        : (
          <button type="button" key={n} className={`pager-num eng${n === page ? ' is-on' : ''}`}
                  aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      <button type="button" className="pager-step" disabled={page >= count} onClick={() => onChange(page + 1)}
              aria-label={t('الصفحة التالية', 'Next page')}>
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}
