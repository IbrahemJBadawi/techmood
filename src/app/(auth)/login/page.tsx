'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { login } from '../actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="landing" style={{ maxWidth: 440 }}>
      <h1 style={{ fontSize: '1.4rem', margin: '48px 0 6px' }}>مرحباً بعودتك</h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        سجّل الدخول لمتابعة رحلتك في TechMood.
      </p>

      <form action={formAction} className="panel">
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? 'جارٍ الدخول…' : 'دخول'}
        </button>
      </form>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        ليس لديك حساب؟ <Link href="/signup" style={{ color: 'var(--royal-dark)' }}>أنشئ حساباً</Link>
      </p>
    </main>
  );
}
