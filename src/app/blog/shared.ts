import type { BlogCategory } from '@/lib/database.types';

/** The blog's sections (0150), and the colour of a post that has no cover picture. */
export const BLOG_CATEGORY: Record<BlogCategory, { ar: string; en: string; tone: string }> = {
  news:    { ar: 'أخبار TechMood', en: 'News',    tone: 'linear-gradient(135deg, #9DC4FF, #006BE0)' },
  stories: { ar: 'قصص نجاح',       en: 'Stories', tone: 'linear-gradient(135deg, #FFE1B8, #F59E0B)' },
  guides:  { ar: 'أدلة وشروحات',   en: 'Guides',  tone: 'linear-gradient(135deg, #C7F0DB, #16A36A)' },
  careers: { ar: 'مسار مهني',      en: 'Careers', tone: 'linear-gradient(135deg, #E3D8FF, #6D4AE8)' },
};

/** About how long a post takes to read, at 200 words a minute. */
export function readMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}
