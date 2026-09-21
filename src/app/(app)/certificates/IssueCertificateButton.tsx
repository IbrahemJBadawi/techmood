'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { issueCertificate, type ActionState } from '../academy/actions';

export function IssueCertificateButton({
  kind,
  targetId,
}: {
  kind: 'course' | 'path';
  targetId: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(issueCertificate, undefined as ActionState);

  return (
    <form action={formAction} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="revalidate" value="/certificates" />
      {state?.error && <span className="muted" style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{state.error}</span>}
      <button className="btn btn-sky btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإصدار…', 'Issuing…') : t('إصدار الشهادة', 'Issue certificate')}
      </button>
    </form>
  );
}
