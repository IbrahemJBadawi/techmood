'use client';

import { useEffect, useRef, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * "Share" on every page worth sending to someone: a project, a service, a
 * course, a path, a profile. On a phone it opens the system share sheet; on
 * a computer a small menu: copy the link, WhatsApp, LinkedIn, X, Telegram.
 * The link is built from the address the visitor is on, so it is the real
 * domain wherever the site is served from.
 */
export function ShareButton({
  path, title, text, className = 'btn btn-ghost btn-sm', label,
}: {
  /** the page to share, from the site root (e.g. /gallery/TMP-1A2B3C) */
  path: string;
  title: string;
  text?: string;
  className?: string;
  label?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (!boxRef.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  const url = () => `${window.location.origin}${path}`;
  const message = () => `${text ?? title} — ${url()}`;

  async function onShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, text: text ?? title, url: url() }); return; } catch { /* closed — fall through to nothing */ return; }
    }
    setOpen((value) => !value);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  const go = (href: string) => { window.open(href, '_blank', 'noopener,noreferrer'); setOpen(false); };

  return (
    <span className="share-wrap" ref={boxRef}>
      <button type="button" className={className} onClick={onShare} aria-expanded={open} aria-haspopup="menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        <span>{label ?? t('مشاركة', 'Share')}</span>
      </button>
      {open && (
        <span className="share-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>{copied ? t('✓ نُسخ الرابط', '✓ Link copied') : t('🔗 انسخ الرابط', '🔗 Copy link')}</button>
          <button type="button" role="menuitem" onClick={() => go(`https://wa.me/?text=${encodeURIComponent(message())}`)}>WhatsApp</button>
          <button type="button" role="menuitem" onClick={() => go(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`)}>LinkedIn</button>
          <button type="button" role="menuitem" onClick={() => go(`https://x.com/intent/post?text=${encodeURIComponent(message())}`)}>X</button>
          <button type="button" role="menuitem" onClick={() => go(`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(text ?? title)}`)}>Telegram</button>
        </span>
      )}
    </span>
  );
}
