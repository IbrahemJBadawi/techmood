import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { ProgressRing } from '../../academy/ProgressRing';

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

/**
 * The one thing to press on the home page. It names the next lesson, shows
 * how far the course has come, and sends you straight back in.
 */
export async function ContinueLearning({ resume }: { resume: Resume }) {
  const t = await getT();

  if (!resume) {
    return (
      <article className="hm-resume is-empty">
        <div className="hm-resume-body">
          <p className="hm-resume-kicker">{t('ابدأ من هنا', 'Start here')}</p>
          <h2>{t('ابدأ أول مسار', 'Start your first path')}</h2>
          <p className="hm-resume-lesson">
            {t('المسارات مفتوحة دائماً — لا دفعات ولا انتظار.', 'Paths are always open — no cohorts, nothing to wait for.')}
          </p>
          <Link className="btn hm-resume-cta" href="/academy">
            {t('تصفّح المسارات', 'Browse paths')}
          </Link>
        </div>
        <span className="hm-resume-art" aria-hidden="true"><Icon name="academy" size={56} /></span>
      </article>
    );
  }

  return (
    <article className="hm-resume">
      <div className="hm-resume-body">
        <p className="hm-resume-kicker">{t('أكمل من حيث توقّفت', 'Pick up where you left off')} · {resume.path_title}</p>
        <h2>{resume.course_title}</h2>
        <p className="hm-resume-lesson">
          <Icon name="play" size={14} /> {t('الدرس التالي: ', 'Next lesson: ')}{resume.lesson_title}
        </p>

        <div className="hm-resume-path">
          <div className="hm-resume-track"><span style={{ width: `${resume.path_percent}%` }} /></div>
          <span>{t('المسار ', 'Path ')}<bdi dir="ltr">{resume.path_percent}%</bdi></span>
        </div>

        <div className="hm-resume-foot">
          <Link className="btn hm-resume-cta" href={`/academy/${resume.path_slug}/${resume.course_slug}`}>
            {t('تابع التعلّم', 'Continue learning')}
          </Link>
          <span className="hm-resume-when">
            {t('آخر نشاط ', 'Last active ')}<span className="date">{formatDate(t.locale, resume.last_activity)}</span>
          </span>
        </div>
      </div>
      <ProgressRing percent={resume.course_percent} size={96} stroke={9} label={t('تقدّم الدورة', 'Course progress')} />
    </article>
  );
}
