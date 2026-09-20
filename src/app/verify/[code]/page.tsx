import Link from 'next/link';
import QRCode from 'qrcode';

import { createClient } from '@/lib/supabase/server';
import type { VerifiedCertificate } from '@/lib/database.types';

export const metadata = { title: 'التحقق من شهادة — TechMood' };

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
          <span className="logo-mark" />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/verify">تحقّق من شهادة أخرى</Link>
      </nav>

      {!certificate ? (
        <section className="panel" style={{ marginTop: 32 }}>
          <h1 style={{ fontSize: '1.1rem' }}>لا توجد شهادة بهذا الرقم</h1>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
            الرقم <span className="id-chip">{decodeURIComponent(code)}</span> غير مسجّل في TechMood.
            تأكد من كتابته كما هو على الشهادة.
          </p>
        </section>
      ) : (
        <>
          <p
            className={`notice${certificate.status === 'revoked' ? ' notice-danger' : ''}`}
            style={{ marginTop: 32 }}
          >
            {certificate.status === 'active'
              ? '✓ شهادة صحيحة وسارية، صادرة عن TechMood Technology.'
              : `⚠ هذه الشهادة ملغاة.${certificate.revoked_reason ? ` السبب: ${certificate.revoked_reason}` : ''}`}
          </p>

          <section className="cert" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <span className="logo-mark" />
              <strong>TechMood Technology</strong>
            </div>

            <p className="cert-kicker" style={{ marginTop: 20 }}>
              {certificate.kind === 'path' ? 'شهادة إتمام مسار كامل' : 'شهادة إتمام دورة'}
            </p>

            <p className="cert-name">{certificate.holder_name}</p>
            <p className="muted" style={{ fontSize: '0.95rem' }}>{certificate.title}</p>

            <div className="tags-row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <span className="id-chip">{certificate.techmood_id}</span>
              <span className="id-chip">{certificate.certificate_code}</span>
              <span className="id-chip">
                {new Date(certificate.issued_at).toLocaleDateString('ar-EG')}
              </span>
            </div>

            {qrDataUrl && (
              <div className="cert-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={`رمز التحقق من الشهادة ${certificate.certificate_code}`} />
                <span className="muted eng" style={{ fontSize: '0.72rem' }}>{verifyUrl}</span>
              </div>
            )}
          </section>

          <div className="cta-row no-print">
            <Link className="btn btn-ghost btn-sm" href="/verify">تحقّق من شهادة أخرى</Link>
          </div>
        </>
      )}
    </main>
  );
}
