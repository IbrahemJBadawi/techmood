import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { ShowcaseGrid, type ShowcaseFilters } from '@/components/showcase/ShowcaseGrid';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

export const generateMetadata = localizedTitle('معرض TechMood', 'TechMood Gallery', {
  ar: 'مشاريع حقيقية بناها أعضاء TechMood وفرقهم: صور، ديمو، روابط، وتقييمات.',
  en: 'Real projects built by TechMood members and teams: pictures, demos, links and ratings.',
});

/**
 * The public gallery (0121). A visitor browses every published project page;
 * a signed-in member is taken to the same gallery inside the app, so they stay
 * in their account.
 */
export default async function ExhibitionPage({ searchParams }: { searchParams: Promise<ShowcaseFilters> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]).toString();
    redirect(`/gallery${query ? `?${query}` : ''}`);
  }
  const t = await getT();

  return (
    <>
      <SiteNav />
      <main className="landing">
        <section style={{ padding: '40px 0 20px', textAlign: 'center' }}>
          <p className="kicker">Gallery</p>
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', marginTop: 10 }}>{t('معرض مشاريع TechMood', 'The TechMood project gallery')}</h1>
          <p className="muted" style={{ marginTop: 12, fontSize: '0.98rem', maxWidth: '62ch', marginInline: 'auto' }}>
            {t('مشاريع بناها أعضاء TechMood وفرقهم. افتح أي مشروع لترى صوره وتجرّب الديمو وتقرأ من بناه — وبعضها متاح للشراء في السوق.',
               'Projects built by TechMood members and teams. Open any one to see its pictures, try the demo and see who built it — some are for sale in the market.')}
          </p>
          <div className="tags-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <Link className="btn btn-primary btn-sm" href="/signup">{t('انضم وأضف مشروعك', 'Join and add your project')}</Link>
            <Link className="btn btn-ghost btn-sm" href="/login?next=/gallery">{t('تسجيل الدخول', 'Sign in')}</Link>
          </div>
        </section>
        <ShowcaseGrid mode="gallery" filters={filters} inApp={false} action="/exhibition" />
      </main>
      <SiteFooter />
    </>
  );
}
