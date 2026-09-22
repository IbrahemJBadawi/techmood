'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { addDeliverable, addMilestone, type WorkState } from './actions';

/** What was handed over, and the dates it was promised by. */
export function DeliverableForm({ projectId }: { projectId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addDeliverable, undefined as WorkState);

  return (
    <form action={formAction} className="meeting-form">
      <input type="hidden" name="project_id" value={projectId} />

      <div className="field">
        <label htmlFor="deliverable-label">{t('التسليم', 'Deliverable')}</label>
        <input id="deliverable-label" name="label" placeholder={t('النسخة الأولى من اللوحة', 'First version of the dashboard')} />
      </div>
      <div className="field">
        <label htmlFor="deliverable-kind">{t('النوع', 'Kind')}</label>
        <select id="deliverable-kind" name="kind" defaultValue="website">
          <option value="github">GitHub</option>
          <option value="website">{t('موقع', 'Website')}</option>
          <option value="drive">{t('ملف', 'File')}</option>
          <option value="youtube">{t('فيديو', 'Video')}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="deliverable-url">{t('الرابط', 'Link')}</label>
        <input id="deliverable-url" name="url" type="url" dir="ltr" required />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Adding…') : t('أرفق', 'Attach')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}

export function MilestoneForm({ projectId }: { projectId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addMilestone, undefined as WorkState);

  return (
    <form action={formAction} className="meeting-form">
      <input type="hidden" name="project_id" value={projectId} />

      <div className="field">
        <label htmlFor="milestone-title">{t('المعلم', 'Milestone')}</label>
        <input id="milestone-title" name="title" required />
      </div>
      <div className="field">
        <label htmlFor="milestone-due">{t('موعده', 'Due')}</label>
        <input id="milestone-due" name="due_on" type="date" />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Adding…') : t('أضف', 'Add')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
