import type { UserRole } from '@/lib/database.types';

/**
 * TechMood's MVP scope (0103). One place decides what the product shows.
 *
 * In the MVP people sign up as a student, a mentor or a mentee; startups,
 * companies, freelancers, clients and jobs are hidden — not deleted. Their
 * pages redirect home, their links are not rendered, and the database refuses
 * to create anything in them while `platform_settings.mvp_scope` is 'mvp'.
 *
 * To bring them back: set NEXT_PUBLIC_TECHMOOD_SCOPE=full in the deployment
 * and `mvp_scope` to 'full' in the database.
 */
export const IS_MVP = (process.env.NEXT_PUBLIC_TECHMOOD_SCOPE ?? 'mvp') !== 'full';

/** The roles the MVP offers (admin is granted, never chosen). */
export const MVP_ROLES: UserRole[] = ['student', 'mentor', 'mentee', 'admin'];

export function roleInScope(role: UserRole) {
  return !IS_MVP || MVP_ROLES.includes(role);
}

/** Routes outside the MVP. Anything under them goes home. */
export const HIDDEN_PREFIXES = [
  '/startups',
  '/incubator',
  '/companies',
  '/mentor-companies',
  '/client',
  '/applications',
  '/settings/freelancer',
  '/marketplace/new',
  '/admin/incubator',
];

/** Market tabs that belong to jobs and freelancing, not to the Student Market. */
export const HIDDEN_MARKET_TABS = ['jobs', 'talent', 'teams', 'work', 'saved'];

export function pathInScope(pathname: string) {
  if (!IS_MVP) return true;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  // /marketplace/<opening> is a job or freelance opening; the market itself stays.
  if (/^\/marketplace\/[0-9a-f-]{36}(\/|$)/.test(pathname)) return false;
  return true;
}
