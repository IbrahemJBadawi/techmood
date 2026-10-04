import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { ShowcaseView } from '@/components/showcase/ShowcaseView';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { ShowcasePage } from '@/lib/database.types';
import { mediaUrl } from '@/lib/showcase';

async function load(code: string): Promise<ShowcasePage | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('showcase_project', { p_code: decodeURIComponent(code) });
  return (data?.[0] as ShowcasePage | undefined) ?? null;
}

/** What LinkedIn, WhatsApp and search engines show for a shared link. */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const page = await load((await params).code);
  if (!page) return { title: 'TechMood' };
  const cover = mediaUrl(page.images[0]);
  return {
    title: `${page.title} — TechMood`,
    description: page.tagline ?? undefined,
    openGraph: { title: page.title, description: page.tagline ?? undefined, images: cover ? [cover] : undefined, type: 'website' },
  };
}

/**
 * A project's permanent public link (0121): techmood…/gallery/TMP-XXXXXX — for
 * LinkedIn, a CV or a portfolio. A signed-in member is taken to the same page
 * inside the app, so they stay in their account.
 */
export default async function PublicProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/p/${encodeURIComponent(code)}`);

  const t = await getT();
  const page = await load(code);
  if (!page) notFound();

  return (
    <>
      <SiteNav />
      <main className="landing sc-public">
        <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
          <Link href="/exhibition">{t('المعرض', 'Gallery')}</Link> / <span>{page.title}</span>
        </nav>
        <ShowcaseView page={page} inApp={false} />
      </main>
      <SiteFooter />
    </>
  );
}
