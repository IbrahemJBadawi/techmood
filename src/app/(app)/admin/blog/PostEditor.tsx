'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { BlogCategory } from '@/lib/database.types';
import { BLOG_CATEGORY } from '@/app/blog/shared';

import { savePost, type PostState } from './actions';

export type EditablePost = {
  id: string; slug: string; title: string; excerpt: string | null; body: string;
  cover_url: string | null; category: BlogCategory; published_at: string | null;
} | null;

/** Writing a post: its address, title, section, cover, summary and text. */
export function PostEditor({ post }: { post: EditablePost }) {
  const t = useT();
  const [state, action, pending] = useActionState(savePost, undefined as PostState);

  return (
    <form action={action} className="panel section-block blog-editor">
      {post && <input type="hidden" name="id" value={post.id} />}
      <div className="field">
        <label htmlFor="post-title">{t('العنوان', 'Title')}</label>
        <input id="post-title" name="title" required minLength={3} maxLength={160} defaultValue={post?.title ?? ''} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="post-slug">{t('الرابط (بالإنجليزية)', 'Address (English)')}</label>
          <input id="post-slug" name="slug" dir="ltr" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80}
                 placeholder="first-cohort-graduates" defaultValue={post?.slug ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="post-category">{t('القسم', 'Section')}</label>
          <select id="post-category" name="category" defaultValue={post?.category ?? 'news'}>
            {Object.entries(BLOG_CATEGORY).map(([key, value]) => <option key={key} value={key}>{t(value.ar, value.en)}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="post-cover">{t('رابط صورة الغلاف (اختياري، https)', 'Cover image link (optional, https)')}</label>
        <input id="post-cover" name="cover_url" type="url" dir="ltr" placeholder="https://" defaultValue={post?.cover_url ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="post-excerpt">{t('ملخص قصير يظهر في القائمة', 'A short summary for the list')}</label>
        <textarea id="post-excerpt" name="excerpt" rows={2} maxLength={300} defaultValue={post?.excerpt ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="post-body">{t('النص', 'Text')}</label>
        <textarea id="post-body" name="body" rows={16} required defaultValue={post?.body ?? ''}
                  placeholder={t('اكتب المقال. ## عنوان فرعي، **غامق**، و- لقائمة.', 'Write the post. ## for a subheading, **bold**, and - for a list.')} />
      </div>
      <label className="sc-switch">
        <input type="checkbox" name="publish" defaultChecked={Boolean(post?.published_at)} />
        <span>{t('منشور — يراه الجميع في المدونة', 'Published — everyone sees it on the blog')}</span>
      </label>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <div className="row-actions">
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ', 'Save')}</button>
      </div>
    </form>
  );
}
