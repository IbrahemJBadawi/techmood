'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { track } from '@/lib/analytics';
import { linkedInPostUrl } from '@/lib/linkedin';

function Mark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Straight into «Licenses & Certifications» — the URL comes from linkedInCertificateUrl(). */
export function LinkedInAddCertificate({ href }: { href: string }) {
  const t = useT();
  return (
    <a className="btn btn-sm btn-linkedin" href={href} target="_blank" rel="noopener noreferrer" onClick={() => track('certificate_linkedin')}>
      <Mark /> {t('أضفها لملفك على LinkedIn', 'Add to LinkedIn profile')}
    </a>
  );
}

/**
 * A post, written for the member. The text is also copied first: LinkedIn's
 * phone app opens the composer but may drop the text, and then it is one
 * paste away.
 */
export function LinkedInPostButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-linkedin"
      onClick={async () => {
        track('linkedin_post');
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 4000);
        } catch {
          setCopied(false);
        }
        window.open(linkedInPostUrl(text), '_blank', 'noopener,noreferrer');
      }}
    >
      <Mark /> {copied ? t('نُسخ النص — الصقه إن لم يظهر', 'Text copied — paste it if it is missing') : (label ?? t('انشر على LinkedIn', 'Post on LinkedIn'))}
    </button>
  );
}
