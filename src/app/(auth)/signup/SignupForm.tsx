'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { signup, type AuthState } from '../actions';

export function SignupForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(signup, undefined as AuthState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="full_name">{t('الاسم الكامل', 'Full name')}</label>
        <input id="full_name" name="full_name" type="text" required autoComplete="name" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="email">{t('البريد الإلكتروني', 'Email')}</label>
          <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="password">{t('كلمة المرور', 'Password')}</label>
          <input id="password" name="password" type="password" required minLength={8}
                 autoComplete="new-password" dir="ltr" />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ الحساب', 'Create account')}
      </button>
    </form>
  );
}
