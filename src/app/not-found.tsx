import Link from 'next/link';

import { getT } from '@/lib/i18n.server';

/**
 * A link that leads nowhere (design lab 3: «404 كبير + زر الرئيسية»): the
 * number large, one line on what happened, and the way home.
 */
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="status-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="status-logo" src="/logo-mark.png" alt="TechMood" width={44} height={44} />
      <p className="status-code eng" aria-hidden="true">404</p>
      <h1>{t('الصفحة غير موجودة', 'This page does not exist')}</h1>
      <p className="muted">{t('ربما تغيّر الرابط أو حُذفت الصفحة.', 'The link may have changed, or the page was removed.')}</p>
      <div className="status-actions">
        <Link className="btn btn-primary" href="/">{t('الرئيسية', 'Home')}</Link>
        <Link className="btn btn-ghost" href="/search">{t('ابحث', 'Search')}</Link>
      </div>
    </main>
  );
}
