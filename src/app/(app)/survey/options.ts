import type { Text } from '@/lib/i18n';

/** The survey's fixed choices (0164) — the database checks the same keys. */
export const MOST_USED: { key: string; label: Text; icon: string }[] = [
  { key: 'academy',  label: { ar: 'الأكاديمية والدروس', en: 'Academy & lessons' }, icon: '🎓' },
  { key: 'mentors',  label: { ar: 'المنتورز والجلسات', en: 'Mentors & sessions' }, icon: '🧑‍🏫' },
  { key: 'teams',    label: { ar: 'الفرق', en: 'Teams' }, icon: '👥' },
  { key: 'gallery',  label: { ar: 'المعرض', en: 'Gallery' }, icon: '🖼️' },
  { key: 'market',   label: { ar: 'السوق', en: 'Market' }, icon: '🛒' },
  { key: 'messages', label: { ar: 'الرسائل', en: 'Messages' }, icon: '💬' },
  { key: 'ai',       label: { ar: 'المساعد الذكي', en: 'AI assistant' }, icon: '✦' },
  { key: 'profile',  label: { ar: 'ملفي وبطاقتي', en: 'Profile & card' }, icon: '🪪' },
  { key: 'other',    label: { ar: 'شيء آخر', en: 'Something else' }, icon: '•' },
];

export const PAINS: { key: string; label: Text }[] = [
  { key: 'slow',      label: { ar: 'بطء في التحميل', en: 'Slow to load' } },
  { key: 'confusing', label: { ar: 'صعوبة في إيجاد الأشياء', en: 'Hard to find things' } },
  { key: 'mobile',    label: { ar: 'تجربة الهاتف', en: 'The phone experience' } },
  { key: 'content',   label: { ar: 'المحتوى غير كافٍ', en: 'Not enough content' } },
  { key: 'prices',    label: { ar: 'الأسعار', en: 'Prices' } },
  { key: 'mentors',   label: { ar: 'قلة المنتورز', en: 'Too few mentors' } },
  { key: 'bugs',      label: { ar: 'أخطاء وأعطال', en: 'Bugs' } },
  { key: 'language',  label: { ar: 'اللغة والترجمة', en: 'Language' } },
  { key: 'nothing',   label: { ar: 'لا شيء — كل شيء جيد', en: 'Nothing — all good' } },
];

export const EASE_FACES = ['😣', '🙁', '😐', '🙂', '😍'];
