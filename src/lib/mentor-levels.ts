import type { MentorLevel } from '@/lib/database.types';

/**
 * The three mentor levels (0120), as people read them. The database keeps the
 * codes (L1–L3) and each level's allowed price range in `mentor_levels`; this is
 * only the name and badge a chip shows, so a page that has just the code does
 * not need another query. If an admin renames a level, change it here and in
 * `mentor_levels.title` together.
 *
 * Wording rule (founder): a level sets the *allowed price range*, never "the
 * price" — the mentor names their own price inside it.
 */
export const MENTOR_LEVEL_LOOK: Record<MentorLevel, { title: string; badge: string }> = {
  L1: { title: 'Peer / Junior', badge: '🟢' },
  L2: { title: 'Professional', badge: '🔵' },
  L3: { title: 'Senior / Specialist', badge: '🟣' },
};

/** «🔵 Professional» for a level code; the code itself for anything unknown. */
export function mentorLevelLabel(level: string | null | undefined): string {
  if (!level) return '—';
  const look = MENTOR_LEVEL_LOOK[level as MentorLevel];
  return look ? `${look.badge} ${look.title}` : level;
}
