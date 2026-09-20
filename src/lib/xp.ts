/** Level ladder mirroring public.xp_levels, for rendering without a round-trip. */
export const XP_LEVELS = [
  { minXp: 0, title: 'مبتدئ' },
  { minXp: 150, title: 'متعلّم نشِط' },
  { minXp: 400, title: 'ممارس' },
  { minXp: 900, title: 'محترف' },
  { minXp: 1800, title: 'خبير TechMood' },
  { minXp: 3000, title: 'أسطورة TechMood' },
] as const;

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
