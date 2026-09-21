import type { CourseLevel, Database, LearningStatus } from '@/lib/database.types';
import type { Locale, Text } from '@/lib/i18n';
import { contentText, plural } from '@/lib/i18n';

/**
 * The academy renders what the database already decided.
 *
 * Both row shapes come straight from the two discovery functions, so a card can
 * never hold a rule of its own: completion, percent and status are computed
 * once, in SQL, by the same helpers the path and course pages use.
 */
export type AcademyPath = Database['public']['Functions']['academy_paths']['Returns'][number];
export type AcademyCourse = Database['public']['Functions']['academy_courses']['Returns'][number];

export const STATUS_LABEL: Record<LearningStatus, Text> = {
  not_started: { ar: 'لم يبدأ', en: 'Not started' },
  in_progress: { ar: 'قيد التقدّم', en: 'In progress' },
  completed:   { ar: 'مكتمل', en: 'Completed' },
};

export const LEVEL_LABEL: Record<CourseLevel, Text> = {
  beginner:     { ar: 'مبتدئ', en: 'Beginner' },
  intermediate: { ar: 'متوسط', en: 'Intermediate' },
  advanced:     { ar: 'متقدّم', en: 'Advanced' },
};

export const LEVEL_ORDER: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

/** The range a path covers, said once: "مبتدئ → متقدّم", or a single level. */
export function levelRange(
  locale: Locale,
  from: CourseLevel | null,
  to: CourseLevel | null,
): string | null {
  if (!from && !to) return null;
  const a = from ?? to!;
  const b = to ?? from!;
  const left = LEVEL_LABEL[a][locale];
  const right = LEVEL_LABEL[b][locale];
  return a === b ? left : `${left} → ${right}`;
}

/** The title a reader of this locale should see, falling back to Arabic. */
export function pathTitle(locale: Locale, path: AcademyPath) {
  return contentText(locale, path.title_ar, path.title_en);
}

export function courseTitle(locale: Locale, course: AcademyCourse) {
  return contentText(locale, course.title_ar, course.title_en);
}

/** The domains a course belongs to are the published paths carrying it. */
export function courseDomains(locale: Locale, course: AcademyCourse): string[] {
  return course.path_titles_ar.map((ar, index) =>
    contentText(locale, ar, course.path_titles_en[index] ?? null));
}

/** Everything the search box looks at, lower-cased once per row. */
export function pathHaystack(path: AcademyPath) {
  return [path.title_ar, path.title_en, path.description_ar, path.tagline_ar,
    path.school_name_ar, path.school_name_en, ...(path.tags ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
}

export function courseHaystack(course: AcademyCourse) {
  return [course.title_ar, course.title_en, course.description_ar,
    ...course.path_titles_ar, ...course.path_titles_en]
    .filter(Boolean).join(' ').toLowerCase();
}

/**
 * Arabic counts a noun in five shapes; English in two. These say the counted
 * nouns the academy repeats, so no card spells out its own plural.
 */
function counted(
  locale: Locale,
  count: number,
  ar: { one: string; two: string; few: string; many: string },
  en: { one: string; other: string },
) {
  if (locale === 'en') return plural(locale, count, en);
  return plural(locale, count, { ...ar, other: ar.many });
}

export function courseCount(locale: Locale, n: number) {
  return counted(locale, n,
    { one: 'دورة واحدة', two: 'دورتان', few: `${n} دورات`, many: `${n} دورة` },
    { one: '1 course', other: `${n} courses` });
}

export function lessonCount(locale: Locale, n: number) {
  return counted(locale, n,
    { one: 'درس واحد', two: 'درسان', few: `${n} دروس`, many: `${n} درساً` },
    { one: '1 lesson', other: `${n} lessons` });
}

export function moduleCount(locale: Locale, n: number) {
  return counted(locale, n,
    { one: 'وحدة واحدة', two: 'وحدتان', few: `${n} وحدات`, many: `${n} وحدة` },
    { one: '1 module', other: `${n} modules` });
}

export function pathCount(locale: Locale, n: number) {
  return counted(locale, n,
    { one: 'مسار واحد', two: 'مساران', few: `${n} مسارات`, many: `${n} مساراً` },
    { one: '1 path', other: `${n} paths` });
}

export function resultCount(locale: Locale, n: number) {
  return counted(locale, n,
    { one: 'نتيجة واحدة', two: 'نتيجتان', few: `${n} نتائج`, many: `${n} نتيجة` },
    { one: '1 result', other: `${n} results` });
}
