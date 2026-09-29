import type { NotificationKind, NotifyPriority } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/**
 * How the platform speaks about its own notifications.
 *
 * The categories are the same twelve the database holds — this is only their
 * wording and their icon. A notification's text itself is written in Arabic by
 * whichever part of the platform raised it and is never translated here: it
 * often quotes somebody's own words back to them.
 */
export const NOTIFICATION_KIND: Record<NotificationKind, { label: Text; icon: string }> = {
  academy:     { label: { ar: 'الأكاديمية',      en: 'Academy' },        icon: '🎓' },
  evaluation:  { label: { ar: 'تقييم الأعمال',    en: 'Evaluations' },    icon: '📝' },
  booking:     { label: { ar: 'الجلسات',          en: 'Sessions' },       icon: '🗓️' },
  team:        { label: { ar: 'الفرق',            en: 'Teams' },          icon: '👥' },
  work:        { label: { ar: 'السوق والعمل',     en: 'Work' },           icon: '💼' },
  project:     { label: { ar: 'المشاريع والمعرض', en: 'Projects' },       icon: '🏆' },
  message:     { label: { ar: 'الرسائل',          en: 'Messages' },       icon: '💬' },
  certificate: { label: { ar: 'الشهادات',         en: 'Certificates' },   icon: '📜' },
  payment:     { label: { ar: 'المال',            en: 'Money' },          icon: '💳' },
  role_review: { label: { ar: 'الأدوار',          en: 'Roles' },          icon: '🪪' },
  security:    { label: { ar: 'الأمان والحساب',   en: 'Account' },        icon: '🛡️' },
  system:      { label: { ar: 'إعلانات المنصة',   en: 'Announcements' },  icon: '📣' },
  support:     { label: { ar: 'الدعم والبلاغات',  en: 'Support' },        icon: '🛟' },
  reminder:    { label: { ar: 'التذكيرات اليومية', en: 'Daily reminders' }, icon: '🔔' },
};

/**
 * The look of a kind, never undefined: a kind added to the database before
 * this file (a new enum value) still renders, as a plain bell, instead of
 * crashing the page that lists it.
 */
export function kindLook(kind: string): { label: Text; icon: string } {
  return NOTIFICATION_KIND[kind as NotificationKind] ?? { label: { ar: 'إشعار', en: 'Notification' }, icon: '🔔' };
}

/**
 * Priority is not decoration: it is how the engine decided the message should
 * travel, and it is worth showing so a reader can tell a receipt from a warning.
 */
export const PRIORITY: Record<NotifyPriority, { label: Text; className: string }> = {
  critical:  { label: { ar: 'حرِج',   en: 'Critical' },  className: 'status-danger' },
  important: { label: { ar: 'مهم',    en: 'Important' }, className: 'status-pending' },
  normal:    { label: { ar: 'عادي',   en: 'Normal' },    className: 'status-muted' },
  info:      { label: { ar: 'للعلم',  en: 'For info' },  className: 'status-muted' },
};

/** Every kind, in the order the notifications page offers them as filters. */
export const NOTIFICATION_ORDER: NotificationKind[] = [
  'academy', 'evaluation', 'booking', 'team', 'work', 'project',
  'message', 'certificate', 'payment', 'role_review', 'security', 'system',
  'support', 'reminder',
];

/** The kinds an admin may send an announcement as (not support replies or the daily reminders). */
export const BROADCAST_KINDS: NotificationKind[] = NOTIFICATION_ORDER.filter((kind) => kind !== 'support' && kind !== 'reminder');
