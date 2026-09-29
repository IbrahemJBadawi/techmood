import type { Text } from '@/lib/i18n';
import type { StudioReviewState } from '@/lib/database.types';

/** Where a studio piece stands (0115), in words and in a pill's colour. */
export const REVIEW_STATE: Record<StudioReviewState, { text: Text; pill: string }> = {
  none:              { text: { ar: 'TechMood', en: 'TechMood' }, pill: 'status-muted' },
  editing:           { text: { ar: 'مسودة', en: 'Draft' }, pill: 'status-muted' },
  submitted:         { text: { ar: 'بانتظار المراجعة', en: 'In review' }, pill: 'status-pending' },
  changes_requested: { text: { ar: 'مطلوب تعديل', en: 'Changes requested' }, pill: 'status-danger' },
  approved:          { text: { ar: 'منشور', en: 'Published' }, pill: 'status-ok' },
};

export const editable = (state: StudioReviewState) => state === 'editing' || state === 'changes_requested';

export const LEVELS: { value: 'beginner' | 'intermediate' | 'advanced'; label: Text }[] = [
  { value: 'beginner', label: { ar: 'مبتدئ', en: 'Beginner' } },
  { value: 'intermediate', label: { ar: 'متوسط', en: 'Intermediate' } },
  { value: 'advanced', label: { ar: 'متقدم', en: 'Advanced' } },
];
