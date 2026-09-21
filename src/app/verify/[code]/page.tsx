import Link from 'next/link';
import QRCode from 'qrcode';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { VerifiedCertificate } from '@/lib/database.types';
import { LogoMark } from '@/components/Logo';

import { Certificate } from './Certificate';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Verify a certificate — TechMood' };

/**
 * Public certificate verification — the QR target printed on every certificate.
 * It reads through verify_certificate(), which returns only what a verifier
 * needs and never exposes the holder's account.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getT();
  const { code } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc('verify_certificate', { p_code: decodeURIComponent(code) });
  const certificate = (data as VerifiedCertificate[] | null)?.[0] ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmood.io';
  // The QR on the document opens the holder's public record — one certificate
  // proves one course, the profile is what it belongs to, and it lists this
  // certificate among the rest.
  const portfolioUrl = certificate ? `${siteUrl}/u/${certificate.techmood_id}` : null;
  const qrDataUrl = portfolioUrl
    ? await QRCode.toDataURL(portfolioUrl, { margin: 1, width: 300 })
    : null;

  return (
    <main className="landing" style={{ maxWidth: 720 }}>
      <nav className="landing-nav no-print">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/verify">
          {t('تحقّق من شهادة أخرى', 'Verify another certificate')}
        </Link>
      </nav>

      {!certificate ? (
        <section className="panel" style={{ marginTop: 32 }}>
          <h1 style={{ fontSize: '1.1rem' }}>
            {t('لا توجد شهادة بهذا الرقم', 'No certificate with that number')}
          </h1>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
            {t('الرقم ', 'The number ')}
            <span className="id-chip">{decodeURIComponent(code)}</span>
            {t(' غير مسجّل في TechMood. تأكد من كتابته كما هو على الشهادة.',
               ' is not registered with TechMood. Check that it matches the certificate exactly.')}
          </p>
        </section>
      ) : (
        <>
          <p
            className={`notice${certificate.status === 'revoked' ? ' notice-danger' : ''}`}
            style={{ marginTop: 32 }}
          >
            {certificate.status === 'active'
              ? t('✓ شهادة صحيحة وسارية، صادرة عن TechMood Technology.',
                  '✓ Valid and in force, issued by TechMood Technology.')
              : t(`⚠ هذه الشهادة ملغاة.${certificate.revoked_reason ? ` السبب: ${certificate.revoked_reason}` : ''}`,
                  `⚠ This certificate has been revoked.${certificate.revoked_reason ? ` Reason: ${certificate.revoked_reason}` : ''}`)}
          </p>

          {certificate.status === 'active' && qrDataUrl ? (
            <div className="certificate-sheet">
              <Certificate certificate={certificate} qrDataUrl={qrDataUrl} />
            </div>
          ) : (
            /* A revoked certificate is not rendered as a document: what is left
               to say is that it was withdrawn, and by whom it was issued. */
            <section className="cert" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <LogoMark />
                <strong>TechMood Technology</strong>
              </div>
              <p className="cert-name">{certificate.holder_name}</p>
              <p className="muted" style={{ fontSize: '0.95rem' }}>{certificate.title}</p>
              <div className="tags-row" style={{ justifyContent: 'center', marginTop: 18 }}>
                <span className="id-chip">{certificate.techmood_id}</span>
                <span className="id-chip">{certificate.certificate_code}</span>
                <span className="id-chip">{formatDate(t.locale, certificate.issued_at)}</span>
              </div>
            </section>
          )}

          <div className="cta-row no-print">
            {certificate.status === 'active' && <PrintButton />}
            <Link className="btn btn-ghost btn-sm" href={`/u/${certificate.techmood_id}`}>
              {t('ملف صاحب الشهادة', 'The holder\u2019s profile')}
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/verify">
              {t('تحقّق من شهادة أخرى', 'Verify another certificate')}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
