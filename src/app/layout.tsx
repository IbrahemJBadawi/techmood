import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from 'next/font/google';

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

export const metadata: Metadata = {
  title: 'TechMood Technology',
  description:
    'منصة واحدة تربط التعلّم، الإرشاد، الفرق، العمل، وريادة الأعمال — حساب واحد وهوية مهنية واحدة.',
};

/**
 * Applied before the first paint so a person who chose the dark theme never
 * sees a white flash on the way in. It only reads what the toggle wrote, and
 * does nothing at all when storage is unavailable — the stylesheet then falls
 * back to the operating system's preference on its own.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('tm-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
