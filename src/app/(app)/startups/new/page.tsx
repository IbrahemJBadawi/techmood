'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { createStartup, type StartupState } from '../actions';
import { useT } from '@/lib/i18n.client';

export default function NewStartupPage() {
  const t = useT();
  const [state, formAction, pending] = useActionState(createStartup, undefined as StartupState);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/startups">{t('→ رجوع', '← Back')}</Link>

      <section className="section-block" style={{ marginTop: 16, maxWidth: 620 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('مشروع ناشئ جديد', 'A new startup')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('ابدأ بالفكرة — ستُنقل بعدها مباشرة إلى نموذج العمل لتصيغها في تسع خانات.', 'Start with the idea — you go straight to the business model afterwards, to put it into nine blocks.')}
        </p>
      </section>

      <form action={formAction} className="panel" style={{ maxWidth: 620 }}>
        <div className="field">
          <label htmlFor="name">{t('اسم المشروع', 'Name')}</label>
          <input id="name" name="name" required minLength={2} />
        </div>

        <div className="field">
          <label htmlFor="one_liner">{t('في سطر واحد', 'In one line')}</label>
          <input id="one_liner" name="one_liner" placeholder={t('ماذا يفعل مشروعك، بجملة؟', 'What does it do, in a sentence?')} />
        </div>

        <div className="field">
          <label htmlFor="problem">{t('المشكلة', 'The problem')}</label>
          <textarea id="problem" name="problem" rows={2} placeholder={t('ما المشكلة التي تحلّها، ولمن؟', 'What problem are you solving, and for whom?')} />
        </div>

        <div className="field">
          <label htmlFor="solution">{t('الحل', 'The solution')}</label>
          <textarea id="solution" name="solution" rows={2} />
        </div>

        <div className="field">
          <label htmlFor="description">{t('وصف موسّع (اختياري)', 'A fuller description (optional)')}</label>
          <textarea id="description" name="description" rows={3} />
        </div>

        <label className="badge-pill" style={{ cursor: 'pointer', gap: 8, marginBottom: 14 }}>
          <input type="checkbox" name="is_public" defaultChecked />
          {t('اعرض المشروع في قائمة الحاضنة العامة', 'Show this startup in the public incubator list')}
        </label>

        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
          {t('حتى لو كان المشروع معروضاً، تبقى بطاقات نموذج العمل وخطة العمل والاستراتيجية خاصة بك وبفريقك.',
             'Even when the startup is listed, the business-model cards, the plan and the strategy stay private to you and your team.')}
        </p>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ المشروع', 'Create')}
        </button>
      </form>
    </>
  );
}
