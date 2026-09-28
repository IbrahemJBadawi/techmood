'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { submitLevelUpgrade, type MentorFormState } from '../availability-actions';

type Question = { key: string; question_ar: string; hint_ar: string | null; min_chars: number };

export function UpgradeForm({ questions }: { questions: Question[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitLevelUpgrade, undefined as MentorFormState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('استبيان الترقية', 'Upgrade questionnaire')}</h3>
      <input type="hidden" name="keys" value={questions.map((q) => q.key).join(',')} />
      {questions.map((q) => (
        <div className="field" key={q.key}>
          <label htmlFor={`q-${q.key}`}>{q.question_ar}</label>
          {q.hint_ar && <small className="muted" style={{ display: 'block', marginBottom: 4 }}>{q.hint_ar}</small>}
          <textarea id={`q-${q.key}`} name={`q-${q.key}`} rows={q.min_chars >= 60 ? 4 : 2}
                    required minLength={q.min_chars} />
          <small className="muted">{t(`${q.min_chars} حرفاً على الأقل`, `At least ${q.min_chars} characters`)}</small>
        </div>
      ))}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل طلب الترقية', 'Send the upgrade request')}
      </button>
    </form>
  );
}
