'use client';

import { useActionState } from 'react';

import { applyToIncubator, type StartupState } from '../actions';

const STATUS: Record<string, { text: string; className: string }> = {
  pending_review: { text: 'قيد المراجعة', className: 'status-pending' },
  approved: { text: 'مقبول', className: 'status-ok' },
  rejected: { text: 'مرفوض', className: 'status-danger' },
  suspended: { text: 'موقوف', className: 'status-muted' },
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
  const [state, formAction, pending] = useActionState(applyToIncubator, undefined as StartupState);

  if (isInIncubator) {
    return (
      <div className="panel">
        <h3 style={{ fontSize: '0.98rem' }}>🏛️ في الحاضنة</h3>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
          مشروعك مقبول في حاضنة TechMood. احجز جلسات مع المنتورز لمراجعة نموذج عملك وخطتك.
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
        <h3 style={{ fontSize: '0.98rem' }}>طلب الحاضنة</h3>
        <span className={`status-pill ${STATUS.pending_review.className}`} style={{ marginTop: 10, display: 'inline-block' }}>
          {STATUS.pending_review.text}
        </span>
        <p className="muted" style={{ fontSize: '0.87rem', marginTop: 12 }}>{application.pitch_ar}</p>
      </div>
    );
  }

  const ready = canvasCards >= 6;

  return (
    <div className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>قدّم للحاضنة</h3>

      {application?.status === 'rejected' && application.review_note && (
        <p className="notice notice-danger" style={{ marginBottom: 12 }}>
          <strong>لم يُقبل الطلب السابق:</strong> {application.review_note}
        </p>
      )}

      {!ready && (
        <p className="notice" style={{ marginBottom: 12 }}>
          أكمل نموذج العمل أولاً — لديك {canvasCards} من 6 بطاقات على الأقل. الحاضنة تحتاج أن ترى
          أنك فكّرت في المشروع قبل أن تراجعه.
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="startup_id" value={startupId} />

        <div className="field">
          <label htmlFor="pitch">لماذا تطلب دعم الحاضنة؟</label>
          <textarea id="pitch" name="pitch" rows={4} required disabled={!ready} />
        </div>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
        {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

        <button className="btn btn-primary btn-sm" disabled={pending || !ready}>
          {pending ? 'جارٍ الإرسال…' : 'أرسل الطلب'}
        </button>
      </form>
    </div>
  );
}
