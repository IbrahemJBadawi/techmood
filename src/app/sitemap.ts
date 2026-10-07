import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

import { SITE_URL } from '@/lib/contact';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '@/lib/supabase/config';

export const revalidate = 3600;

/**
 * The public pages, on the official domain: the landing and info pages, and
 * every project on show in the gallery (read as a visitor, so only what a
 * visitor may see is listed). Profiles are left out on purpose.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = ['', '/about', '/business', '/blog', '/app', '/exhibition', '/policies', '/verify', '/signup'].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' || path === '/exhibition' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));

  try {
    const visitor = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false } });
    const { data } = await visitor.rpc('gallery_projects', { p_mode: 'gallery', p_limit: 500 });
    // published blog posts (0150)
    const { data: posts } = await visitor.from('blog_posts').select('slug, updated_at').not('published_at', 'is', null).limit(500);
    const blog = (posts ?? []).map((row: { slug: string; updated_at: string }) => ({
      url: `${SITE_URL}/blog/${row.slug}`, lastModified: row.updated_at, changeFrequency: 'monthly' as const, priority: 0.6,
    }));
    const projects = ((data ?? []) as { code: string; gallery_at: string | null }[]).map((row) => ({
      url: `${SITE_URL}/gallery/${row.code}`,
      lastModified: row.gallery_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...fixed, ...blog, ...projects];
  } catch {
    return fixed;
  }
}
