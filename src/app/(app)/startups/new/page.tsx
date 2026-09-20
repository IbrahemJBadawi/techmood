'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { createStartup, type StartupState } from '../actions';

export default function NewStartupPage() {
  const [state, formAction, pending] = useActionState(createStartup, undefined as StartupState);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/startups">→ رجوع</Link>

      <section className="section-block" style={{ marginTop: 16, maxWidth: 620 }}>
        <h2 style={{ fontSize: '1.2rem' }}>مشروع ناشئ جديد</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          ابدأ بالفكرة — ستُنقل بعدها مباشرة إلى نموذج العمل لتصيغها في تسع خانات.
        </p>
      </section>

      <form action={formAction} className="panel" style={{ maxWidth: 620 }}>
        <div className="field">
          <label htmlFor="name">اسم المشروع</label>
          <input id="name" name="name" required minLength={2} />
        </div>

        <div className="field">
          <label htmlFor="one_liner">في سطر واحد</label>
          <input id="one_liner" name="one_liner" placeholder="ماذا يفعل مشروعك، بجملة؟" />
        </div>

        <div className="field">
          <label htmlFor="problem">المشكلة</label>
          <textarea id="problem" name="problem" rows={2} placeholder="ما المشكلة التي تحلّها، ولمن؟" />
        </div>

        <div className="field">
          <label htmlFor="solution">الحل</label>
          <textarea id="solution" name="solution" rows={2} />
        </div>

        <div className="field">
          <label htmlFor="description">وصف موسّع (اختياري)</label>
          <textarea id="description" name="description" rows={3} />
        </div>

        <label className="badge-pill" style={{ cursor: 'pointer', gap: 8, marginBottom: 14 }}>
          <input type="checkbox" name="is_public" defaultChecked />
          اعرض المشروع في قائمة الحاضنة العامة
        </label>

        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
          حتى لو كان المشروع معروضاً، تبقى بطاقات نموذج العمل وخطة العمل والاستراتيجية خاصة بك
          وبفريقك.
        </p>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? 'جارٍ الإنشاء…' : 'أنشئ المشروع'}
        </button>
      </form>
    </>
  );
}
