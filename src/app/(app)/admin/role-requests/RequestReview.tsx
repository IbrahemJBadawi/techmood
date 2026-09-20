'use client';

import { useActionState, useState } from 'react';

import type { RoleStatus } from '@/lib/database.types';

import { decideRequest, type ReviewState } from './actions';

type Decision = 'approved' | 'rejected' | 'more_info_requested' | 'suspended' | 'reinstated';

const NEEDS_NOTE: Decision[] = ['rejected', 'more_info_requested'];

const LABEL: Record<Decision, string> = {
  approved: 'اعتماد',
  rejected: 'رفض',
  more_info_requested: 'طلب معلومات إضافية',
  suspended: 'إيقاف',
  reinstated: 'إعادة تفعيل',
};

const PROMPT: Record<Decision, string> = {
  approved: 'ملاحظة للمتقدّم (اختيارية)',
  rejected: 'سبب الرفض — سيقرأه المتقدّم',
  more_info_requested: 'ما المعلومات التي تحتاجها منه؟',
  suspended: 'سبب الإيقاف',
  reinstated: 'ملاحظة (اختيارية)',
};

export function RequestReview({ requestId, status }: { requestId: string; status: RoleStatus }) {
  const [state, formAction, pending] = useActionState(decideRequest, undefined as ReviewState);
  const [decision, setDecision] = useState<Decision | null>(null);

  const options: Decision[] = status === 'approved'
    ? ['suspended']
    : status === 'suspended'
      ? ['reinstated']
      : ['approved', 'more_info_requested', 'rejected'];

  return (
    <div className="review-actions">
      {!decision && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`btn btn-sm ${option === 'approved' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDecision(option)}
            >
              {LABEL[option]}
            </button>
          ))}
        </div>
      )}

      {decision && (
        <form action={formAction}>
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="decision" value={decision} />
          <div className="field">
            <label htmlFor={`note_${requestId}`}>{PROMPT[decision]}</label>
            <textarea
              id={`note_${requestId}`}
              name="note"
              rows={3}
              required={NEEDS_NOTE.includes(decision)}
              minLength={NEEDS_NOTE.includes(decision) ? 10 : undefined}
            />
          </div>
          {state?.error && <p className="notice notice-danger">{state.error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? 'جارٍ الحفظ…' : `تأكيد: ${LABEL[decision]}`}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDecision(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
