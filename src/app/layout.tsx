import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@/components/Analytics';
import { Analytics as VercelAnalytics } from '@vercel/analytics/next';

import { DeviceBoot } from '@/components/DeviceSetup';
import { OfflineStatus } from '@/components/OfflineStatus';
import { SnackbarHost } from '@/components/Snackbar';
import { ConfettiHost } from '@/components/Confetti';
import { LocaleProvider } from '@/lib/i18n.client';
import { dirFor } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n.server';
import { SITE_URL } from '@/lib/contact';

import './globals.css';

const sans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * Metadata is generated per request so the description follows the reader's
 * language; the product name does not translate.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const description = t(
    'منصة واحدة تربط التعلّم، الإرشاد، الفرق، العمل، وريادة الأعمال — حساب واحد وهوية مهنية واحدة.',
    'One platform connecting learning, mentoring, teams, work and entrepreneurship — one account, one professional identity.',
  );

  return {
    // Relative links in metadata (previews, canonicals) resolve against the
    // official domain, not whichever host served the page.
    metadataBase: new URL(SITE_URL),
    title: 'TechMood Technology',
    description,
    // app/icon.png and app/apple-icon.png are picked up on their own; this is
    // the mark a link preview shows.
    openGraph: { title: 'TechMood Technology', description, images: ['/logo.png'], siteName: 'TechMood', type: 'website' },
    // «Add to Home Screen» on iPhone opens TechMood as its own app (no Safari
    // bar), on every iOS version — not as a bookmark to the website.
    appleWebApp: { capable: true, title: 'TechMood', statusBarStyle: 'default' },
  };
}

/** The browser chrome around TechMood when it runs as an installed app. */
export const viewport: Viewport = {
  themeColor: '#006BE0',
};

/**
 * Applied before the first paint so a person who chose the dark theme never
 * sees a white flash on the way in. It only reads what the toggle wrote, and
 * does nothing at all when storage is unavailable — the stylesheet then falls
 * back to the operating system's preference on its own.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('tm-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The direction is decided on the server, so the first frame is already laid
  // out the right way round. Every rule in the stylesheet is written with
  // logical properties, so nothing below needs a second, mirrored copy.
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>
        <LocaleProvider locale={locale}>
          {/* On every page — the landing page and sign-in included — so the
              browser sees an installable app wherever a person installs from,
              and offers «Install app» rather than a shortcut. */}
          <DeviceBoot />
          <Analytics />
          <VercelAnalytics />
          <OfflineStatus />
          {children}
          <SnackbarHost />
          <ConfettiHost />
        </LocaleProvider>
      </body>
    </html>
  );
}
