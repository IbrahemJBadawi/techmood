import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';
import { BLOG_CATEGORY } from '@/app/blog/shared';

export const generateMetadata = localizedTitle('المدونة — إدارة TechMood', 'Blog — TechMood admin');

/** Every post, published or draft, with the way to write a new one. */
export default async function AdminBlogPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: posts } = await supabase.from('blog_posts')
    .select('id, slug, title, category, published_at, updated_at').order('updated_at', { ascending: false });
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium' });

  return (
    <>
      <section className="section-block row-between">
        <h2 style={{ fontSize: '1.2rem' }}>{t('المدونة', 'Blog')}</h2>
        <div className="row-actions">
          <Link className="btn btn-ghost btn-sm" href="/blog" target="_blank">{t('افتح المدونة', 'Open the blog')}</Link>
          <Link className="btn btn-primary btn-sm" href="/admin/blog/new">＋ {t('مقال جديد', 'New post')}</Link>
        </div>
      </section>
      {(posts ?? []).length === 0 ? (
        <div className="panel empty-state"><h3 style={{ fontSize: '0.98rem' }}>{t('لا مقالات بعد', 'No posts yet')}</h3></div>
      ) : (
        <table className="data">
          <thead><tr><th>{t('المقال', 'Post')}</th><th>{t('القسم', 'Section')}</th><th>{t('الحالة', 'State')}</th><th>{t('آخر تعديل', 'Edited')}</th></tr></thead>
          <tbody>
            {(posts ?? []).map((post) => (
              <tr key={post.id}>
                <td><Link href={`/admin/blog/${post.id}`}>{post.title}</Link></td>
                <td style={{ fontSize: '0.82rem' }}>{t(BLOG_CATEGORY[post.category].ar, BLOG_CATEGORY[post.category].en)}</td>
                <td>{post.published_at
                  ? <span className="status-pill status-ok">{t('منشور', 'Published')}</span>
                  : <span className="status-pill status-muted">{t('مسودة', 'Draft')}</span>}</td>
                <td className="muted" style={{ fontSize: '0.8rem' }}>{date.format(new Date(post.updated_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
