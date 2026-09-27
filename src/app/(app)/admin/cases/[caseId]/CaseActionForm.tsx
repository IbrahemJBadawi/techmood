'use client';

import { useActionState, useState } from 'react';

import { ADMIN_ACTION, FEATURE } from '@/lib/cases';
import type { AdminActionKind } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';

import { caseAction } from '../../support/actions';

type Option = { value: string; label: string };

/**
 * The decision, and what follows from it.
 *
 * Every action needs a reason; the sensitive ones (anything that takes
 * something away, or money) also need an explicit confirmation here — and the
 * database refuses them without a duration and evidence on the case, whatever
 * this form sends.
 */
export function CaseActionForm({
  caseId, people, targets, restrictions,
}: {
  caseId: string;
  people: Option[];
  /** bookings, escrows and sessions linked to the case */
  targets: Option[];
  restrictions: Option[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(caseAction, undefined);
  const [action, setAction] = useState<AdminActionKind>('request_info');
  const [confirmed, setConfirmed] = useState(false);
  const spec = ADMIN_ACTION[action];

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="field">
        <label htmlFor="case-action">{t('الإجراء', 'Action')}</label>
        <select id="case-action" name="action" value={action} onChange={(event) => { setAction(event.target.value as AdminActionKind); setConfirmed(false); }}>
          {(Object.keys(ADMIN_ACTION) as AdminActionKind[]).map((key) => (
            <option key={key} value={key}>{ADMIN_ACTION[key].sensitive ? '⚠️ ' : ''}{t(ADMIN_ACTION[key].label)}</option>
          ))}
        </select>
      </div>

      {spec.needs.includes('target_profile') && (
        <div className="field">
          <label htmlFor="case-target-profile">{t('الشخص', 'Person')}</label>
          <select id="case-target-profile" name="target_profile" required>
            {people.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}

      {spec.needs.includes('target_id') && (
        <div className="field">
          <label htmlFor="case-target">{t('العملية', 'Operation')}</label>
          <select id="case-target" name="target_id" required>
            {(action === 'lift_restriction' ? restrictions : targets).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {(action === 'lift_restriction' ? restrictions : targets).length === 0 && (
            <p className="muted" style={{ fontSize: '0.78rem' }}>
              {action === 'lift_restriction'
                ? t('لا قيود سارية على أطراف القضية.', 'No restriction in force on the people in this case.')
                : t('اربط الحجز أو المبلغ أو الجلسة بالقضية أولاً.', 'Link the booking, escrow or session to the case first.')}
            </p>
          )}
        </div>
      )}

      {spec.needs.includes('feature') && (
        <div className="field">
          <label htmlFor="case-feature">{t('الميزة', 'Feature')}</label>
          <select id="case-feature" name="feature" required>
            {(Object.keys(FEATURE) as (keyof typeof FEATURE)[]).map((key) => <option key={key} value={key}>{t(FEATURE[key])}</option>)}
          </select>
        </div>
      )}

      {spec.needs.includes('duration') && (
        <div className="field">
          <label htmlFor="case-duration">{t('المدة بالأيام (0 = حتى يُرفع يدوياً)', 'Duration in days (0 = until lifted)')}</label>
          <input id="case-duration" name="duration_days" type="number" min={0} max={3650} required />
        </div>
      )}

      <div className="field">
        <label htmlFor="case-reason">{t('السبب (مطلوب، ويُرسل للشخص إن اخترت إبلاغه)', 'Reason (required; sent to the person if you notify them)')}</label>
        <textarea id="case-reason" name="reason" rows={3} required />
      </div>

      <label className="switch-row"><input type="checkbox" name="notify" defaultChecked />{t('أبلغ الشخص المعني', 'Notify the person')}</label>

      {spec.sensitive && (
        <label className="switch-row" style={{ color: 'var(--danger)' }}>
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          {t('⚠️ أؤكد هذا الإجراء: راجعت الأدلة والسبب والمدة.', '⚠️ I confirm this action: I checked the evidence, the reason and the duration.')}
        </label>
      )}

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className={`btn btn-sm ${spec.sensitive ? 'btn-danger' : 'btn-primary'}`} type="submit" disabled={pending || (spec.sensitive && !confirmed)}>
        {pending ? t('جارٍ…', 'Working…') : t(spec.label)}
      </button>
    </form>
  );
}
