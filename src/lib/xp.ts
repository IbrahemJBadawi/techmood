import type { Text } from '@/lib/i18n';

/** Level ladder mirroring public.xp_levels, for rendering without a round-trip. */
export const XP_LEVELS: { minXp: number; title: Text }[] = [
  { minXp: 0,    title: { ar: 'مبتدئ',            en: 'Beginner' } },
  { minXp: 150,  title: { ar: 'متعلّم نشِط',       en: 'Active learner' } },
  { minXp: 400,  title: { ar: 'ممارس',            en: 'Practitioner' } },
  { minXp: 900,  title: { ar: 'محترف',            en: 'Professional' } },
  { minXp: 1800, title: { ar: 'خبير TechMood',    en: 'TechMood expert' } },
  { minXp: 3000, title: { ar: 'أسطورة TechMood',  en: 'TechMood legend' } },
];

type Level = (typeof XP_LEVELS)[number];

export function levelInfo(totalXp: number) {
  let current: Level = XP_LEVELS[0];
  let next: Level | null = null;

  for (let i = 0; i < XP_LEVELS.length; i += 1) {
    if (totalXp >= XP_LEVELS[i].minXp) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] ?? null;
    }
  }

  const percent = next
    ? Math.round(((totalXp - current.minXp) / (next.minXp - current.minXp)) * 100)
    : 100;

  return { current, next, percent };
}
