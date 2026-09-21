import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT } from '@/lib/i18n.server';

export const metadata = { title: 'Verify a certificate — TechMood' };

async function goToCode(formData: FormData) {
  'use server';
  const code = String(formData.get('code') ?? '').trim();
  if (code) redirect(`/verify/${encodeURIComponent(code)}`);
}

export default async function VerifyIndexPage() {
  const t = await getT();

  return (
    <main className="landing" style={{ maxWidth: 520 }}>
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <span className="logo-mark" />
          TechMood
        </Link>
      </nav>

      <h1 style={{ fontSize: '1.3rem', margin: '32px 0 6px' }}>
        {t('التحقق من شهادة', 'Verify a certificate')}
      </h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        {t('أدخل رقم الشهادة الظاهر عليها، أو امسح رمز الـ QR.',
           'Enter the number printed on the certificate, or scan its QR code.')}
      </p>

      <form action={goToCode} className="panel">
        <div className="field">
          <label htmlFor="code">{t('رقم الشهادة', 'Certificate number')}</label>
          <input id="code" name="code" dir="ltr" placeholder="TM-C-XXXXXXXX" required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>{t('تحقّق', 'Verify')}</button>
      </form>
    </main>
  );
}
