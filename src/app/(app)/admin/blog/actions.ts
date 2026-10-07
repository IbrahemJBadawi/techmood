'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import type { BlogCategory } from '@/lib/database.types';

export type PostState = { error?: string } | undefined;

/** Save a post, and publish or unpublish it in the same step (0150). */
export async function savePost(_prev: PostState, formData: FormData): Promise<PostState> {
  const t = await getT();
  const supabase = await createClient();
  const value = (key: string) => String(formData.get(key) ?? '').trim();
  const { data: id, error } = await supabase.rpc('save_blog_post', {
    p_id: value('id') || null,
    p_slug: value('slug'),
    p_title: value('title'),
    p_excerpt: value('excerpt') || null,
    p_body: String(formData.get('body') ?? ''),
    p_cover_url: value('cover_url') || null,
    p_category: (value('category') || 'news') as BlogCategory,
    p_publish: formData.get('publish') === 'on',
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/blog');
  revalidatePath(`/blog/${value('slug')}`);
  revalidatePath('/admin/blog');
  redirect(`/admin/blog/${id}?saved=1`);
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('delete_blog_post', { p_id: String(formData.get('id') ?? '') });
  revalidatePath('/blog');
  redirect('/admin/blog');
}
