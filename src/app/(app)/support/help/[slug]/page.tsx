import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_CATEGORY } from '@/lib/support';

/** One help article. Only published articles are readable (0087). */
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: article } = await supabase.from('kb_articles')
    .select('slug, category, title_ar, title_en, body_ar, status, updated_at')
    .eq('slug', slug).maybeSingle();
  if (!article || article.status !== 'published') notFound();

  return (
    <>
      <div className="sp-page">
      <Link className="sp-back" href="/support">{t('→ المساعدة والبلاغات', '← Help & reports')}</Link>
      <article className="hm-card sp-article section-block">
        {article.category && <span className="tag">{t(TICKET_CATEGORY[article.category])}</span>}
        <h1>{t.locale === 'en' && article.title_en ? article.title_en : article.title_ar}</h1>
        <div className="sp-article-body">{article.body_ar}</div>
        <div className="sp-article-foot">
          <span>{t('لم يحلّ المقال مشكلتك؟', 'Did not solve it?')}</span>
          <Link className="btn btn-primary btn-sm" href={`/support/new${article.category ? `?category=${article.category}` : ''}`}>{t('بلّغ عن مشكلة', 'Report a problem')}</Link>
        </div>
      </article>
      </div>
    </>
  );
}
