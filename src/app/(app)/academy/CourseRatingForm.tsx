'use client';

import { useActionState } from 'react';

import { RatingExtras } from '@/components/RatingExtras';
import { COURSE_CRITERION } from '@/lib/criteria';
import type { CourseCriterion } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';

import { rateCourse, type ActionState } from './actions';
import { StarInput } from '@/components/StarInput';

/** «كيف كانت الدورة؟» — offered once the course is finished, once. */
export function CourseRatingForm({ courseId, revalidate }: { courseId: string; revalidate: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(rateCourse, undefined as ActionState);

  if (state?.ok) return <p className="notice notice-ok">{state.ok}</p>;

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <h3 style={{ fontSize: '0.98rem' }}>{t('كيف كانت الدورة؟', 'How was the course?')}</h3>
      <table className="data" style={{ marginTop: 10 }}>
        <tbody>
          {(Object.keys(COURSE_CRITERION) as CourseCriterion[]).map((criterion) => (
            <tr key={criterion}>
              <th scope="row"><span id={`cc-${criterion}`}>{t(COURSE_CRITERION[criterion])}</span></th>
              <td>
                <StarInput name={criterion} labelledBy={`cc-${criterion}`} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <RatingExtras idPrefix={`course-${courseId}`} />
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل التقييم', 'Send the rating')}
      </button>
    </form>
  );
}
