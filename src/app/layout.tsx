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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
