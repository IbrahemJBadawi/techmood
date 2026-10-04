import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ShowcaseView } from '@/components/showcase/ShowcaseView';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { ShowcasePage } from '@/lib/database.types';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('showcase_project', { p_code: decodeURIComponent((await params).code) });
  return { title: data?.[0] ? `${data[0].title} — TechMood` : 'TechMood' };
}

/** A project page inside the app (0121): the same page as the public link, in the member's shell. */
export default async function InAppProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('showcase_project', { p_code: decodeURIComponent(code) });
  const page = (data?.[0] as ShowcasePage | undefined) ?? null;
  if (!page) notFound();

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/gallery">{t('المعرض', 'Gallery')}</Link> · <Link href="/marketplace">{t('السوق', 'Market')}</Link> / <span>{page.title}</span>
      </nav>
      <ShowcaseView page={page} inApp />
    </>
  );
}
