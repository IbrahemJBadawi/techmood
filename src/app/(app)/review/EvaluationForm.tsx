'use client';

import { useActionState, useState } from 'react';

import { evaluateSubmission, type ReviewState } from './actions';

const DECISIONS = [
  { value: 'approved', label: 'اعتماد', hint: 'يمنح النقاط ويُحتسب ضمن متطلبات الشهادة.' },
  { value: 'changes_requested', label: 'يحتاج تعديلاً', hint: 'يعود للطالب ليعدّل ويعيد التسليم.' },
  { value: 'rejected', label: 'غير معتمد', hint: 'لا يُحتسب، ويحتاج عملاً جديداً.' },
] as const;

export function EvaluationForm({ submissionId }: { submissionId: string }) {
  const [state, formAction, pending] = useActionState(evaluateSubmission, undefined as ReviewState);
  const [decision, setDecision] = useState<string>('approved');
  const [stars, setStars] = useState<number>(4);

  const active = DECISIONS.find((item) => item.value === decision);

  return (
    <form action={formAction} className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>تقييمك</h3>

      <input type="hidden" name="submission_id" value={submissionId} />

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
        <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>القرار</legend>
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
              {item.label}
            </label>
          ))}
        </div>
        {active && <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>{active.hint}</p>}
      </fieldset>

      {decision === 'approved' && (
        <div className="field">
          <label htmlFor="stars">
            جودة العمل — {stars} من 5{' '}
            <span className="muted" style={{ fontSize: '0.76rem' }}>
              (النجوم جودة، والنقاط تُحسب منها تلقائياً)
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
          ملاحظاتك للطالب{decision === 'approved' ? ' (اختياري)' : ''}
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={5}
          placeholder="ما الذي نجح، وما الذي يحتاج تحسيناً، وكيف؟"
          required={decision !== 'approved'}
        />
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'جارٍ الحفظ…' : 'حفظ التقييم'}
      </button>

      <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
        التقييم يُضاف إلى السجل ولا يستبدل ما سبقه — الطالب يرى كل المراجعات.
      </p>
    </form>
  );
}
