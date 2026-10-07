import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { AiText } from '@/components/AiText';
import { BackLink } from '@/components/BackLink';
import { ShareButton } from '@/components/ShareButton';
import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { BLOG_CATEGORY, readMinutes } from '../shared';

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('blog_posts')
    .select('id, slug, title, excerpt, body, cover_url, category, published_at')
    .eq('slug', slug).not('published_at', 'is', null).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await load((await params).slug);
  if (!post) return { title: 'TechMood' };
  return {
    title: `${post.title} — TechMood`,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.excerpt ?? undefined, images: post.cover_url ? [post.cover_url] : undefined },
  };
}

/** One post: its cover, its text, and the way back to the magazine. */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getT();
  const post = await load((await params).slug);
  if (!post) notFound();
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'long' });

  return (
    <>
      <SiteNav />
      <main className="landing blog-post">
        <BackLink href="/blog" label={t('المدونة', 'Blog')} />
        <span className="blog-cat">{t(BLOG_CATEGORY[post.category].ar, BLOG_CATEGORY[post.category].en)}</span>
        <h1>{post.title}</h1>
        <p className="blog-meta">{date.format(new Date(post.published_at!))} · {t(`${readMinutes(post.body)} دقائق قراءة`, `${readMinutes(post.body)} min read`)}</p>
        <div className="blog-cover is-post" style={post.cover_url ? undefined : { background: BLOG_CATEGORY[post.category].tone }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {post.cover_url && <img src={post.cover_url} alt="" />}
        </div>
        {post.excerpt && <p className="blog-excerpt">{post.excerpt}</p>}
        <article className="blog-body"><AiText text={post.body} /></article>
        <div className="row-actions" style={{ marginTop: 20 }}>
          <ShareButton path={`/blog/${post.slug}`} title={post.title} label={t('شارك المقال', 'Share')} />
          <Link className="btn btn-ghost btn-sm" href="/blog">{t('مقالات أخرى', 'More posts')}</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
