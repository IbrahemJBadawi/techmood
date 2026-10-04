import Link from 'next/link';

import { getT } from '@/lib/i18n.server';

/**
 * «احجز جلسة» — always one tap away for a learner on home and in the academy.
 * It sits on the side opposite the assistant's button, above the phone tab bar.
 */
export async function BookSessionFab() {
  const t = await getT();
  return (
    <Link className="book-fab" href="/mentors" aria-label={t('احجز جلسة مع منتور', 'Book a session with a mentor')}>
      <span aria-hidden="true">📅</span>
      <span className="book-fab-label">{t('احجز جلسة', 'Book a session')}</span>
    </Link>
  );
}
