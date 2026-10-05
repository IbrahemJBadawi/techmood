import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/contact';

/** Search engines: the public pages, on the official domain; nothing behind sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/about', '/exhibition', '/gallery/', '/u/', '/verify', '/policies'],
      disallow: ['/auth/', '/onboarding', '/admin', '/home', '/settings', '/messages', '/wallet', '/bookings', '/api/'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
