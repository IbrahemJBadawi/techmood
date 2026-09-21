import Link from 'next/link';

import { contentText } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n.server';

import { pathCount, pathTitle, type AcademyPath, type AcademyRoadmapPath } from './types';

/**
 * The whole academy on one screen: eight schools, fifty paths, and which of
 * them you can start today.
 *
 * A learner deciding where to spend a year should be able to see the map
 * before choosing a step on it. Each school opens to its own paths — the live
 * ones as links, the announced ones as names — so the page stays short until
 * somebody asks for more.
 */
export async function AcademyMap({
  schools,
  paths,
  roadmap,
}: {
  schools: { slug: string; name_ar: string; name_en: string | null }[];
  paths: AcademyPath[];
  roadmap: AcademyRoadmapPath[];
}) {
  const t = await getT();
  const locale = await getLocale();

  return (
    <section className="section-block" aria-labelledby="academy-map">
      <h2 id="academy-map" className="academy-heading">{t('خريطة الأكاديمية', 'The academy map')}</h2>
      <p className="muted academy-why">
        {t('ثماني مدارس وخمسون مساراً. ما هو مفتوح الآن يمكنك فتحه، وما هو قادم مكتوب كما سيُدرَّس — بلا دروس وهمية.',
           'Eight schools, fifty paths. What is open you can open; what is coming is written as it will be taught — with no invented lessons.')}
      </p>

      <div className="stack">
        {schools.map((school) => {
          const live = paths.filter((path) => path.school_slug === school.slug);
          const planned = roadmap.filter((path) => path.school_slug === school.slug);
          if (live.length === 0 && planned.length === 0) return null;

          return (
            <details className="panel academy-school" key={school.slug}>
              <summary>
                <span className="academy-school-name">{contentText(locale, school.name_ar, school.name_en)}</span>
                <span className="muted academy-school-count">
                  {live.length > 0 && t(`${pathCount(locale, live.length)} متاحة`, `${pathCount(locale, live.length)} open`)}
                  {live.length > 0 && planned.length > 0 && ' · '}
                  {planned.length > 0 && t(`${planned.length} قادمة`, `${planned.length} coming`)}
                </span>
              </summary>

              <ul className="academy-school-list">
                {live.map((path) => (
                  <li key={path.id}>
                    <Link href={`/academy/${path.slug}`}>{pathTitle(locale, path)}</Link>
                  </li>
                ))}
                {planned.map((path) => (
                  <li className="muted" key={path.id}>
                    {contentText(locale, path.title_ar, path.title_en)}
                    <span className="tag academy-soon">{t('قريباً', 'Coming soon')}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
