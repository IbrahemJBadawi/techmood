import Link from 'next/link';

import { getT } from '@/lib/i18n.server';

/**
 * The header of the academy: where this learner stands, in three small honest
 * numbers, and the single thing to do next.
 *
 * The numbers are counts of work done — not points. The academy is a place to
 * learn, not a scoreboard.
 */
export async function AcademyHero({
  pathsInProgress,
  pathsCompleted,
  coursesCompleted,
  lessonsCompleted,
  action,
}: {
  pathsInProgress: number;
  pathsCompleted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  action: { href: string; label: string; note: string };
}) {
  const t = await getT();

  return (
    <section className="section-block">
      <div className="panel academy-hero">
        <div className="academy-hero-text">
          <p className="kicker">{t('أكاديمية TechMood', 'TechMood Academy')}</p>
          <h2>{t('تعلّم بمسار، لا بدورة منفردة', 'Learn along a path, not a single course')}</h2>
          <p className="muted">
            {t('كل دورة تُكمَل بمشروع يُراجَع، وكل مسار يُختم بمشروع جماعي. الشهادة تأتي من العمل المعتمد، لا من عدد الدروس المفتوحة.',
               'Every course ends in a project that gets reviewed, and every path ends in a group project. A certificate comes from approved work, not from how many lessons you opened.')}
          </p>
        </div>

        <dl className="academy-hero-stats">
          <div>
            <dt>{t('مسارات قيد التقدّم', 'Paths in progress')}</dt>
            <dd className="eng">{pathsInProgress}</dd>
          </div>
          <div>
            <dt>{t('مسارات مكتملة', 'Paths completed')}</dt>
            <dd className="eng">{pathsCompleted}</dd>
          </div>
          <div>
            <dt>{t('دورات مكتملة', 'Courses completed')}</dt>
            <dd className="eng">{coursesCompleted}</dd>
          </div>
          <div>
            <dt>{t('دروس مكتملة', 'Lessons completed')}</dt>
            <dd className="eng">{lessonsCompleted}</dd>
          </div>
        </dl>

        <div className="academy-hero-action">
          <Link className="btn btn-primary" href={action.href}>{action.label}</Link>
          <p className="muted">{action.note}</p>
        </div>
      </div>
    </section>
  );
}
