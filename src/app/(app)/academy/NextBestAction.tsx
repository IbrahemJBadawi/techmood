'use client';

import Link from 'next/link';

import type { Text } from '@/lib/i18n';
import { useT } from '@/lib/i18n.client';

import type { AcademyCourse, AcademyPath } from './types';

export type Action = { href: string; label: Text; primary: boolean };

/**
 * One action per card, chosen by where the learner already stands.
 *
 * Nothing started yet is an invitation to start; something started is an
 * invitation to carry on; something finished is an invitation to look back.
 * Never three buttons competing for the same decision.
 */
export function pathAction(path: AcademyPath): Action {
  const href = `/academy/${path.slug}`;
  if (path.status === 'completed') {
    return { href, label: { ar: 'راجع المسار', en: 'Review the path' }, primary: false };
  }
  if (path.status === 'in_progress') {
    return { href, label: { ar: 'تابع المسار', en: 'Continue the path' }, primary: true };
  }
  return {
    href,
    label: path.is_enrolled
      ? { ar: 'ابدأ أول دورة', en: 'Start the first course' }
      : { ar: 'ابدأ المسار', en: 'Start the path' },
    primary: true,
  };
}

/**
 * A course is always reached through a path, because that is how the routes
 * are built. A course carried by no published path has nowhere to open.
 */
export function courseAction(course: AcademyCourse): Action | null {
  const pathSlug = course.path_slugs[0];
  if (!pathSlug) return null;
  const href = `/academy/${pathSlug}/${course.slug}`;
  if (course.status === 'completed') {
    return { href, label: { ar: 'راجع الدورة', en: 'Review the course' }, primary: false };
  }
  if (course.status === 'in_progress') {
    return { href, label: { ar: 'تابع الدورة', en: 'Continue the course' }, primary: true };
  }
  return { href, label: { ar: 'ابدأ الدورة', en: 'Start the course' }, primary: true };
}

export function NextBestAction({ action }: { action: Action | null }) {
  const t = useT();
  if (!action) return null;
  return (
    <Link
      className={`btn btn-sm ${action.primary ? 'btn-primary' : 'btn-ghost'}`}
      href={action.href}
    >
      {action.label[t.locale]}
    </Link>
  );
}
