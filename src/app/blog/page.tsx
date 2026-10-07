import Link from 'next/link';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import type { BlogCategory } from '@/lib/database.types';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { BLOG_CATEGORY, readMinutes } from './shared';

export const generateMetadata = localizedTitle('مدونة TechMood', 'TechMood blog', {
  ar: 'أخبار المنصة، قصص الطلاب والفرق، وأدلة عملية للتعلّم والعمل في التقنية.',
  en: 'Platform news, student and team stories, and practical guides to learning and working in tech.',
}, '/blog');

/**
 * The blog as a magazine (design lab 4): the latest post large at the top,
 * the rest as a list under it, filterable by section.
 */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const t = await getT();
  const { c } = await searchParams;
  const category = c && c in BLOG_CATEGORY ? (c as BlogCategory) : null;
  const supabase = await createClient();

  let query = supabase.from('blog_posts')
    .select('id, slug, title, excerpt, body, cover_url, category, published_at')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false }).limit(40);
  if (category) query = query.eq('category', category);
  const { data: posts } = await query;
  const [lead, ...rest] = posts ?? [];
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium' });

  return (
    <>
      <SiteNav />
      <main className="landing blog-page">
        <header className="blog-head">
          <h1>{t('المدونة', 'Blog')}</h1>
          <nav className="tags-row" aria-label={t('أقسام المدونة', 'Blog sections')}>
            <Link className={`chip${!category ? ' is-active' : ''}`} href="/blog">{t('الكل', 'All')}</Link>
            {Object.entries(BLOG_CATEGORY).map(([key, value]) => (
              <Link key={key} className={`chip${category === key ? ' is-active' : ''}`} href={`/blog?c=${key}`}>{t(value.ar, value.en)}</Link>
            ))}
          </nav>
        </header>

        {!lead ? (
          <div className="panel empty-state">
            <h3 style={{ fontSize: '1rem' }}>{t('لا مقالات بعد — قريباً أول مقال', 'No posts yet — the first one is coming')}</h3>
          </div>
        ) : (
          <>
            <Link className="blog-lead" href={`/blog/${lead.slug}`}>
              <span className="blog-cover" style={lead.cover_url ? undefined : { background: BLOG_CATEGORY[lead.category].tone }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {lead.cover_url && <img src={lead.cover_url} alt="" />}
              </span>
              <span className="blog-lead-body">
                <span className="blog-cat">{t(BLOG_CATEGORY[lead.category].ar, BLOG_CATEGORY[lead.category].en)}</span>
                <strong>{lead.title}</strong>
                {lead.excerpt && <span className="muted">{lead.excerpt}</span>}
                <span className="blog-meta">{date.format(new Date(lead.published_at!))} · {t(`${readMinutes(lead.body)} د قراءة`, `${readMinutes(lead.body)} min read`)}</span>
              </span>
            </Link>

            {rest.length > 0 && (
              <ul className="blog-list">
                {rest.map((post) => (
                  <li key={post.id}>
                    <Link href={`/blog/${post.slug}`}>
                      <span className="blog-thumb" style={post.cover_url ? undefined : { background: BLOG_CATEGORY[post.category].tone }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {post.cover_url && <img src={post.cover_url} alt="" loading="lazy" />}
                      </span>
                      <span className="blog-item-body">
                        <span className="blog-cat">{t(BLOG_CATEGORY[post.category].ar, BLOG_CATEGORY[post.category].en)}</span>
                        <strong>{post.title}</strong>
                        <span className="blog-meta">{date.format(new Date(post.published_at!))} · {t(`${readMinutes(post.body)} د`, `${readMinutes(post.body)} min`)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
