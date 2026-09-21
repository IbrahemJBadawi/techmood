'use client';

import { useT } from '@/lib/i18n.client';

import { courseAction, NextBestAction } from './NextBestAction';
import { ProgressIndicator } from './ProgressIndicator';
import { StatusBadge } from './StatusBadge';
import { courseDomains, courseTitle, lessonCount, LEVEL_LABEL, moduleCount, type AcademyCourse } from './types';

/**
 * A course as a card. Its domains are the paths carrying it — a course has no
 * school of its own — and its XP sits last, in small type: the academy shows
 * what you learn, not a score.
 */
export function CourseCard({ course }: { course: AcademyCourse }) {
  const t = useT();
  const domains = courseDomains(t.locale, course);
  const started = course.status !== 'not_started';
  const action = courseAction(course);

  return (
    <article className="card academy-card">
      <div className="row-between academy-card-head">
        <span className="kicker">{LEVEL_LABEL[course.level][t.locale]}</span>
        <StatusBadge status={course.status} />
      </div>

      <h3>{courseTitle(t.locale, course)}</h3>
      {course.description_ar && <p>{course.description_ar}</p>}

      <ul className="academy-meta">
        <li>{lessonCount(t.locale, course.lessons_count)}</li>
        {course.modules_count > 0 && <li>{moduleCount(t.locale, course.modules_count)}</li>}
        {course.estimated_hours && <li className="eng">~{course.estimated_hours}h</li>}
      </ul>

      {domains.length > 0 && (
        <p className="muted academy-domains">
          {t('ضمن: ', 'Part of: ')}{domains.slice(0, 2).join('، ')}
          {domains.length > 2 && t(` +${domains.length - 2}`, ` +${domains.length - 2}`)}
        </p>
      )}

      {started && (
        <ProgressIndicator
          percent={course.percent}
          label={t('تقدّم الدورة', 'Course progress')}
          detail={t(
            `${course.lessons_done} من ${course.lessons_count} دروس`,
            `${course.lessons_done} of ${course.lessons_count} lessons`)}
        />
      )}

      {action
        ? <NextBestAction action={action} />
        : <p className="muted academy-domains">{t('لا يوجد مسار منشور يحمل هذه الدورة بعد.', 'No published path carries this course yet.')}</p>}

      {course.status !== 'completed' && course.xp_award !== null && (
        <p className="muted academy-xp eng">+{course.xp_award} XP {t('عند إتمام الدورة', 'on completion')}</p>
      )}
    </article>
  );
}
