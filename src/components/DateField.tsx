'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * A date written the way people say it (design lab 3: «خانة بتاريخ مقروء»):
 * «الخميس 15 أكتوبر · بعد 8 أيام» with a calendar icon, instead of the
 * browser's numeric field. The real <input type=date> sits on top, invisible,
 * so a tap opens the device's own picker and the form posts the same
 * YYYY-MM-DD value as before. Works controlled (value + onChange) or not.
 */
export function DateField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useT();
  const [own, setOwn] = useState(String(props.defaultValue ?? ''));
  const value = props.value !== undefined ? String(props.value) : own;
  const input = useRef<HTMLInputElement>(null);

  // a form that resets itself after sending should empty the label too
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const back = () => setOwn(String(props.defaultValue ?? ''));
    form.addEventListener('reset', back);
    return () => form.removeEventListener('reset', back);
  }, [props.defaultValue]);

  let label = t('اختر تاريخاً', 'Pick a date');
  let hint = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    label = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
      weekday: 'long', day: 'numeric', month: 'long', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    }).format(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    hint = days === 0 ? t('اليوم', 'Today')
      : days === 1 ? t('غداً', 'Tomorrow')
      : days === -1 ? t('أمس', 'Yesterday')
      : days > 1 ? t(`بعد ${days} ${days <= 10 ? 'أيام' : 'يوماً'}`, `in ${days} days`)
      : t(`قبل ${-days} ${-days <= 10 ? 'أيام' : 'يوماً'}`, `${-days} days ago`);
  }

  return (
    <span className={`date-field${value ? '' : ' is-empty'}`}>
      <svg className="date-field-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
           strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3v4M16 3v4" />
      </svg>
      <span className="date-field-text" aria-hidden="true">{label}</span>
      {hint && <span className="date-field-hint" aria-hidden="true">{hint}</span>}
      <input
        {...props}
        ref={input}
        type="date"
        onChange={(event) => { setOwn(event.target.value); props.onChange?.(event); }}
        onClick={(event) => {
          // desktop browsers open the picker only from their small icon; open it from anywhere on the field
          try { event.currentTarget.showPicker?.(); } catch { /* already open, or not allowed here */ }
          props.onClick?.(event);
        }}
      />
    </span>
  );
}
