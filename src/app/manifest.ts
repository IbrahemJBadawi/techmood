import type { MetadataRoute } from 'next';

/**
 * TechMood as an app on a phone's home screen (PWA). Opens full-screen on the
 * home page, right-to-left, in the brand's royal blue.
 *
 * The screenshots give Chrome's richer install sheet (a store-like card with
 * pictures, on Android and desktop); the shortcuts are what a long press on
 * the icon offers. /app is the page that explains installing.
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
    theme_color: '#006BE0',
    categories: ['education', 'productivity'],
    prefer_related_applications: false,
    // A tapped notification or link focuses the app already open, not a second one.
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    icons: [
      { src: '/logo-mark.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'تعلّم', short_name: 'تعلّم', url: '/academy', icons: [{ src: '/logo-mark.png', sizes: '192x192' }] },
      { name: 'الرسائل', short_name: 'الرسائل', url: '/messages', icons: [{ src: '/logo-mark.png', sizes: '192x192' }] },
      { name: 'المنتورز', short_name: 'المنتورز', url: '/mentors', icons: [{ src: '/logo-mark.png', sizes: '192x192' }] },
      { name: 'الإشعارات', short_name: 'الإشعارات', url: '/notifications', icons: [{ src: '/logo-mark.png', sizes: '192x192' }] },
    ],
    screenshots: [
      { src: '/screenshots/home.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'يومك في TechMood: مسارك، مهامك، ونقاطك' },
      { src: '/screenshots/academy.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'الأكاديمية: مسارات ودورات تنتهي بمشروع' },
      { src: '/screenshots/mentors.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'منتورز تحجز معهم جلسات فردية' },
      { src: '/screenshots/messages.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'رسائل مع المنتورز والفرق' },
      { src: '/screenshots/wide.webp', sizes: '1280x800', type: 'image/webp', form_factor: 'wide', label: 'TechMood على الكمبيوتر' },
    ],
  };
}
