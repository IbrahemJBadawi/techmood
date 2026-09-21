'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * Sharing, with the platform's own share sheet where the browser has one and a
 * copied link where it does not. Both hand over the profile URL rather than an
 * image: the card is a picture of the record, and the link is the record.
 */
export function ShareButtons({ url, name }: { url: string; name: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = t(`الهوية المهنية لـ${name} على TechMood`, `${name}'s professional identity on TechMood`);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'TechMood', text, url });
        return;
      } catch {
        // the person closed the sheet; fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button className="btn btn-primary btn-sm" type="button" onClick={share}>
      {copied ? t('نُسخ الرابط', 'Link copied') : t('شارك البطاقة', 'Share the card')}
    </button>
  );
}
