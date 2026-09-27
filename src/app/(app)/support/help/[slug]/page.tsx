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
      <Link className="btn btn-ghost btn-sm" href="/support">{t('→ المساعدة والبلاغات', '← Help & reports')}</Link>
      <article className="panel section-block" style={{ marginTop: 16, maxWidth: 760 }}>
        {article.category && <span className="tag">{t(TICKET_CATEGORY[article.category])}</span>}
        <h2 style={{ fontSize: '1.2rem', marginTop: 8 }}>{t.locale === 'en' && article.title_en ? article.title_en : article.title_ar}</h2>
        <div style={{ fontSize: '0.92rem', marginTop: 12, whiteSpace: 'pre-line', lineHeight: 1.8 }}>{article.body_ar}</div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 16 }}>
          {t('لم يحلّ المقال مشكلتك؟ ', 'Did not solve it? ')}
          <Link href={`/support/new${article.category ? `?category=${article.category}` : ''}`}>{t('افتح بلاغاً', 'Open a ticket')}</Link>
        </p>
      </article>
    </>
  );
}
