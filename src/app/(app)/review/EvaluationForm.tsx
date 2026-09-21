'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { evaluateSubmission, type ReviewState } from './actions';

const DECISIONS = [
  {
    value: 'approved',
    label: { ar: 'اعتماد', en: 'Approve' },
    hint: { ar: 'يمنح النقاط ويُحتسب ضمن متطلبات الشهادة.',
            en: 'Awards the points and counts towards the certificate.' },
  },
  {
    value: 'changes_requested',
    label: { ar: 'يحتاج تعديلاً', en: 'Needs changes' },
    hint: { ar: 'يعود للطالب ليعدّل ويعيد التسليم.',
            en: 'Goes back to the student to fix and resubmit.' },
  },
  {
    value: 'rejected',
    label: { ar: 'غير معتمد', en: 'Not approved' },
    hint: { ar: 'لا يُحتسب، ويحتاج عملاً جديداً.',
            en: 'Does not count; it needs fresh work.' },
  },
] as const;

export function EvaluationForm({ submissionId }: { submissionId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(evaluateSubmission, undefined as ReviewState);
  const [decision, setDecision] = useState<string>('approved');
  const [stars, setStars] = useState<number>(4);

  const active = DECISIONS.find((item) => item.value === decision);

  return (
    <form action={formAction} className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('تقييمك', 'Your evaluation')}</h3>

      <input type="hidden" name="submission_id" value={submissionId} />

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
        <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>{t('القرار', 'Decision')}</legend>
        <div className="tags-row">
          {DECISIONS.map((item) => (
            <label
              key={item.value}
              className="badge-pill"
              style={{
                cursor: 'pointer',
                gap: 6,
                background: decision === item.value ? 'var(--royal)' : undefined,
                color: decision === item.value ? '#fff' : undefined,
              }}
            >
              <input
                type="radio"
                name="decision"
                value={item.value}
                checked={decision === item.value}
                onChange={(event) => setDecision(event.target.value)}
              />
              {t(item.label)}
            </label>
          ))}
        </div>
        {active && <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>{t(active.hint)}</p>}
      </fieldset>

      {decision === 'approved' && (
        <div className="field">
          <label htmlFor="stars">
            {t(`جودة العمل — ${stars} من 5`, `Quality — ${stars} of 5`)}{' '}
            <span className="muted" style={{ fontSize: '0.76rem' }}>
              {t('(النجوم جودة، والنقاط تُحسب منها تلقائياً)', '(stars are quality; the points are computed from them)')}
            </span>
          </label>
          <input
            id="stars"
            name="stars"
            type="range"
            min={1}
            max={5}
            step={1}
            value={stars}
            onChange={(event) => setStars(Number(event.target.value))}
          />
          <span className="stars-filled" aria-hidden="true">{'★'.repeat(stars)}</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="feedback">
          {t('ملاحظاتك للطالب', 'Your notes for the student')}
          {decision === 'approved' ? t(' (اختياري)', ' (optional)') : ''}
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={5}
          placeholder={t('ما الذي نجح، وما الذي يحتاج تحسيناً، وكيف؟', 'What worked, what needs improving, and how?')}
          required={decision !== 'approved'}
        />
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التقييم', 'Save evaluation')}
      </button>

      <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
        {t('التقييم يُضاف إلى السجل ولا يستبدل ما سبقه — الطالب يرى كل المراجعات.', 'An evaluation is appended to the record and replaces nothing — the student sees every review.')}
      </p>
    </form>
  );
}
