import Link from 'next/link';

import { ShowcaseGrid, type ShowcaseFilters } from '@/components/showcase/ShowcaseGrid';
import { getT, localizedTitle } from '@/lib/i18n.server';

export const generateMetadata = localizedTitle('المعرض — TechMood', 'Gallery — TechMood');

/**
 * The gallery inside the app (0121): every member's published project pages,
 * with filters. The public link (/exhibition) shows the same to visitors.
 */
export default async function GalleryPage({ searchParams }: { searchParams: Promise<ShowcaseFilters> }) {
  const t = await getT();
  const filters = await searchParams;
  return (
    <>
      <section className="market-hero section-block">
        <h2>🖼️ {t('معرض المشاريع', 'Project gallery')}</h2>
        <p className="muted">
          {t('أعمال أعضاء TechMood وفرقهم — من الأكاديمية أو خارجها. كل مشروع صفحة كاملة: صور، ديمو، روابط، وتعليقات.',
             'Work by TechMood members and teams — from the academy or beyond. Every project is a full page: pictures, a demo, links and comments.')}
        </p>
        <div className="tags-row" style={{ marginTop: 10 }}>
          <Link className="btn btn-primary btn-sm" href="/projects/new?intent=gallery">{t('+ أضف مشروعك للمعرض', '+ Add your project')}</Link>
          <Link className="btn btn-ghost btn-sm" href="/projects">{t('مشاريعي', 'My projects')}</Link>
          <Link className="btn btn-ghost btn-sm" href="/marketplace">{t('🛒 السوق', '🛒 Market')}</Link>
        </div>
      </section>
      <ShowcaseGrid mode="gallery" filters={filters} inApp action="/gallery"
                    emptyCta={<Link className="btn btn-primary btn-sm" href="/projects/new?intent=gallery">{t('كن أول من يضيف مشروعاً', 'Be the first to add one')}</Link>} />
    </>
  );
}
