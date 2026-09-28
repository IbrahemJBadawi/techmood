import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { getT } from '@/lib/i18n.server';
import type { IconName } from '@/lib/roles';

import type { Resume } from '../home/student/ContinueLearning';
import { ProgressRing } from './ProgressRing';

/**
 * The top of the academy: the one thing to do next, as large as the page
 * allows — the lesson you stopped at, or the first path to choose — and beside
 * it where you stand, in four small honest counts of work done.
 */
export async function AcademyHero({
  resume,
  pathsInProgress,
  pathsCompleted,
  coursesCompleted,
  lessonsCompleted,
  action,
}: {
  resume: Resume;
  pathsInProgress: number;
  pathsCompleted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  action: { href: string; label: string; note: string };
}) {
  const t = await getT();

  const stats: { icon: IconName; value: number; label: string; tone: string }[] = [
    { icon: 'play', value: lessonsCompleted, label: t('دروس مكتملة', 'Lessons done'), tone: 'xp' },
    { icon: 'layers', value: coursesCompleted, label: t('دورات مكتملة', 'Courses done'), tone: 'royal' },
    { icon: 'arrow', value: pathsInProgress, label: t('مسارات جارية', 'Paths in progress'), tone: 'streak' },
    { icon: 'certificate', value: pathsCompleted, label: t('مسارات مكتملة', 'Paths completed'), tone: 'mentor' },
  ];

  return (
    <section className="section-block ac-hero">
      <div className="ac-resume">
        {resume ? (
          <>
            <div className="ac-resume-top">
              <p className="ac-resume-kicker">{t('أكمل من حيث توقّفت', 'Pick up where you left off')}</p>
              <ProgressRing percent={resume.path_percent} size={58} stroke={6} label={t('تقدّم المسار', 'Path progress')} />
            </div>
            <p className="ac-resume-path">{resume.path_title}</p>
            <h2>{resume.course_title}</h2>
            <p className="ac-resume-lesson"><Icon name="play" size={14} />{resume.lesson_title}</p>
            <div className="ac-resume-bar">
              <div className="ac-resume-track"><div style={{ width: `${resume.course_percent}%` }} /></div>
              <span className="eng">{resume.course_percent}%</span>
            </div>
          </>
        ) : (
          <>
            <p className="ac-resume-kicker">{t('أكاديمية TechMood', 'TechMood Academy')}</p>
            <h2>{t('تعلّم بمسار، لا بدورة منفردة', 'Learn along a path, not a single course')}</h2>
            <p className="ac-resume-lesson">
              {t('كل دورة تنتهي بمشروع يُراجَع، والشهادة تأتي من العمل المعتمد.',
                 'Every course ends in a reviewed project, and a certificate comes from approved work.')}
            </p>
          </>
        )}
        <Link className="btn btn-lg ac-resume-btn" href={action.href}>
          {action.label}
          <Icon name="arrow" size={18} />
        </Link>
      </div>

      <dl className="ac-stats">
        {stats.map((stat) => (
          <div className={`ac-stat tone-${stat.tone}`} key={stat.label}>
            <span className="ac-stat-icon"><Icon name={stat.icon} size={18} /></span>
            <dd className="eng">{stat.value}</dd>
            <dt>{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
