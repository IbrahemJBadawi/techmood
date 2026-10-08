import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { getT } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import { LEARNING_GOALS, recommendedPath } from '@/lib/goals';
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
    // The goal named at onboarding (0156) points at the path to start with.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: me }, { data: published }] = await Promise.all([
      supabase.from('profiles').select('learning_goal').eq('id', user?.id ?? '').maybeSingle(),
      supabase.from('learning_paths').select('slug, title_ar, title_en').eq('status', 'published'),
    ]);
    const goal = LEARNING_GOALS.find((item) => item.key === me?.learning_goal);
    const pick = recommendedPath(me?.learning_goal, published ?? []);
    return (
      <article className="hm-resume is-empty">
        <div className="hm-resume-body">
          <p className="hm-resume-kicker">
            {goal ? <>{goal.icon} {t('لهدفك: ', 'For your goal: ')}{t(goal.label)}</> : t('ابدأ من هنا', 'Start here')}
          </p>
          <h2>{pick ? (t.locale === 'ar' ? pick.title_ar : (pick.title_en ?? pick.title_ar)) : t('ابدأ أول مسار', 'Start your first path')}</h2>
          <p className="hm-resume-lesson">
            {pick ? t('هذا المسار المقترح لك — ابدأ أول درس الآن.', 'The path suggested for you — start its first lesson now.')
              : t('المسارات مفتوحة دائماً — لا دفعات ولا انتظار.', 'Paths are always open — no cohorts, nothing to wait for.')}
          </p>
          <div className="row-actions">
            <Link className="btn hm-resume-cta" href={pick ? `/academy/${pick.slug}` : '/academy'}>
              {pick ? t('ابدأ هذا المسار', 'Start this path') : t('تصفّح المسارات', 'Browse paths')}
            </Link>
            {pick && <Link className="btn btn-ghost btn-sm hm-resume-alt" href="/academy">{t('مسارات أخرى', 'Other paths')}</Link>}
          </div>
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
