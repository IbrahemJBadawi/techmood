'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * When a page breaks: the same calm screen as a missing page, with «try
 * again» first, since most of these are a dropped connection or a slow reply.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="status-page">
      <p className="status-code is-error" aria-hidden="true">!</p>
      <h1>{t('حدث خطأ أثناء فتح الصفحة', 'Something went wrong opening this page')}</h1>
      <p className="muted">
        {t('غالباً هو انقطاع مؤقت. جرّب مرة أخرى، وإن تكرر أخبرنا من «المساعدة».',
           'Usually a brief interruption. Try again, and if it keeps happening tell us from Help.')}
      </p>
      {error.digest && <p className="muted eng" style={{ fontSize: '0.75rem' }}>ref: {error.digest}</p>}
      <div className="status-actions">
        <button className="btn btn-primary" type="button" onClick={() => reset()}>{t('حاول مرة أخرى', 'Try again')}</button>
        <Link className="btn btn-ghost" href="/">{t('الرئيسية', 'Home')}</Link>
      </div>
    </main>
  );
}
