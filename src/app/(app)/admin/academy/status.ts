import type { ContentStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/** What each status means to a learner, in the admin's words. */
export const STATUS_LABEL: Record<ContentStatus, Text> = {
  published: { ar: 'مفعّل — مفتوح للطلاب', en: 'On — open to learners' },
  planned:   { ar: 'قريباً — يظهر ولا يُستخدم', en: 'Coming soon — shown, not usable' },
  draft:     { ar: 'مسودة — مخفي', en: 'Draft — hidden' },
  archived:  { ar: 'معطّل — مخفي ولا يُحتسب', en: 'Off — hidden and not counted' },
};

export const STATUS_PILL: Record<ContentStatus, string> = {
  published: 'status-ok',
  planned: 'status-pending',
  draft: 'status-muted',
  archived: 'status-danger',
};

export const STATUS_SHORT: Record<ContentStatus, Text> = {
  published: { ar: 'مفتوح', en: 'Open' },
  planned:   { ar: 'قريباً', en: 'Coming soon' },
  draft:     { ar: 'مسودة', en: 'Draft' },
  archived:  { ar: 'معطّل', en: 'Off' },
};

export const STATUS_ORDER: ContentStatus[] = ['published', 'planned', 'draft', 'archived'];
