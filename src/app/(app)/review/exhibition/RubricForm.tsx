'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { ReviewCriterion } from '@/lib/database.types';

import { CRITERION_LABEL } from '../../../exhibition/types';
import { reviewEntry, type ReviewState } from './actions';

const CRITERIA: ReviewCriterion[] = [
  'requirements', 'technical_quality', 'ui_ux', 'problem_solving', 'documentation', 'completeness',
];

/**
 * The rubric.
 *
 * Six criteria, one to five each, and the overall rating is their average —
 * there is no field for it, because a number nobody can trace back to a
 * criterion is a number nobody can argue with.
 */
export function RubricForm({ entryId }: { entryId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(reviewEntry, undefined as ReviewState);

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="entry_id" value={entryId} />

      <h3 style={{ fontSize: '0.98rem' }}>{t('تقييمك', 'Your evaluation')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('التقييم العام متوسط المعايير الستة — لا يُكتب بيدك.',
           'The overall rating is the average of the six criteria — you do not type it.')}
      </p>

      <table className="exhibit-criteria" style={{ marginTop: 14 }}>
        <tbody>
          {CRITERIA.map((criterion) => (
            <tr key={criterion}>
              <th scope="row">
                <label htmlFor={`c-${criterion}`}>{CRITERION_LABEL[criterion][t.locale]}</label>
              </th>
              <td>
                <select id={`c-${criterion}`} name={criterion} defaultValue="">
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option value={value} key={value}>{'★'.repeat(value)}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="review-note">{t('ملاحظاتك لأصحاب المشروع', 'Your feedback to the builders')}</label>
        <textarea id="review-note" name="note" rows={4} />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" name="decision" value="approve" disabled={pending}>
          {pending ? t('جارٍ…', 'Working…') : t('اعتمد المشروع', 'Approve the project')}
        </button>
        <button className="btn btn-ghost btn-sm" name="decision" value="revision" disabled={pending}>
          {t('أعده للتعديل', 'Send back for revision')}
        </button>
      </div>
    </form>
  );
}
