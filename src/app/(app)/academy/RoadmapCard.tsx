'use client';

import { contentText } from '@/lib/i18n';
import { useT } from '@/lib/i18n.client';

import type { AcademyRoadmapPath } from './types';

const OUTLINE_SHOWN = 4;

function outline(locale: 'ar' | 'en', ar: string[], en: string[]) {
  return ar.map((title, index) => contentText(locale, title, en[index] ?? null));
}

/**
 * A path the academy has announced and not written yet.
 *
 * It shows exactly what it is — the depth it will teach and the breadth it
 * will cover — and it carries no button, because there is nothing behind it
 * to open. A card that promised a lesson it does not have would be the fake
 * screen the academy is built to avoid.
 */
export function RoadmapCard({ path }: { path: AcademyRoadmapPath }) {
  const t = useT();
  const deep = outline(t.locale, path.deep_titles_ar, path.deep_titles_en);
  const breadth = outline(t.locale, path.exposure_titles_ar, path.exposure_titles_en);

  return (
    <article className="card academy-card academy-planned">
      <div className="row-between academy-card-head">
        <span className="kicker">
          {path.school_name_ar
            ? contentText(t.locale, path.school_name_ar, path.school_name_en)
            : t('مسار', 'Path')}
        </span>
        <span className="tag">{t('قريباً', 'Coming soon')}</span>
      </div>

      <h3>{contentText(t.locale, path.title_ar, path.title_en)}</h3>
      {path.description_ar && <p>{path.description_ar}</p>}

      {deep.length > 0 && (
        <div className="academy-outline">
          <p className="academy-outline-label">{t('يُدرَّس بعمق', 'Taught in depth')}</p>
          <p>{deep.slice(0, OUTLINE_SHOWN).join('، ')}
            {deep.length > OUTLINE_SHOWN && ` +${deep.length - OUTLINE_SHOWN}`}</p>
        </div>
      )}
      {breadth.length > 0 && (
        <div className="academy-outline">
          <p className="academy-outline-label">{t('ويُتعرَّف عليه', 'Covered by exposure')}</p>
          <p>{breadth.slice(0, OUTLINE_SHOWN).join('، ')}
            {breadth.length > OUTLINE_SHOWN && ` +${breadth.length - OUTLINE_SHOWN}`}</p>
        </div>
      )}
    </article>
  );
}
