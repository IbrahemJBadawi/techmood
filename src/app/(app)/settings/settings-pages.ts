import type { Text } from '@/lib/i18n';
import type { IconName } from '@/lib/roles';
import { IS_MVP } from '@/lib/scope';

/** The settings sections, in the order the menu and the settings home list them. */
export const SETTINGS_PAGES: { href: string; label: Text; hint: Text; icon: IconName; color: string }[] = ([
  { href: '/settings/profile', label: { ar: 'ملفي المهني', en: 'Professional profile' },
    hint: { ar: 'العنوان والنبذة ومن يرى ماذا', en: 'Headline, bio, and who sees what' }, icon: 'user', color: '#2F6BFF' },
  { href: '/settings/fields', label: { ar: 'المجالات والمهارات', en: 'Fields & skills' },
    hint: { ar: 'مجالك الرئيسي واهتماماتك', en: 'Your main field and interests' }, icon: 'layers', color: '#7C5CFF' },
  { href: '/settings/roles', label: { ar: 'أدواري', en: 'My roles' },
    hint: { ar: 'طالب، منتور، متدرّب — وطلباتك', en: 'Student, mentor, mentee — and your requests' }, icon: 'team', color: '#0E9F6E' },
  { href: '/settings/notifications', label: { ar: 'الإشعارات', en: 'Notifications' },
    hint: { ar: 'ما يصلك على المنصة والبريد والهاتف', en: 'What reaches you in-app, by email and on your phone' }, icon: 'bell', color: '#E8590C' },
  { href: '/settings/ai', label: { ar: 'المساعد الذكي', en: 'AI assistant' },
    hint: { ar: 'تفضيلاته وما يتذكّره عنك', en: 'Its preferences and what it remembers' }, icon: 'assistant', color: '#D6336C' },
  { href: '/settings/freelancer', label: { ar: 'إدراجي في السوق', en: 'My listing' },
    hint: { ar: 'كيف تظهر لمن يبحث عن مستقل', en: 'How you appear to clients' }, icon: 'work', color: '#C77700' },
] as const).filter((page) => !IS_MVP || page.href !== '/settings/freelancer');
