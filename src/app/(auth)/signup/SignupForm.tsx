'use client';

import { useActionState } from 'react';

import { signup, type AuthState } from '../actions';

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined as AuthState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="full_name">الاسم الكامل</label>
        <input id="full_name" name="full_name" type="text" required autoComplete="name" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'جارٍ الإنشاء…' : 'أنشئ الحساب'}
      </button>
    </form>
  );
}
