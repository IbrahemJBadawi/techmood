'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { signup, type AuthState } from '../actions';

/**
 * Name, email, and the password twice. The second copy is checked here as it
 * is typed, so a slip shows before the button is pressed, and again on the
 * server, which is the check that counts.
 */
export function SignupForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(signup, undefined as AuthState);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;
  const matches = confirm.length > 0 && confirm === password && !tooShort;

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="full_name">{t('الاسم الكامل', 'Full name')}</label>
        <input id="full_name" name="full_name" type="text" required autoComplete="name" />
      </div>

      <div className="field">
        <label htmlFor="email">{t('البريد الإلكتروني', 'Email')}</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr"
               placeholder="you@example.com" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="password">{t('كلمة المرور', 'Password')}</label>
          <input id="password" name="password" type={show ? 'text' : 'password'} required minLength={8}
                 autoComplete="new-password" dir="ltr" value={password}
                 onChange={(event) => setPassword(event.target.value)}
                 aria-describedby="password-hint" />
        </div>
        <div className="field">
          <label htmlFor="password_confirm">{t('أعد كتابة كلمة المرور', 'Type the password again')}</label>
          <input id="password_confirm" name="password_confirm" type={show ? 'text' : 'password'} required minLength={8}
                 autoComplete="new-password" dir="ltr" value={confirm}
                 onChange={(event) => setConfirm(event.target.value)}
                 aria-invalid={mismatch} aria-describedby="password-hint" />
        </div>
      </div>

      <div className="password-meta">
        <p id="password-hint" className={`field-hint${mismatch || tooShort ? ' is-error' : matches ? ' is-ok' : ''}`}
           aria-live="polite">
          {mismatch
            ? t('كلمتا المرور غير متطابقتين.', 'The two passwords do not match.')
            : matches
              ? t('✓ متطابقتان', '✓ They match')
              : t('8 أحرف على الأقل.', 'At least 8 characters.')}
        </p>
        <label className="check-inline">
          <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} />
          {t('إظهار كلمة المرور', 'Show password')}
        </label>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

      <button className="btn btn-primary btn-block" disabled={pending || mismatch}>
        {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ الحساب', 'Create account')}
      </button>
    </form>
  );
}
