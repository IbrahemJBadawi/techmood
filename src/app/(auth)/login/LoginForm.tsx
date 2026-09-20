'use client';

import { useActionState } from 'react';

import { login, type AuthState } from '../actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined as AuthState);

  return (
    <form action={formAction}>
      {next && <input type="hidden" name="next" value={next} />}
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
  );
}
