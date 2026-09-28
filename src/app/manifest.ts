import type { MetadataRoute } from 'next';

/**
 * TechMood as an app on a phone's home screen (PWA). Opens full-screen on the
 * home page, right-to-left, in the brand's royal blue.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TechMood',
    short_name: 'TechMood',
    description: 'تعلّم، إرشاد، فرق، عمل وريادة — حساب واحد وهوية مهنية واحدة.',
    id: '/',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#FFFFFF',
    theme_color: '#007BFF',
    icons: [
      { src: '/logo-mark.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
