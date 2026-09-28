'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * Sharing the card as what it is — a picture — with the link beside it.
 *
 * The story card is drawn to a 1080×1920 PNG in the browser (html-to-image),
 * so Arabic shapes and joins exactly as it does on screen. Where the phone's
 * share sheet takes files, the picture goes straight to it with the profile
 * link; elsewhere it is downloaded. The QR printed on the picture leads back
 * to the profile, and copying the link stays one tap away.
 */
export function ShareButtons({ url, name, techmoodId }: { url: string; name: string; techmoodId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const text = t(`الهوية المهنية لـ${name} على TechMood`, `${name}'s professional identity on TechMood`);

  async function picture(): Promise<Blob> {
    const node = document.getElementById('identity-story');
    if (!node) throw new Error('no card');
    const { toBlob } = await import('html-to-image');
    const width = node.offsetWidth;
    const blob = await toBlob(node, {
      pixelRatio: 1080 / width,
      cacheBust: true,
      // The card's rounded corners are part of the page, not of the picture.
      style: { borderRadius: '0', margin: '0' },
    });
    if (!blob) throw new Error('no image');
    return blob;
  }

  async function shareImage() {
    setError('');
    setBusy(true);
    try {
      const blob = await picture();
      const file = new File([blob], `techmood-${techmoodId}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'TechMood', text: `${text}\n${url}` });
          return;
        } catch (reason) {
          if ((reason as Error).name === 'AbortError') return;
        }
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch {
      setError(t('تعذّر تجهيز الصورة — جرّب مرة أخرى.', 'The picture could not be made — try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary btn-sm" type="button" onClick={shareImage} disabled={busy}>
        {busy ? t('جارٍ تجهيز الصورة…', 'Making the picture…') : t('شارك البطاقة كصورة', 'Share as a picture')}
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={copyLink}>
        {copied ? t('نُسخ الرابط ✓', 'Link copied ✓') : t('انسخ الرابط', 'Copy the link')}
      </button>
      {error && <p className="notice notice-danger" style={{ flexBasis: '100%' }}>{error}</p>}
    </>
  );
}
