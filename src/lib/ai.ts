import type { AiPermission, AiScope, AiSurface } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/**
 * How the platform speaks about its own assistant.
 *
 * The vocabulary itself lives in the database — surfaces, scopes, permissions
 * and the action whitelist are enum values and rows, not strings invented here.
 * This file is only the wording and the icons the interface puts on them.
 */

/** The context chip: how wide the person let the assistant look. */
export const SCOPE: Record<AiScope, { label: Text; icon: string }> = {
  page:     { label: { ar: 'الصفحة الحالية', en: 'Current page' },   icon: '📄' },
  course:   { label: { ar: 'الدورة الحالية',  en: 'Current course' }, icon: '🎓' },
  profile:  { label: { ar: 'ملفي',            en: 'My profile' },     icon: '🪪' },
  project:  { label: { ar: 'مشروعي',          en: 'My project' },     icon: '🧩' },
  team:     { label: { ar: 'فريقي',           en: 'My team' },        icon: '👥' },
  startup:  { label: { ar: 'شركتي',           en: 'My company' },     icon: '🏢' },
  platform: { label: { ar: 'TechMood كله',    en: 'All of TechMood' },icon: '✦' },
};

export const SCOPE_ORDER: AiScope[] = [
  'page', 'course', 'profile', 'project', 'team', 'startup', 'platform',
];

/**
 * 👁️ read · ✏️ suggest · ✅ act · 🔒 restricted — what the assistant may do on
 * a surface. The icons are the ones the person already saw in the spec, kept
 * deliberately literal so a permission is never mistaken for a decoration.
 */
export const PERMISSION: Record<AiPermission, { label: Text; icon: string; className: string }> = {
  read:       { label: { ar: 'يقرأ',   en: 'Reads' },      icon: '👁️', className: 'status-muted' },
  suggest:    { label: { ar: 'يقترح',  en: 'Suggests' },   icon: '✏️', className: 'status-pending' },
  act:        { label: { ar: 'ينفّذ',   en: 'Acts' },       icon: '✅', className: 'status-ok' },
  restricted: { label: { ar: 'ممنوع',  en: 'Restricted' }, icon: '🔒', className: 'status-danger' },
};

/** Where the assistant was opened from. */
export const SURFACE: Record<AiSurface, { label: Text; icon: string }> = {
  general:     { label: { ar: 'عام',              en: 'General' },     icon: '✦' },
  lesson:      { label: { ar: 'الدرس',            en: 'Lesson' },      icon: '📘' },
  course:      { label: { ar: 'الدورة',           en: 'Course' },      icon: '🎓' },
  assessment:  { label: { ar: 'الاختبار',         en: 'Assessment' },  icon: '🧪' },
  assignment:  { label: { ar: 'المهمة',           en: 'Assignment' },  icon: '📝' },
  project:     { label: { ar: 'المشروع',          en: 'Project' },     icon: '🧩' },
  profile:     { label: { ar: 'الملف الشخصي',      en: 'Profile' },     icon: '🪪' },
  cv:          { label: { ar: 'السيرة الذاتية',    en: 'CV' },          icon: '📄' },
  market:      { label: { ar: 'السوق',            en: 'Market' },      icon: '💼' },
  opportunity: { label: { ar: 'الفرصة',           en: 'Opportunity' }, icon: '🎯' },
  mentor:      { label: { ar: 'المنتور',          en: 'Mentor' },      icon: '🧭' },
  booking:     { label: { ar: 'الحجوزات',         en: 'Bookings' },    icon: '🗓️' },
  team:        { label: { ar: 'الفريق',           en: 'Team' },        icon: '👥' },
  startup:     { label: { ar: 'الشركة',           en: 'Company' },     icon: '🏢' },
  canvas:      { label: { ar: 'اللوحات',          en: 'Canvases' },    icon: '🧱' },
  goal:        { label: { ar: 'الأهداف',          en: 'Goals' },       icon: '🎯' },
};

/**
 * Which scopes make sense from a surface. A lesson can widen to the course it
 * belongs to; a market page cannot, because there is no course in view.
 */
export const SCOPES_FOR: Record<AiSurface, AiScope[]> = {
  general:     ['page', 'profile', 'platform'],
  lesson:      ['page', 'course', 'profile', 'platform'],
  course:      ['page', 'course', 'profile', 'platform'],
  assessment:  ['page', 'course', 'platform'],
  assignment:  ['page', 'course', 'project', 'platform'],
  project:     ['page', 'project', 'team', 'platform'],
  profile:     ['page', 'profile', 'platform'],
  cv:          ['page', 'profile', 'platform'],
  market:      ['page', 'profile', 'platform'],
  opportunity: ['page', 'profile', 'project', 'platform'],
  mentor:      ['page', 'profile', 'platform'],
  booking:     ['page', 'platform'],
  team:        ['page', 'team', 'project', 'platform'],
  startup:     ['page', 'startup', 'team', 'platform'],
  canvas:      ['page', 'startup', 'platform'],
  goal:        ['page', 'startup', 'profile', 'platform'],
};

export const MEMORY_KIND: Record<string, Text> = {
  goal:       { ar: 'هدف',    en: 'Goal' },
  preference: { ar: 'تفضيل',  en: 'Preference' },
  skill:      { ar: 'مهارة',  en: 'Skill' },
  context:    { ar: 'سياق',   en: 'Context' },
  fact:       { ar: 'معلومة', en: 'Fact' },
};

export const ACTION_STATUS: Record<string, { label: Text; className: string }> = {
  proposed:  { label: { ar: 'بانتظار تأكيدك', en: 'Awaiting you' }, className: 'status-pending' },
  confirmed: { label: { ar: 'مؤكَّد',          en: 'Confirmed' },    className: 'status-pending' },
  executed:  { label: { ar: 'تمّ',             en: 'Done' },         className: 'status-ok' },
  declined:  { label: { ar: 'رفضته',           en: 'Declined' },     className: 'status-muted' },
  failed:    { label: { ar: 'تعذّر',            en: 'Failed' },       className: 'status-danger' },
  expired:   { label: { ar: 'انتهت صلاحيته',   en: 'Expired' },      className: 'status-muted' },
};
