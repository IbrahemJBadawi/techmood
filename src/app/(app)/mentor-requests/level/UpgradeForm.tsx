'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { submitLevelUpgrade, type MentorFormState } from '../availability-actions';

type Question = { key: string; question_ar: string; hint_ar: string | null; min_chars: number; needs_link: boolean };

export function UpgradeForm({ questions }: { questions: Question[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitLevelUpgrade, undefined as MentorFormState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('طلب ترقية المستوى', 'Request a level upgrade')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
        {t('تقرأ الإدارة إجاباتك مع خبرتك وتخصصك وأعمالك وتقييماتك وسجل جلساتك — لا يُرقّى أحد بعدد النجوم وحده.',
           'TechMood reads your answers with your experience, specialty, works, ratings and sessions record — stars alone never move anyone up.')}
      </p>
      <input type="hidden" name="keys" value={questions.map((q) => q.key).join(',')} />
      {questions.map((q) => (
        <div className="field" key={q.key}>
          <label htmlFor={`q-${q.key}`}>{q.question_ar}</label>
          {q.hint_ar && <small className="muted" style={{ display: 'block', marginBottom: 4 }}>{q.hint_ar}</small>}
          <textarea id={`q-${q.key}`} name={`q-${q.key}`} rows={q.min_chars >= 60 ? 4 : 2}
                    required minLength={q.min_chars} />
          <small className="muted">
            {t(`${q.min_chars} حرفاً على الأقل`, `At least ${q.min_chars} characters`)}
            {q.needs_link && t(' · رابط واحد على الأقل (https://…)', ' · at least one link (https://…)')}
          </small>
        </div>
      ))}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل طلب الترقية', 'Send the upgrade request')}
      </button>
    </form>
  );
}
