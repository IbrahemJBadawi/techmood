'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { SELECTABLE_ROLES } from '@/lib/roles';
import { signup } from '../actions';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <main className="landing" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.4rem', margin: '48px 0 6px' }}>أنشئ حسابك في TechMood</h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        حساب واحد يمنحك هوية TechMood واحدة، ويمكنك إضافة أدوار أخرى في أي وقت.
      </p>

      <form action={formAction} className="panel">
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

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
          <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>
            أدوار إضافية (اختياري)
          </legend>
          <div className="tags-row">
            {SELECTABLE_ROLES.filter((role) => role.needsReview).map((role) => (
              <label key={role.value} className="badge-pill" style={{ cursor: 'pointer', gap: 6 }}>
                <input type="checkbox" name="roles" value={role.value} />
                {role.label}
              </label>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
            دور الطالب مفعّل فوراً. أي دور آخر يدخل قائمة المراجعة، وحسابك يبقى فعّالاً كطالب
            سواء قُبل الطلب أو رُفض.
          </p>
        </fieldset>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 14 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </button>
      </form>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        لديك حساب؟ <Link href="/login" style={{ color: 'var(--royal-dark)' }}>سجّل الدخول</Link>
      </p>
    </main>
  );
}
