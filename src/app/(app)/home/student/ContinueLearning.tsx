import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

export type Resume = {
  path_slug: string;
  path_title: string;
  course_slug: string;
  course_title: string;
  lesson_title: string;
  path_percent: number;
  course_percent: number;
  last_activity: string;
} | null;

export async function ContinueLearning({ resume }: { resume: Resume }) {
  const t = await getT();

  if (!resume) {
    return (
      <article className="panel resume-card is-empty">
        <h3>{t('ابدأ أول مسار', 'Start your first path')}</h3>
        <p className="muted">
          {t('لم تبدأ التعلّم بعد. المسارات مفتوحة دائماً — لا دفعات ولا انتظار.', 'You have not started yet. Paths are always open — no cohorts, nothing to wait for.')}
        </p>
        <Link className="btn btn-primary btn-sm" href="/academy">{t('تصفّح المسارات', 'Browse paths')}</Link>
      </article>
    );
  }

  return (
    <article className="panel resume-card">
      <p className="kicker">{t('أكمل من حيث توقّفت', 'Pick up where you left off')}</p>
      <h3>{resume.path_title}</h3>
      <p className="resume-course">{resume.course_title}</p>
      <p className="resume-lesson">{resume.lesson_title}</p>

      <div className="resume-bars">
        <div>
          <div className="row-between">
            <span className="muted">{t('تقدّم الدورة', 'Course progress')}</span>
            <span className="eng">{resume.course_percent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${resume.course_percent}%` }} />
          </div>
        </div>
        <div>
          <div className="row-between">
            <span className="muted">{t('تقدّم المسار', 'Path progress')}</span>
            <span className="eng">{resume.path_percent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${resume.path_percent}%` }} />
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.78rem' }}>
        {t('آخر نشاط: ', 'Last activity: ')}{formatDate(t.locale, resume.last_activity)}
      </p>

      <Link className="btn btn-primary" href={`/academy/${resume.path_slug}/${resume.course_slug}`}>
        {t('▶ تابع التعلّم', '▶ Continue learning')}
      </Link>
    </article>
  );
}
