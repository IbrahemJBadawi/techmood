import type { ExhibitionSnapshot, ProjectKind } from '@/lib/database.types';
import type { Locale, Text } from '@/lib/i18n';

export type GalleryEntry = {
  entry_code: string;
  published_at: string;
  snapshot: ExhibitionSnapshot;
};

export const KIND_LABEL: Record<ProjectKind, Text> = {
  course:   { ar: 'مشروع دورة',    en: 'Course project' },
  path:     { ar: 'مشروع مسار',    en: 'Path project' },
  capstone: { ar: 'مشروع تخرّج',   en: 'Capstone project' },
  team:     { ar: 'مشروع فريق',    en: 'Team project' },
  startup:  { ar: 'مشروع ناشئ',    en: 'Startup project' },
  personal: { ar: 'مشروع فردي',    en: 'Personal project' },
};

export const CRITERION_LABEL = {
  requirements:      { ar: 'تحقيق المتطلبات', en: 'Requirements' },
  technical_quality: { ar: 'الجودة التقنية',  en: 'Technical quality' },
  ui_ux:             { ar: 'الواجهة والتجربة', en: 'UI / UX' },
  problem_solving:   { ar: 'حل المشكلة',      en: 'Problem solving' },
  documentation:     { ar: 'التوثيق',         en: 'Documentation' },
  completeness:      { ar: 'الاكتمال',        en: 'Completeness' },
} as const;

/** Who built it, said the same way on a card and on a page. */
export function builderName(entry: GalleryEntry, locale: Locale): string {
  const snapshot = entry.snapshot;
  if (snapshot.team) return snapshot.team.title;
  if (snapshot.creator) return snapshot.creator.full_name;
  return locale === 'ar' ? 'غير محدّد' : 'Unattributed';
}

/** Everything the search box reads, lower-cased once per entry. */
export function entryHaystack(entry: GalleryEntry): string {
  const snapshot = entry.snapshot;
  return [
    snapshot.project_title, snapshot.summary, snapshot.description,
    snapshot.problem, snapshot.solution, snapshot.path?.title,
    snapshot.team?.title, snapshot.creator?.full_name,
    ...(snapshot.technologies ?? []),
    ...(snapshot.outcomes ?? []),
    ...(snapshot.members ?? []).map((member) => member.full_name),
  ].filter(Boolean).join(' ').toLowerCase();
}
