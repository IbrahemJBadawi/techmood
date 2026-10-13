/**
 * TechMood's addresses (0157), each with one job:
 *   - support: help with an account, a payment, a session — what members write to;
 *   - contact: official contact — companies, partnerships, legal and privacy;
 *   - noreply: the sender of automatic emails and notifications (set in the
 *     `email_from` setting; replies to it go to support).
 */
export const SUPPORT_EMAIL = 'support@techmoodtech.com';
export const CONTACT_EMAIL = 'contact@techmoodtech.com';

/**
 * The official address. Canonical links, link previews, robots.txt and the
 * sitemap name it, whichever host (www, vercel.app) a page was served from.
 * Sign-in links are not built from it: they follow the host the visitor is on
 * (src/lib/site.ts), so a session is never started on one host and finished
 * on another.
 */
// techmoodtech.com is on hold at the registrar; until it is back, the Vercel
// address is the official one (migration 0142 does the same in the database).
export const SITE_URL = 'https://techmoodtech.vercel.app';

/** TechMood's own accounts — one handle everywhere. */
export const SOCIAL_HANDLE = '@techmoodtech';

export const SOCIAL_LINKS = [
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/techmoodtech' },
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/techmoodtech' },
  { key: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@techmoodtech' },
  { key: 'telegram', label: 'Telegram', href: 'https://t.me/techmoodtech' },
] as const;

export type SocialKey = (typeof SOCIAL_LINKS)[number]['key'];
