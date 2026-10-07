'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { login, type AuthState } from '../actions';
import { PasswordField } from '@/components/PasswordField';

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(login, undefined as AuthState);

  return (
    <form action={formAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="field">
        <label htmlFor="email">{t('البريد الإلكتروني', 'Email')}</label>
        <input id="email" name="email" type="email" required autoComplete="email"
               dir="ltr" placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="password">{t('كلمة المرور', 'Password')}</label>
        <PasswordField id="password" name="password" required autoComplete="current-password" dir="ltr" />
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending} aria-busy={pending}>
        {pending ? t('جارٍ الدخول…', 'Signing in…') : t('دخول', 'Sign in')}
      </button>
    </form>
  );
}
