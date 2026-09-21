import Image from 'next/image';

import type { VerifiedCertificate } from '@/lib/database.types';

/** Who signs. The platform has one signatory; this is not per-certificate data. */
const SIGNATORY = { name: 'Ibrahem J. Badawi', title: 'Director — TechMood' };

const KIND_LINE: Record<string, string> = {
  course: 'Certificate of Completion',
  path: 'Certificate of Completion',
};

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
 * It is written in English on purpose: it is the artefact people attach to a
 * CV, a LinkedIn profile or an application, and that audience is not only
 * Arabic-reading. The work's own title stays in the language it was taught in.
 */
export function Certificate({
  certificate,
  qrDataUrl,
  verifyUrl,
}: {
  certificate: VerifiedCertificate;
  qrDataUrl: string;
  verifyUrl: string;
}) {
  const issued = new Date(certificate.issued_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <article className="certificate" aria-label={`Certificate ${certificate.certificate_code}`}>
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
        <h1 className="certificate-title">{KIND_LINE[certificate.kind] ?? 'Certificate'}</h1>

        <p className="certificate-lead">This certificate is proudly presented to</p>
        <p className="certificate-holder">{certificate.holder_name}</p>

        <p className="certificate-lead">
          for successfully completing the {KIND_OBJECT[certificate.kind] ?? 'programme'}
        </p>
        <p className="certificate-subject">{certificate.title}</p>
        <p className="certificate-lead">at TechMood Academy</p>

        <div className="certificate-rule" />

        <footer className="certificate-foot">
          <div className="certificate-meta">
            <p className="certificate-label">Date of Issue</p>
            <p className="certificate-value">{issued}</p>
            <p className="certificate-label">Certificate ID</p>
            <p className="certificate-value certificate-code">{certificate.certificate_code}</p>
            <p className="certificate-label">Holder ID</p>
            <p className="certificate-value certificate-code">{certificate.techmood_id}</p>
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
            <img src={qrDataUrl} alt={`Verification code for ${certificate.certificate_code}`} />
            <p className="certificate-label">Scan to verify</p>
            <p className="certificate-url">{verifyUrl.replace(/^https?:\/\//, '')}</p>
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
