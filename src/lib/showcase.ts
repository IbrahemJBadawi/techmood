import type { ProductType, SaleLicence } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';
import { SUPABASE_URL } from '@/lib/supabase/config';

/**
 * The project showcase (0121): one page per project, shown in the gallery,
 * sold in the market, or both. The database decides what is allowed; this is
 * how it reads.
 */

/** Must match projects_category_known in 0121. */
export const CATEGORIES: Record<string, Text> = {
  web:     { ar: 'مواقع وتطبيقات ويب', en: 'Web' },
  mobile:  { ar: 'تطبيقات جوال',       en: 'Mobile' },
  design:  { ar: 'تصميم وواجهات',      en: 'Design & UI' },
  data_ai: { ar: 'بيانات وذكاء اصطناعي', en: 'Data & AI' },
  backend: { ar: 'أنظمة خلفية وAPI',    en: 'Backend & APIs' },
  game:    { ar: 'ألعاب',              en: 'Games' },
  desktop: { ar: 'برامج سطح المكتب',   en: 'Desktop' },
  other:   { ar: 'أخرى',               en: 'Other' },
};

export const PRODUCT_TYPES: Record<ProductType, Text> = {
  full_project:    { ar: 'مشروع كامل',   en: 'Full project' },
  template:        { ar: 'قالب',         en: 'Template' },
  design:          { ar: 'تصميم',        en: 'Design' },
  code:            { ar: 'كود',          en: 'Code' },
  file:            { ar: 'ملف',          en: 'File' },
  digital_service: { ar: 'خدمة رقمية',   en: 'Digital service' },
};

/** Must match the kinds guard_project_showcase() keeps. */
export const LINK_KINDS: Record<string, Text> = {
  github:   { ar: 'GitHub',   en: 'GitHub' },
  behance:  { ar: 'Behance',  en: 'Behance' },
  figma:    { ar: 'Figma',    en: 'Figma' },
  website:  { ar: 'الموقع',   en: 'Website' },
  drive:    { ar: 'الملفات',  en: 'Files' },
  dribbble: { ar: 'Dribbble', en: 'Dribbble' },
  linkedin: { ar: 'LinkedIn', en: 'LinkedIn' },
  youtube:  { ar: 'YouTube',  en: 'YouTube' },
  other:    { ar: 'رابط',     en: 'Link' },
};

export const LICENCE: Record<SaleLicence, Text> = {
  usage_rights:  { ar: 'حق استخدام', en: 'Usage rights' },
  full_transfer: { ar: 'نقل كامل',   en: 'Full transfer' },
};

/** A screenshot's public address. Paths are "<project id>/<file>" (0121). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/project-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** A YouTube or Vimeo link as an embeddable player address; null for anything else. */
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
  } catch {
    return null;
  }
  return null;
}

/** The public, shareable address of a project page. */
export const galleryPath = (code: string) => `/gallery/${code}`;

/**
 * A member's profile: inside the app for a signed-in member (/m/…, in the app's
 * shell), the public card otherwise (/u/…). Both show the same profile.
 */
export const memberHref = (techmoodId: string, inApp: boolean) => (inApp ? `/m/${techmoodId}` : `/u/${techmoodId}`);
