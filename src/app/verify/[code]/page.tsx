import Link from 'next/link';
import QRCode from 'qrcode';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { VerifiedCertificate } from '@/lib/database.types';
import { LogoMark } from '@/components/Logo';

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
  const verifyUrl = `${siteUrl}/verify/${encodeURIComponent(certificate?.certificate_code ?? code)}`;
  const qrDataUrl = certificate
    ? await QRCode.toDataURL(verifyUrl, { margin: 1, width: 264 })
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

          <section className="cert" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <LogoMark />
              <strong>TechMood Technology</strong>
            </div>

            <p className="cert-kicker" style={{ marginTop: 20 }}>
              {certificate.kind === 'path'
                ? t('شهادة إتمام مسار كامل', 'Certificate of completion — full path')
                : t('شهادة إتمام دورة', 'Certificate of completion — course')}
            </p>

            <p className="cert-name">{certificate.holder_name}</p>
            <p className="muted" style={{ fontSize: '0.95rem' }}>{certificate.title}</p>

            <div className="tags-row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <span className="id-chip">{certificate.techmood_id}</span>
              <span className="id-chip">{certificate.certificate_code}</span>
              <span className="id-chip">{formatDate(t.locale, certificate.issued_at)}</span>
            </div>

            {qrDataUrl && (
              <div className="cert-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl}
                     alt={t(`رمز التحقق من الشهادة ${certificate.certificate_code}`,
                            `Verification code for certificate ${certificate.certificate_code}`)} />
                <span className="muted eng" style={{ fontSize: '0.72rem' }}>{verifyUrl}</span>
              </div>
            )}
          </section>

          <div className="cta-row no-print">
            <Link className="btn btn-ghost btn-sm" href="/verify">
              {t('تحقّق من شهادة أخرى', 'Verify another certificate')}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
