import type { UserRole } from '@/lib/database.types';

/**
 * TechMood's MVP scope (0103). One place decides what the product shows.
 *
 * In the MVP people sign up as a student, a mentor or a mentee — and, since
 * TechMood Business opened (0165), as a freelancer, a client or a company;
 * since the Startup Studio opened (0166), as a founder or a team lead too.
 * No page is hidden any more; each area has its own switch in
 * `platform_settings` (area_jobs, area_freelance, area_business, area_studio)
 * that the database checks; work paid through the market (escrow) stays
 * closed until it is tested with real money. What `IS_MVP` still decides is the
 * booking flow: the MVP's paid booking (0104) rather than the older sessions.
 *
 * To bring them back: set NEXT_PUBLIC_TECHMOOD_SCOPE=full in the deployment
 * and `mvp_scope` to 'full' in the database.
 */
export const IS_MVP = (process.env.NEXT_PUBLIC_TECHMOOD_SCOPE ?? 'mvp') !== 'full';

/** The roles the MVP offers (admin is granted, never chosen). */
export const MVP_ROLES: UserRole[] = ['student', 'mentor', 'mentee', 'freelancer', 'client', 'company', 'founder', 'team_leader', 'admin'];

export function roleInScope(role: UserRole) {
  return !IS_MVP || MVP_ROLES.includes(role);
}

/** Routes outside the MVP. Anything under them goes home. */
export const HIDDEN_PREFIXES: string[] = [];

/** Market tabs that belong to jobs and freelancing, not to the Student Market. */
export const HIDDEN_MARKET_TABS = ['teams', 'work', 'saved'];

export function pathInScope(pathname: string) {
  if (!IS_MVP) return true;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  return true;
}
