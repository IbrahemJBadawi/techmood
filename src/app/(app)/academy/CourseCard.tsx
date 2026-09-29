'use client';

import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n.client';

import { courseAction, NextBestAction } from './NextBestAction';
import { StatusBadge } from './StatusBadge';
import { schoolLook } from './schools';
import { courseDomains, courseTitle, lessonCount, LEVEL_LABEL, type AcademyCourse } from './types';

/**
 * A course as a card. Its colour is the school of the first path carrying it
 * — a course has no school of its own — and its XP sits last, in small type:
 * the academy shows what you learn, not a score.
 */
export function CourseCard({ course }: { course: AcademyCourse }) {
  const t = useT();
  const domains = courseDomains(t.locale, course);
  const started = course.status !== 'not_started';
  const action = courseAction(course);
  const look = schoolLook(course.school_slugs[0]);

  return (
    <article className="lcard lcard-course" style={{ '--hue': look.color } as React.CSSProperties}>
      <div className="lcard-cover">
        <span className="lcard-icon"><Icon name={look.icon} size={20} /></span>
        <span className="lcard-school">{LEVEL_LABEL[course.level][t.locale]}</span>
        <StatusBadge status={course.status} />
      </div>

      <div className="lcard-body">
        <h3>{courseTitle(t.locale, course)}</h3>
        {course.author_name && (
          <p className="lcard-author"><Icon name="mentor" size={13} />{t('من إعداد المنتور ', 'By mentor ')}{course.author_name}</p>
        )}
        {course.description_ar && <p className="lcard-desc">{course.description_ar}</p>}

        <ul className="lcard-meta">
          <li><Icon name="play" size={14} />{lessonCount(t.locale, course.lessons_count)}</li>
          {course.estimated_hours && <li><Icon name="clock" size={14} /><span className="eng">~{course.estimated_hours}h</span></li>}
          {course.status !== 'completed' && course.xp_award !== null && (
            <li className="lcard-xp"><span className="eng">+{course.xp_award} XP</span></li>
          )}
        </ul>

        {domains.length > 0 && (
          <p className="lcard-part">
            {t('ضمن: ', 'Part of: ')}{domains.slice(0, 2).join('، ')}
            {domains.length > 2 && ` +${domains.length - 2}`}
          </p>
        )}

        {started && (
          <div className="lcard-bar" role="progressbar" aria-label={t('تقدّم الدورة', 'Course progress')}
               aria-valuenow={course.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${course.percent}%` }} /></div>
            <span className="eng">{course.lessons_done}/{course.lessons_count}</span>
          </div>
        )}
      </div>

      <div className="lcard-foot">
        {action
          ? <NextBestAction action={action} />
          : <p className="lcard-part">{t('لا يوجد مسار منشور يحمل هذه الدورة بعد.', 'No published path carries this course yet.')}</p>}
      </div>
    </article>
  );
}
