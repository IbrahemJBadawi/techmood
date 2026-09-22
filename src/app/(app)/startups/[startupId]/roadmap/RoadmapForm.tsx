'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { addRoadmapItem, type RoadmapState } from './actions';

/** A line for something the company intends but has not started. */
export function RoadmapForm({ startupId, year }: { startupId: string; year: number }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addRoadmapItem, undefined as RoadmapState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="title">{t('البند', 'The item')}</label>
        <input id="title" name="title" required placeholder={t('إطلاق النسخة التجريبية', 'Launch the beta')} />
      </div>
      <div className="field">
        <label htmlFor="year">{t('السنة', 'Year')}</label>
        <input id="year" name="year" type="number" min="2024" max="2100" defaultValue={year} />
      </div>
      <div className="field">
        <label htmlFor="quarter">{t('الربع', 'Quarter')}</label>
        <select id="quarter" name="quarter" defaultValue="1">
          {[1, 2, 3, 4].map((quarter) => (
            <option key={quarter} value={quarter}>Q{quarter}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="detail">{t('تفصيل', 'Detail')}</label>
        <input id="detail" name="detail" />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Adding…') : t('أضف', 'Add')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
