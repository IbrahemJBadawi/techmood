import type { UserRole } from '@/lib/database.types';

/**
 * Roles a person may pick for themselves. `admin` is never self-service — it is
 * granted by another admin, and the database refuses to let anyone insert it.
 *
 * This lives outside the 'use server' module because a server-actions file may
 * only export async functions.
 */
export const SELECTABLE_ROLES: { value: UserRole; label: string; needsReview: boolean }[] = [
  { value: 'student', label: 'طالب', needsReview: false },
  { value: 'freelancer', label: 'فريلانسر', needsReview: true },
  { value: 'mentor', label: 'منتور', needsReview: true },
  { value: 'team_leader', label: 'قائد فريق', needsReview: true },
  { value: 'founder', label: 'مؤسس', needsReview: true },
  { value: 'company', label: 'مؤسسة', needsReview: true },
];
