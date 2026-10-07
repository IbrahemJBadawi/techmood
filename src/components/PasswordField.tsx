'use client';

import { useState, type InputHTMLAttributes } from 'react';

import { useT } from '@/lib/i18n.client';

/** 0–4 from length and variety; only a guide for the person typing, never a rule the server applies. */
export function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/\d/.test(value) && /[A-Za-z؀-ۿ]/.test(value)) score += 1;
  if (/[^\w\s]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) score += 1;
  return value.length < 8 ? Math.min(score, 1) : score;
}

/**
 * A password with an eye inside the field to show or hide it (design lab 3:
 * «عين + مؤشر قوة»), and — with `meter` — four bars and a word on how strong
 * it is. The input itself is unchanged, so forms post what they did before.
 */
export function PasswordField({ meter = false, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { meter?: boolean }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const [own, setOwn] = useState('');
  const value = props.value !== undefined ? String(props.value) : own;
  const score = passwordStrength(value);
  const words = [t('ضعيفة جداً', 'Very weak'), t('ضعيفة', 'Weak'), t('مقبولة', 'Fair'), t('جيدة', 'Good'), t('قوية', 'Strong')];

  return (
    <>
      <span className="pw-field">
        <input
          {...props}
          type={show ? 'text' : 'password'}
          onChange={(event) => { setOwn(event.target.value); props.onChange?.(event); }}
        />
        <button type="button" className="pw-eye" onClick={() => setShow((on) => !on)}
                aria-label={show ? t('إخفاء كلمة المرور', 'Hide password') : t('إظهار كلمة المرور', 'Show password')}
                aria-pressed={show}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.1"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {show
              ? <path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.6M6.4 7.5C3.9 9.2 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
              : <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>}
          </svg>
        </button>
      </span>
      {meter && value.length > 0 && (
        <span className={`pw-meter is-${score}`} aria-live="polite">
          <span className="pw-bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="pw-word">{words[score]}</span>
        </span>
      )}
    </>
  );
}
