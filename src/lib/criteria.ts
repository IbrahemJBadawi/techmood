import type { ClientCriterion, CourseCriterion, SessionCriterion, WorkerCriterion } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/** The names of every rating criterion, in one place for forms and summaries. */
export const SESSION_CRITERION: Record<SessionCriterion, Text> = {
  quality:        { ar: 'جودة الجلسة',        en: 'Session quality' },
  clarity:        { ar: 'الوضوح',             en: 'Clarity' },
  usefulness:     { ar: 'الفائدة',            en: 'Usefulness' },
  punctuality:    { ar: 'الالتزام بالموعد',   en: 'Punctuality' },
  guidance:       { ar: 'جودة التوجيه',       en: 'Guidance' },
  commitment:     { ar: 'الالتزام',           en: 'Commitment' },
  preparation:    { ar: 'الاستعداد',          en: 'Preparation' },
  participation:  { ar: 'المشاركة',           en: 'Participation' },
  use_of_session: { ar: 'استثمار الوقت',      en: 'Use of the session' },
  cooperation:    { ar: 'التعاون',            en: 'Cooperation' },
  communication:  { ar: 'التواصل',            en: 'Communication' },
};

export const CLIENT_CRITERION: Record<ClientCriterion, Text> = {
  quality:         { ar: 'جودة العمل',     en: 'Quality' },
  communication:   { ar: 'التواصل',        en: 'Communication' },
  deadline:        { ar: 'الالتزام بالموعد', en: 'Deadline' },
  professionalism: { ar: 'الاحترافية',     en: 'Professionalism' },
  scope:           { ar: 'الالتزام بالنطاق', en: 'Scope' },
};

export const WORKER_CRITERION: Record<WorkerCriterion, Text> = {
  clarity:         { ar: 'وضوح المطلوب',  en: 'Knew what they wanted' },
  communication:   { ar: 'التواصل',       en: 'Communication' },
  professionalism: { ar: 'الاحترافية',    en: 'Professionalism' },
  payment:         { ar: 'الالتزام بالدفع', en: 'Paid as agreed' },
  scope:           { ar: 'ثبات الاتفاق',  en: 'Kept to the scope' },
};

export const COURSE_CRITERION: Record<CourseCriterion, Text> = {
  content:    { ar: 'المحتوى',          en: 'Content' },
  clarity:    { ar: 'وضوح الشرح',       en: 'Clarity' },
  practice:   { ar: 'التطبيق العملي',   en: 'Practice' },
  pace:       { ar: 'الإيقاع والمدة',   en: 'Pace' },
  usefulness: { ar: 'الفائدة لعملي',    en: 'Usefulness for my work' },
};

/** A criterion's name for a digest row, whichever kind of rating it came from. */
export function criterionLabel(source: 'session' | 'work' | 'as_client', criterion: string): Text {
  const table: Record<string, Text> =
    source === 'session' ? SESSION_CRITERION : source === 'work' ? CLIENT_CRITERION : WORKER_CRITERION;
  return table[criterion] ?? { ar: criterion, en: criterion };
}
