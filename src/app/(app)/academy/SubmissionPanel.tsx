'use client';

import { useActionState, useState } from 'react';

import { Stars } from '@/components/Stars';
import type { EvidenceKind, Evaluation, Submission } from '@/lib/database.types';

import { requestReevaluation } from '../review/actions';
import { submitWork, type ActionState } from './actions';

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  github: 'رابط المستودع (GitHub)',
  linkedin: 'رابط منشور التوثيق (LinkedIn)',
  youtube: 'رابط فيديو الشرح (YouTube)',
  drive: 'رابط الملفات (Drive)',
  portfolio: 'رابط معرض الأعمال',
  website: 'رابط الموقع',
  file: 'رابط الملف',
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  draft: { text: 'لم يُسلَّم بعد', className: 'status-muted' },
  submitted: { text: 'بانتظار المراجعة', className: 'status-pending' },
  under_review: { text: 'قيد المراجعة', className: 'status-pending' },
  changes_requested: { text: 'مطلوب تعديل', className: 'status-danger' },
  approved: { text: 'معتمد', className: 'status-ok' },
  rejected: { text: 'غير معتمد', className: 'status-danger' },
};

export function SubmissionPanel({
  assignmentId,
  title,
  brief,
  requiredEvidence,
  submission,
  evaluations,
  revalidatePath,
  hasOpenReevaluation = false,
}: {
  assignmentId: string;
  title: string;
  brief: string | null;
  requiredEvidence: EvidenceKind[];
  submission: Submission | null;
  evaluations: Evaluation[];
  revalidatePath: string;
  hasOpenReevaluation?: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitWork, undefined as ActionState);
  const [reevalState, reevalAction, reevalPending] = useActionState(
    requestReevaluation,
    undefined as ActionState,
  );
  const [showReevalForm, setShowReevalForm] = useState(false);

  const status = submission?.status ?? 'draft';
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  const isApproved = status === 'approved';
  const canSubmit = !isApproved;
  const latestEvaluation = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;

  return (
    <div className="panel section-block">
      <div className="row-between">
        <h3 style={{ fontSize: '0.98rem' }}>{title}</h3>
        <span className={`status-pill ${label.className}`}>{label.text}</span>
      </div>

      {brief && <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>{brief}</p>}

      {evaluations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
            سجل التقييم ({evaluations.length}) — كل مراجعة محفوظة، ولا تُمحى بإعادة التسليم
          </p>
          {evaluations.map((evaluation, index) => (
            <div
              key={evaluation.id}
              style={{
                borderTop: index === 0 ? 'none' : '1px solid var(--line)',
                paddingTop: index === 0 ? 0 : 10,
                marginTop: index === 0 ? 0 : 10,
              }}
            >
              <div className="row-between">
                <Stars value={evaluation.stars} />
                <span className="muted eng" style={{ fontSize: '0.74rem' }}>
                  {new Date(evaluation.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
              {evaluation.feedback_ar && (
                <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>{evaluation.feedback_ar}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canSubmit && (
        <form action={formAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="required_evidence" value={requiredEvidence.join(',')} />
          <input type="hidden" name="revalidate" value={revalidatePath} />

          {requiredEvidence.length === 0 && (
            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
              هذه المهمة لا تتطلب روابط — أرفق ملاحظة توضح ما نفّذته.
            </p>
          )}

          {requiredEvidence.map((kind) => (
            <div className="field" key={kind}>
              <label htmlFor={`url_${kind}_${assignmentId}`}>{EVIDENCE_LABELS[kind]}</label>
              <input
                id={`url_${kind}_${assignmentId}`}
                name={`url_${kind}`}
                type="url"
                required
                dir="ltr"
                placeholder="https://"
              />
            </div>
          ))}

          <div className="field">
            <label htmlFor={`note_${assignmentId}`}>ملاحظة للمراجع (اختياري)</label>
            <textarea id={`note_${assignmentId}`} name="note" rows={2} />
          </div>

          {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
          {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

          <button className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? 'جارٍ الإرسال…' : status === 'draft' ? 'تسليم العمل' : 'إعادة التسليم بعد التعديل'}
          </button>
        </form>
      )}

      {isApproved && (
        <p className="notice" style={{ marginTop: 14 }}>
          تم اعتماد هذا العمل ويُحتسب ضمن متطلبات الشهادة.
        </p>
      )}

      {/* Contesting a score is a right, not a favour: the student may ask for a
          second look, and the request lands in the mentor review queue. */}
      {latestEvaluation && !hasOpenReevaluation && !showReevalForm && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => setShowReevalForm(true)}
        >
          اطلب إعادة تقييم
        </button>
      )}

      {hasOpenReevaluation && (
        <p className="notice" style={{ marginTop: 12 }}>
          طلب إعادة التقييم مفتوح وينتظر منتوراً.
        </p>
      )}

      {latestEvaluation && showReevalForm && !hasOpenReevaluation && (
        <form action={reevalAction} style={{ marginTop: 14 }}>
          <input type="hidden" name="submission_id" value={submission?.id ?? ''} />
          <input type="hidden" name="evaluation_id" value={latestEvaluation.id} />
          <input type="hidden" name="revalidate" value={revalidatePath} />
          <div className="field">
            <label htmlFor={`reeval_${assignmentId}`}>لماذا تطلب إعادة التقييم؟</label>
            <textarea id={`reeval_${assignmentId}`} name="reason" rows={3} required />
          </div>
          {reevalState?.error && (
            <p className="notice notice-danger" style={{ marginBottom: 10 }}>{reevalState.error}</p>
          )}
          {reevalState?.ok && <p className="notice" style={{ marginBottom: 10 }}>{reevalState.ok}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={reevalPending}>
              {reevalPending ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReevalForm(false)}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
