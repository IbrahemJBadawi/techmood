'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { SessionCriterion } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { rateSession, type RateState } from './actions';

const LABEL: Record<SessionCriterion, Text> = {
  quality:        { ar: 'جودة الجلسة',        en: 'Session quality' },
  clarity:        { ar: 'الوضوح',             en: 'Clarity' },
  usefulness:     { ar: 'الفائدة',            en: 'Usefulness' },
  punctuality:    { ar: 'الالتزام بالموعد',   en: 'Punctuality' },
  guidance:       { ar: 'جودة التوجيه',       en: 'Guidance' },
  commitment:     { ar: 'الالتزام',           en: 'Commitment' },
  preparation:    { ar: 'الاستعداد',          en: 'Preparation' },
  participation:  { ar: 'المشاركة',           en: 'Participation' },
  use_of_session: { ar: 'استثمار الوقت',      en: 'Use of the session' },
  cooperation:    { ar: 'التعاون',            en: 'Cooperation' },
  communication:  { ar: 'التواصل',            en: 'Communication' },
};

/**
 * The rating, on the criteria of whichever side is writing.
 *
 * There is no overall field: the star the mentor's rating rides on is the
 * average of what is given here, so nobody can leave five stars without saying
 * what was good about the hour.
 */
export function RatingForm({
  bookingId,
  criteria,
  revalidate,
}: {
  bookingId: string;
  criteria: SessionCriterion[];
  revalidate: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(rateSession, undefined as RateState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('قيّم هذه الجلسة', 'Rate this session')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('لن يرى الطرف الآخر تقييمك قبل أن يكتب تقييمه — ولن ترى تقييمه قبل ذلك أيضاً.',
           'The other side does not see your rating before writing theirs — and you do not see theirs either.')}
      </p>

      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="criteria" value={criteria.join(',')} />
      <input type="hidden" name="revalidate" value={revalidate} />

      <table className="exhibit-criteria" style={{ marginTop: 14 }}>
        <tbody>
          {criteria.map((criterion) => (
            <tr key={criterion}>
              <th scope="row">
                <label htmlFor={`c-${criterion}`}>{t(LABEL[criterion])}</label>
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

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="comment">{t('ملاحظة اختيارية', 'An optional note')}</label>
        <textarea id="comment" name="comment" rows={3} />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل التقييم', 'Send the rating')}
      </button>
    </form>
  );
}
