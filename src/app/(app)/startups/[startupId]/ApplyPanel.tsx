'use client';

import { useActionState } from 'react';

import { applyToIncubator, type StartupState } from '../actions';
import type { Text } from '@/lib/i18n';
import { useT } from '@/lib/i18n.client';

const STATUS: Record<string, { text: Text; className: string }> = {
  pending_review:  { text: { ar: 'قيد المراجعة',        en: 'Under review' }, className: 'status-pending' },
  needs_more_info: { text: { ar: 'بانتظار معلومات منك', en: 'Needs info' },   className: 'status-pending' },
  approved:        { text: { ar: 'مقبول',               en: 'Accepted' },     className: 'status-ok' },
  rejected:        { text: { ar: 'مرفوض',               en: 'Rejected' },     className: 'status-danger' },
  suspended:       { text: { ar: 'موقوف',               en: 'Suspended' },    className: 'status-muted' },
};

export function ApplyPanel({
  startupId,
  isInIncubator,
  application,
  canvasCards,
}: {
  startupId: string;
  isInIncubator: boolean;
  application: { id: string; status: string; pitch_ar: string; review_note: string | null } | null;
  canvasCards: number;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(applyToIncubator, undefined as StartupState);

  if (isInIncubator) {
    return (
      <div className="panel">
        <h3 style={{ fontSize: '0.98rem' }}>{t('🏛️ في الحاضنة', '🏛️ In the incubator')}</h3>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
          {t('مشروعك مقبول في حاضنة TechMood. احجز جلسات مع المنتورز لمراجعة نموذج عملك وخطتك.', 'Your startup is in the TechMood incubator. Book sessions with mentors to review your model and your plan.')}
        </p>
        {application?.review_note && (
          <p className="notice" style={{ marginTop: 12 }}>{application.review_note}</p>
        )}
      </div>
    );
  }

  if (application?.status === 'pending_review') {
    return (
      <div className="panel">
        <h3 style={{ fontSize: '0.98rem' }}>{t('طلب الحاضنة', 'Incubator application')}</h3>
        <span className={`status-pill ${STATUS.pending_review.className}`} style={{ marginTop: 10, display: 'inline-block' }}>
          {t(STATUS.pending_review.text)}
        </span>
        <p className="muted" style={{ fontSize: '0.87rem', marginTop: 12 }}>{application.pitch_ar}</p>
      </div>
    );
  }

  const ready = canvasCards >= 6;

  return (
    <div className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('قدّم للحاضنة', 'Apply to the incubator')}</h3>

      {application?.status === 'rejected' && application.review_note && (
        <p className="notice notice-danger" style={{ marginBottom: 12 }}>
          <strong>{t('لم يُقبل الطلب السابق:', 'The previous application was not accepted:')}</strong> {application.review_note}
        </p>
      )}

      {!ready && (
        <p className="notice" style={{ marginBottom: 12 }}>
          {t(`أكمل نموذج العمل أولاً — لديك ${canvasCards} من 6 بطاقات على الأقل. الحاضنة تحتاج أن ترى أنك فكّرت في المشروع قبل أن تراجعه.`,
             `Fill in the business model first — you have ${canvasCards} of the six cards needed. The incubator wants to see you have thought this through before it reviews it.`)}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="startup_id" value={startupId} />

        <div className="field">
          <label htmlFor="pitch">{t('لماذا تطلب دعم الحاضنة؟', 'Why are you asking for the incubator’s support?')}</label>
          <textarea id="pitch" name="pitch" rows={4} required disabled={!ready} />
        </div>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
        {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

        <button className="btn btn-primary btn-sm" disabled={pending || !ready}>
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send application')}
        </button>
      </form>
    </div>
  );
}
