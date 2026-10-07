'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useT } from '@/lib/i18n.client';

/*
 * Filtering, sorting and picking from a list, the way the design lab chose:
 *  - FilterSheet: one «تصفية» button that shows how many filters are on, and
 *    opens the filters in a panel that rises from the bottom of the screen.
 *  - SheetSelect: a dropdown whose options open in that same bottom panel,
 *    big enough to tap, instead of the browser's own small list.
 *  - ChoiceChips: one-of-several as tappable chips, for inside the panel.
 * All of them live inside an ordinary GET <form>, so a filtered page is still
 * a link that can be shared and works before any script has loaded.
 */

function useSheet(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  const props = {
    ref,
    onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); onClose(); },
    onClick: (event: React.MouseEvent) => { if (event.target === ref.current) onClose(); },
  };
  return props;
}

const FilterGlyph = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1"
       strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);
const SortGlyph = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
  </svg>
);

export function FilterSheet({
  count, title, clearHref, children,
}: {
  /** how many filters are on now — shown on the button */
  count: number;
  title: string;
  /** where «مسح الكل» goes: the page with no filters */
  clearHref: string;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const sheet = useSheet(open, () => setOpen(false));

  return (
    <>
      <button type="button" className={`filter-btn${count > 0 ? ' is-on' : ''}`} onClick={() => setOpen(true)}
              aria-haspopup="dialog">
        <FilterGlyph />
        <span>{t('تصفية', 'Filter')}</span>
        {count > 0 && <span className="filter-count eng" aria-label={t(`${count} مفعّلة`, `${count} on`)}>{count}</span>}
      </button>
      <dialog className="bottom-sheet" aria-label={title} {...sheet}>
        <div className="bs-grip" aria-hidden="true" />
        <div className="bs-head">
          <strong>{title}</strong>
          <button type="button" className="bs-close" onClick={() => setOpen(false)} aria-label={t('إغلاق', 'Close')}>✕</button>
        </div>
        <div className="bs-body">{children}</div>
        <div className="bs-foot">
          <Link className="btn btn-ghost" href={clearHref}>{t('مسح الكل', 'Clear all')}</Link>
          <button className="btn btn-primary" type="submit">{t('عرض النتائج', 'Show results')}</button>
        </div>
      </dialog>
    </>
  );
}

type Option = { value: string; label: string };

export function SheetSelect({
  name, options, defaultValue = '', value: controlled, onChange, label, autoSubmit = false, variant = 'field',
}: {
  /** posted with the form; leave out when the value only drives state */
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: Option[];
  defaultValue?: string;
  /** the question the panel asks, and the button's accessible name */
  label: string;
  /** submit the surrounding form as soon as an option is picked (a sort chip) */
  autoSubmit?: boolean;
  variant?: 'field' | 'chip';
}) {
  const t = useT();
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [open, setOpen] = useState(false);
  const sheet = useSheet(open, () => setOpen(false));
  const input = useRef<HTMLInputElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      {name && <input ref={input} type="hidden" name={name} value={value} />}
      <button type="button" className={variant === 'chip' ? 'sort-chip' : 'sheet-select'} onClick={() => setOpen(true)}
              aria-haspopup="dialog" aria-label={`${label}: ${current?.label ?? ''}`}>
        {variant === 'chip' && <SortGlyph />}
        <span className="sheet-select-value">{current?.label}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <dialog className="bottom-sheet" aria-label={label} {...sheet}>
        <div className="bs-grip" aria-hidden="true" />
        <div className="bs-head">
          <strong>{label}</strong>
          <button type="button" className="bs-close" onClick={() => setOpen(false)} aria-label={t('إغلاق', 'Close')}>✕</button>
        </div>
        <div className="bs-options" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              className={`bs-option${option.value === value ? ' is-on' : ''}`}
              onClick={() => {
                setOwn(option.value);
                onChange?.(option.value);
                setOpen(false);
                if (autoSubmit && input.current) {
                  // the hidden input carries the new value once React has rendered it
                  const form = input.current.form;
                  input.current.value = option.value;
                  form?.requestSubmit();
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              )}
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}

export function ChoiceChips({
  name, legend, options, defaultValue = '',
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <fieldset className="choice-chips">
      <legend>{legend}</legend>
      <div className="choice-chips-row">
        {options.map((option) => (
          <label className="choice-chip" key={option.value}>
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
