import Image from 'next/image';
import { Outfit } from 'next/font/google';

import type { VerifiedCertificate } from '@/lib/database.types';

/**
 * The certificate has its own typeface.
 *
 * The rest of TechMood is set in an Arabic-first family; this document is
 * English, printed, and read by someone who has never seen the platform, so it
 * gets a geometric sans that carries wide letterspacing without falling apart.
 */
const display = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });

/** Who signs. The platform has one signatory; this is not per-certificate data. */
const SIGNATORY = { name: 'Ibrahem J. Badawi', title: 'Director — TechMood' };

const KIND_OBJECT: Record<string, string> = {
  course: 'course',
  path: 'learning path',
};

/**
 * The certificate as a document.
 *
 * Everything on it comes from verify_certificate(), which reads the snapshot
 * frozen when the certificate was issued — so a course renamed afterwards does
 * not quietly rewrite somebody's certificate. The page is sized in container
 * units, so the same markup is a card on a phone, a sheet on a screen and an
 * A4 landscape page in print, with no second layout to keep in step.
 *
 * The QR carries one thing: the holder's public profile. A certificate proves
 * one course; the profile is the record it belongs to, and it lists this
 * certificate among the rest — so whoever scans it lands on the person, not on
 * a single claim.
 */
export function Certificate({
  certificate,
  qrDataUrl,
}: {
  certificate: VerifiedCertificate;
  qrDataUrl: string;
}) {
  const issued = new Date(certificate.issued_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <article
      className={`certificate ${display.className}`}
      aria-label={`Certificate ${certificate.certificate_code}`}
    >
      {/* the sheet: frame, then the seal again as a watermark behind the words */}
      <Image className="certificate-frame" src="/certificate/frame.jpg" alt="" fill priority />
      <Image
        className="certificate-watermark"
        src="/certificate/seal.png"
        alt=""
        width={520}
        height={403}
      />

      <div className="certificate-body">
        <Image
          className="certificate-seal"
          src="/certificate/seal.png"
          alt="TechMood Academy"
          width={520}
          height={403}
          priority
        />

        <p className="certificate-org">TechMood Academy</p>
        <h1 className="certificate-title">Certificate of Completion</h1>

        <p className="certificate-lead">This certificate is proudly presented to</p>
        <p className="certificate-holder">{certificate.holder_name}</p>

        <p className="certificate-lead">
          for successfully completing the {KIND_OBJECT[certificate.kind] ?? 'programme'}
        </p>
        {/* the English title is frozen in the snapshot; the Arabic one is the
            fallback for a certificate issued before the catalogue had both */}
        <p className="certificate-subject">{certificate.title_en ?? certificate.title}</p>
        <p className="certificate-lead">at TechMood Academy</p>

        <div className="certificate-rule" />

        <footer className="certificate-foot">
          <div className="certificate-meta">
            <p className="certificate-label">Date of Issue</p>
            <p className="certificate-value">{issued}</p>
          </div>

          <div className="certificate-sign">
            <Image
              className="certificate-signature"
              src="/certificate/signature.png"
              alt=""
              width={520}
              height={281}
            />
            <p className="certificate-value">{SIGNATORY.name}</p>
            <p className="certificate-label">{SIGNATORY.title}</p>
            <Image
              className="certificate-stamp"
              src="/certificate/stamp.png"
              alt=""
              width={440}
              height={438}
            />
          </div>

          <div className="certificate-verify">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`Profile of ${certificate.holder_name}`} />
            <p className="certificate-code">{certificate.certificate_code}</p>
          </div>
        </footer>

        <p className="certificate-brand">
          <Image src="/logo-mark.png" alt="" width={48} height={48} />
          <span>TechMood Academy</span>
        </p>
      </div>
    </article>
  );
}
