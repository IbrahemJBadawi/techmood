'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { Text } from '@/lib/i18n';
import type { RoleStatus } from '@/lib/database.types';

import { decideRequest, type ReviewState } from './actions';

type Decision = 'approved' | 'rejected' | 'more_info_requested' | 'suspended' | 'reinstated';

const NEEDS_NOTE: Decision[] = ['rejected', 'more_info_requested'];

const LABEL: Record<Decision, Text> = {
  approved:            { ar: 'اعتماد',                en: 'Approve' },
  rejected:            { ar: 'رفض',                   en: 'Reject' },
  more_info_requested: { ar: 'طلب معلومات إضافية',    en: 'Request more information' },
  suspended:           { ar: 'إيقاف',                 en: 'Suspend' },
  reinstated:          { ar: 'إعادة تفعيل',           en: 'Reinstate' },
};

const PROMPT: Record<Decision, Text> = {
  approved:            { ar: 'ملاحظة للمتقدّم (اختيارية)',      en: 'A note for the applicant (optional)' },
  rejected:            { ar: 'سبب الرفض — سيقرأه المتقدّم',     en: 'Why — the applicant will read this' },
  more_info_requested: { ar: 'ما المعلومات التي تحتاجها منه؟',  en: 'What do you need from them?' },
  suspended:           { ar: 'سبب الإيقاف',                     en: 'Why you are suspending it' },
  reinstated:          { ar: 'ملاحظة (اختيارية)',               en: 'A note (optional)' },
};

export function RequestReview({ requestId, status }: { requestId: string; status: RoleStatus }) {
  const t = useT();
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
              {t(LABEL[option])}
            </button>
          ))}
        </div>
      )}

      {decision && (
        <form action={formAction}>
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="decision" value={decision} />
          <div className="field">
            <label htmlFor={`note_${requestId}`}>{t(PROMPT[decision])}</label>
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
              {pending
                ? t('جارٍ الحفظ…', 'Saving…')
                : t(`تأكيد: ${t(LABEL[decision])}`, `Confirm: ${t(LABEL[decision])}`)}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDecision(null)}>
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
