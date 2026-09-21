'use client';

import { useT } from '@/lib/i18n.client';

import { NextBestAction, pathAction } from './NextBestAction';
import { ProgressIndicator } from './ProgressIndicator';
import { StatusBadge } from './StatusBadge';
import { courseCount, levelRange, pathTitle, type AcademyPath } from './types';

/**
 * A path as a card: what it is, which school it belongs to, how far it reaches,
 * how much of it is behind you, and the single next thing to do about it.
 */
export function PathCard({ path }: { path: AcademyPath }) {
  const t = useT();
  const range = levelRange(t.locale, path.level_from, path.level_to);
  const started = path.status !== 'not_started';

  return (
    <article className="card academy-card">
      <div className="row-between academy-card-head">
        <span className="kicker">
          {path.school_name_ar
            ? (t.locale === 'ar' ? path.school_name_ar : (path.school_name_en ?? path.school_name_ar))
            : t('مسار', 'Path')}
        </span>
        <StatusBadge status={path.status} />
      </div>

      <h3>{pathTitle(t.locale, path)}</h3>
      {path.description_ar && <p>{path.description_ar}</p>}

      <ul className="academy-meta">
        {range && <li>{t('المستوى: ', 'Level: ')}{range}</li>}
        <li>{courseCount(t.locale, path.courses_total)}</li>
        {path.estimated_hours && <li className="eng">~{path.estimated_hours}h</li>}
      </ul>

      {path.tags?.length > 0 && (
        <div className="tags-row">
          {path.tags.slice(0, 4).map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
        </div>
      )}

      {started && (
        <ProgressIndicator
          percent={path.percent}
          label={t('تقدّم المسار', 'Path progress')}
          detail={t(
            `${path.courses_done} من ${path.courses_total} دورات مكتملة`,
            `${path.courses_done} of ${path.courses_total} courses complete`)}
        />
      )}

      <NextBestAction action={pathAction(path)} />
    </article>
  );
}
