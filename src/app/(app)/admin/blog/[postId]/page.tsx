import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { ConfirmSubmit } from '@/components/ConfirmDialog';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { deletePost } from '../actions';
import { PostEditor } from '../PostEditor';

export const generateMetadata = localizedTitle('مقال — إدارة TechMood', 'Post — TechMood admin');

/** A new post (/admin/blog/new) or an existing one. */
export default async function AdminPostPage({ params, searchParams }: {
  params: Promise<{ postId: string }>; searchParams: Promise<{ saved?: string }>;
}) {
  const t = await getT();
  const { postId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const isNew = postId === 'new';
  const { data: post } = isNew
    ? { data: null }
    : await supabase.from('blog_posts').select('id, slug, title, excerpt, body, cover_url, category, published_at').eq('id', postId).maybeSingle();
  if (!isNew && !post) notFound();

  return (
    <>
      <BackLink href="/admin/blog" label={t('المدونة', 'Blog')} />
      <section className="section-block row-between">
        <h2 style={{ fontSize: '1.2rem' }}>{isNew ? t('مقال جديد', 'New post') : post!.title}</h2>
        {post?.published_at && <Link className="btn btn-ghost btn-sm" href={`/blog/${post.slug}`} target="_blank">{t('اعرضه', 'View')}</Link>}
      </section>
      {saved && <p className="notice notice-ok">{t('حُفظ ✓', 'Saved ✓')}</p>}
      <PostEditor post={post} />
      {post && (
        <form action={deletePost} className="section-block">
          <input type="hidden" name="id" value={post.id} />
          <ConfirmSubmit className="btn btn-ghost btn-sm" message={t('إزالة هذا المقال من المدونة؟ يُخفى ولا يُمحى.', 'Take this post off the blog? It is hidden, not erased.')} confirmLabel={t('أزله', 'Remove')}>
            {t('أزل المقال', 'Remove the post')}
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}
