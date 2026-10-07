'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * What a term means, behind a small ⓘ (design lab 3: «زر ⓘ يفتح شرح»).
 * A tap opens it, a tap elsewhere or Escape closes it — unlike a hover
 * tooltip, it works on a phone. The note is placed against the screen, not
 * its card, so a card that clips its corners never cuts it off.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  const id = useId();
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const open = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16);
    setAt({ top: rect.bottom + 8, left, width });
  };

  useEffect(() => {
    if (!at) return;
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setAt(null); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setAt(null); };
    const close = () => setAt(null);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [at]);

  return (
    <span className="info-tip" ref={box}>
      <button type="button" ref={button} className="info-tip-btn" aria-expanded={Boolean(at)} aria-controls={id}
              aria-label={t(`ما معنى ${label}؟`, `What is ${label}?`)} onClick={() => (at ? setAt(null) : open())}>
        i
      </button>
      {at && (
        <span className="info-tip-pop" id={id} role="note" style={{ top: at.top, left: at.left, width: at.width }}>
          {children}
        </span>
      )}
    </span>
  );
}
