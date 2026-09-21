'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { Icon } from '@/components/Icon';
import { ROLE_BY_VALUE, roleLabel, type RoleDefinition } from '@/lib/roles';
import { useT } from '@/lib/i18n.client';
import { formatDate } from '@/lib/i18n';
import type { RoleStatus, UserRole } from '@/lib/database.types';

import {
  answerRequest,
  applyForRole,
  setPrimaryRole,
  withdrawRequest,
  type RoleState,
} from './actions';

type RoleRow = {
  id: string;
  role: UserRole;
  status: RoleStatus;
  statusLabel: string;
  tone: 'ok' | 'wait' | 'ask' | 'no';
  label: string;
  applicationNote: string | null;
  reviewNote: string | null;
  events: { id: string; label: string; note: string | null; at: string }[];
};

export function MyRoles({
  roles,
  available,
  approved,
  primary,
}: {
  roles: RoleRow[];
  available: RoleDefinition[];
  approved: UserRole[];
  primary: UserRole | null;
}) {
  const t = useT();

  return (
    <>
      <section className="section-block">
        <div className="card-grid">
          {roles.map((row) => (
            <RoleCard key={row.id} row={row} isPrimary={row.role === primary} />
          ))}
        </div>
      </section>

      {approved.length > 1 && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('الدور الأساسي', 'Primary role')}</h2>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>
            {t('هو ما تفتح عليه المنصة. لا يمنح صلاحيات إضافية ولا يُلغي بقية أدوارك.',
               'This is what the platform opens on. It grants no extra permission and cancels none of your other roles.')}
          </p>
          <form action={setPrimaryRole} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select name="role" defaultValue={primary ?? approved[0]}>
              {approved.map((role) => (
                <option key={role} value={role}>{t(roleLabel(role))}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm">{t('حفظ', 'Save')}</button>
          </form>
        </section>
      )}

      {available.length > 0 && (
        <section className="section-block">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('أدوار يمكنك طلبها', 'Roles you can ask for')}</h2>
          <div className="card-grid">
            {available.map((role) => <ApplyCard key={role.value} role={role} />)}
          </div>
        </section>
      )}
    </>
  );
}

function RoleCard({ row, isPrimary }: { row: RoleRow; isPrimary: boolean }) {
  const t = useT();
  const [showTrail, setShowTrail] = useState(false);

  return (
    <article className={`card role-status-card tone-${row.tone}`}>
      <div className="row-between">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name={ROLE_BY_VALUE[row.role].icon} />
          {row.label}
        </h3>
        <span className={`pill pill-${row.tone}`}>{row.statusLabel}</span>
      </div>

      <p className="muted">{t(ROLE_BY_VALUE[row.role].blurb)}</p>

      {isPrimary && <p className="muted" style={{ fontSize: '0.8rem' }}>{t('دورك الأساسي حالياً.', 'Currently your primary role.')}</p>}

      {row.status === 'pending_review' && (
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {t('طلبك في قائمة المراجعة. تستطيع رؤية الدور هنا، لكن مساحته تبقى مغلقة حتى الاعتماد.',
             'Your request is in the review queue. You can see the role here, but its workspace stays shut until it is approved.')}
        </p>
      )}

      {row.status === 'rejected' && row.reviewNote && (
        <div className="notice notice-danger">
          <strong>{t('سبب عدم القبول:', 'Why it was not accepted:')}</strong> {row.reviewNote}
          <p style={{ marginTop: 6 }}>
            {t('حسابك كما هو — يمكنك التقدّم مرة أخرى.', 'Your account is untouched — you can apply again.')}
          </p>
        </div>
      )}

      {row.status === 'suspended' && (
        <div className="notice notice-danger">
          <strong>{t('هذا الدور موقوف.', 'This role is suspended.')}</strong> {row.reviewNote}
        </div>
      )}

      {row.status === 'needs_more_info' && <AnswerForm requestId={row.id} ask={row.reviewNote} />}

      {row.status === 'rejected' && <ReapplyForm role={row.role} />}

      {row.events.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowTrail((v) => !v)}>
            {showTrail ? t('إخفاء سجلّ الطلب', 'Hide history') : t('سجلّ الطلب', 'Request history')}
          </button>
          {showTrail && (
            <ol className="request-trail">
              {row.events.map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong>
                  <time dateTime={event.at}>{formatDate(t.locale, event.at)}</time>
                  {event.note && <p className="muted">{event.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {row.status !== 'approved' && row.role !== 'student' && (
        <form action={withdrawRequest}>
          <input type="hidden" name="request_id" value={row.id} />
          <button className="btn btn-ghost btn-sm" type="submit">{t('سحب الطلب', 'Withdraw request')}</button>
        </form>
      )}
    </article>
  );
}

function AnswerForm({ requestId, ask }: { requestId: string; ask: string | null }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(answerRequest, undefined as RoleState);

  return (
    <form action={formAction}>
      <div className="notice">
        <strong>{t('المطلوب منك:', 'What is needed from you:')}</strong>{' '}
        {ask ?? t('معلومات إضافية.', 'More information.')}
      </div>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="field">
        <label htmlFor={`answer_${requestId}`}>{t('ردّك', 'Your answer')}</label>
        <textarea id={`answer_${requestId}`} name="note" rows={3} required minLength={10} />
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل', 'Send')}
      </button>
    </form>
  );
}

function ReapplyForm({ role }: { role: UserRole }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(applyForRole, undefined as RoleState);

  if (role === 'mentor') {
    return <Link className="btn btn-ghost btn-sm" href="/settings/roles/mentor">{t('تقدّم مرة أخرى', 'Apply again')}</Link>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="role" value={role} />
      <div className="field">
        <label htmlFor={`reapply_${role}`}>{t('ما الذي تغيّر؟', 'What has changed?')}</label>
        <textarea id={`reapply_${role}`} name="note" rows={2} required />
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-ghost btn-sm" disabled={pending}>{t('تقدّم مرة أخرى', 'Apply again')}</button>
    </form>
  );
}

function ApplyCard({ role }: { role: RoleDefinition }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(applyForRole, undefined as RoleState);
  const [open, setOpen] = useState(false);

  return (
    <article className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={role.icon} />
        {t(role.label)}
      </h3>
      <p className="muted">{t(role.blurb)}</p>

      {role.value === 'mentor' ? (
        <Link className="btn btn-primary btn-sm" href="/settings/roles/mentor">
          {t('تقدّم كمنتور', 'Apply as a mentor')}
        </Link>
      ) : open ? (
        <form action={formAction}>
          <input type="hidden" name="role" value={role.value} />
          <div className="field">
            <label htmlFor={`note_${role.value}`}>{t('لماذا هذا الدور؟', 'Why this role?')}</label>
            <textarea id={`note_${role.value}`} name="note" rows={3} required minLength={10} />
          </div>
          <div className="field">
            <label htmlFor={`evidence_${role.value}`}>{t('رابط يدعم طلبك (اختياري)', 'A link that supports your case (optional)')}</label>
            <input id={`evidence_${role.value}`} name="evidence_url" type="url" dir="ltr" />
          </div>
          {state?.error && <p className="notice notice-danger">{state.error}</p>}
          {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send request')}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
          {t('تقدّم لهذا الدور', 'Apply for this role')}
        </button>
      )}
    </article>
  );
}
