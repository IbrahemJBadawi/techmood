'use client';

import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n.client';

import { NextBestAction, pathAction } from './NextBestAction';
import { ProgressRing } from './ProgressRing';
import { StatusBadge } from './StatusBadge';
import { schoolLook } from './schools';
import { courseCount, levelRange, pathTitle, type AcademyPath } from './types';

/**
 * A path as a card: its school's colour and icon on top, what it is, how far
 * it reaches, how much of it is behind you, and the single next thing to do.
 */
export function PathCard({ path }: { path: AcademyPath }) {
  const t = useT();
  const range = levelRange(t.locale, path.level_from, path.level_to);
  const started = path.status !== 'not_started';
  const look = schoolLook(path.school_slug);
  // what the path gives (0156): its hours, its projects, the skills it builds
  const hours = path.hours_total ?? path.estimated_hours;
  const projects = path.projects_total ?? 0;
  const skills = path.skills ?? path.tags ?? [];
  const school = path.school_name_ar
    ? (t.locale === 'ar' ? path.school_name_ar : (path.school_name_en ?? path.school_name_ar))
    : t('مسار', 'Path');

  return (
    <article className="lcard" style={{ '--hue': look.color } as React.CSSProperties}>
      <div className="lcard-cover">
        <span className="lcard-icon"><Icon name={look.icon} size={22} /></span>
        <span className="lcard-school">{school}</span>
        <StatusBadge status={path.status} />
      </div>

      <div className="lcard-body">
        <div className="lcard-title-row">
          <h3>{pathTitle(t.locale, path)}</h3>
          {started && <ProgressRing percent={path.percent} size={46} label={t('تقدّم المسار', 'Path progress')} />}
        </div>
        {path.author_name && (
          <p className="lcard-author"><Icon name="mentor" size={13} />{t('من إعداد المنتور ', 'By mentor ')}{path.author_name}</p>
        )}
        {path.description_ar && <p className="lcard-desc">{path.description_ar}</p>}

        <ul className="lcard-meta">
          <li><Icon name="layers" size={14} />{courseCount(t.locale, path.courses_total)}</li>
          {hours ? <li><Icon name="clock" size={14} />{t(`~${hours} ساعة`, `~${hours} h`)}</li> : null}
          {projects > 0 && <li><Icon name="work" size={14} />{t(projects === 1 ? 'مشروع واحد' : projects === 2 ? 'مشروعان' : `${projects} مشاريع`, `${projects} project${projects === 1 ? '' : 's'}`)}</li>}
          {range && <li><Icon name="chart" size={14} />{range}</li>}
        </ul>
        {skills.length > 0 && (
          <ul className="lcard-skills" aria-label={t('المهارات التي تكتسبها', 'Skills you gain')}>
            {skills.slice(0, 4).map((skill) => <li key={skill} className="eng">{skill}</li>)}
          </ul>
        )}

        {started && (
          <p className="lcard-progress-note">
            {t(`${path.courses_done} من ${path.courses_total} دورات مكتملة`,
               `${path.courses_done} of ${path.courses_total} courses complete`)}
          </p>
        )}
      </div>

      <div className="lcard-foot">
        <NextBestAction action={pathAction(path)} />
      </div>
    </article>
  );
}
