'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { Icon } from '@/components/Icon';
import { ROLE_BY_VALUE, roleLabel, type RoleDefinition } from '@/lib/roles';
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
          <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>الدور الأساسي</h2>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>
            هو ما تفتح عليه المنصة. لا يمنح صلاحيات إضافية ولا يُلغي بقية أدوارك.
          </p>
          <form action={setPrimaryRole} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select name="role" defaultValue={primary ?? approved[0]}>
              {approved.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm">حفظ</button>
          </form>
        </section>
      )}

      {available.length > 0 && (
        <section className="section-block">
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>أدوار يمكنك طلبها</h2>
          <div className="card-grid">
            {available.map((role) => <ApplyCard key={role.value} role={role} />)}
          </div>
        </section>
      )}
    </>
  );
}

function RoleCard({ row, isPrimary }: { row: RoleRow; isPrimary: boolean }) {
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

      <p className="muted">{ROLE_BY_VALUE[row.role].blurb}</p>

      {isPrimary && <p className="muted" style={{ fontSize: '0.8rem' }}>دورك الأساسي حالياً.</p>}

      {row.status === 'pending_review' && (
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          طلبك في قائمة المراجعة. تستطيع رؤية الدور هنا، لكن مساحته تبقى مغلقة
          حتى الاعتماد.
        </p>
      )}

      {row.status === 'rejected' && row.reviewNote && (
        <div className="notice notice-danger">
          <strong>سبب عدم القبول:</strong> {row.reviewNote}
          <p style={{ marginTop: 6 }}>حسابك كما هو — يمكنك التقدّم مرة أخرى.</p>
        </div>
      )}

      {row.status === 'suspended' && (
        <div className="notice notice-danger">
          <strong>هذا الدور موقوف.</strong> {row.reviewNote}
        </div>
      )}

      {row.status === 'needs_more_info' && <AnswerForm requestId={row.id} ask={row.reviewNote} />}

      {row.status === 'rejected' && <ReapplyForm role={row.role} />}

      {row.events.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowTrail((v) => !v)}>
            {showTrail ? 'إخفاء سجلّ الطلب' : 'سجلّ الطلب'}
          </button>
          {showTrail && (
            <ol className="request-trail">
              {row.events.map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong>
                  <time dateTime={event.at}>{new Date(event.at).toLocaleDateString('ar')}</time>
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
          <button className="btn btn-ghost btn-sm" type="submit">سحب الطلب</button>
        </form>
      )}
    </article>
  );
}

function AnswerForm({ requestId, ask }: { requestId: string; ask: string | null }) {
  const [state, formAction, pending] = useActionState(answerRequest, undefined as RoleState);

  return (
    <form action={formAction}>
      <div className="notice">
        <strong>المطلوب منك:</strong> {ask ?? 'معلومات إضافية.'}
      </div>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="field">
        <label htmlFor={`answer_${requestId}`}>ردّك</label>
        <textarea id={`answer_${requestId}`} name="note" rows={3} required minLength={10} />
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? 'جارٍ الإرسال…' : 'أرسل'}
      </button>
    </form>
  );
}

function ReapplyForm({ role }: { role: UserRole }) {
  const [state, formAction, pending] = useActionState(applyForRole, undefined as RoleState);

  if (role === 'mentor') {
    return <Link className="btn btn-ghost btn-sm" href="/settings/roles/mentor">تقدّم مرة أخرى</Link>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="role" value={role} />
      <div className="field">
        <label htmlFor={`reapply_${role}`}>ما الذي تغيّر؟</label>
        <textarea id={`reapply_${role}`} name="note" rows={2} required />
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-ghost btn-sm" disabled={pending}>تقدّم مرة أخرى</button>
    </form>
  );
}

function ApplyCard({ role }: { role: RoleDefinition }) {
  const [state, formAction, pending] = useActionState(applyForRole, undefined as RoleState);
  const [open, setOpen] = useState(false);

  return (
    <article className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={role.icon} />
        {role.label}
      </h3>
      <p className="muted">{role.blurb}</p>

      {role.value === 'mentor' ? (
        <Link className="btn btn-primary btn-sm" href="/settings/roles/mentor">
          تقدّم كمنتور
        </Link>
      ) : open ? (
        <form action={formAction}>
          <input type="hidden" name="role" value={role.value} />
          <div className="field">
            <label htmlFor={`note_${role.value}`}>لماذا هذا الدور؟</label>
            <textarea id={`note_${role.value}`} name="note" rows={3} required minLength={10} />
          </div>
          <div className="field">
            <label htmlFor={`evidence_${role.value}`}>رابط يدعم طلبك (اختياري)</label>
            <input id={`evidence_${role.value}`} name="evidence_url" type="url" dir="ltr" />
          </div>
          {state?.error && <p className="notice notice-danger">{state.error}</p>}
          {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? 'جارٍ الإرسال…' : 'أرسل الطلب'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
          تقدّم لهذا الدور
        </button>
      )}
    </article>
  );
}
