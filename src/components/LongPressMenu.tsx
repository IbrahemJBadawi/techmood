'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * Actions on a list row behind a long press (design lab 3: «ضغط مطوّل»): the
 * row stays clean, and holding it for half a second opens its actions in a
 * panel from the bottom. A right-click opens it on a computer, and a small
 * «⋯» button that appears on keyboard focus keeps it reachable without a
 * mouse or a finger. The tap after a long press is swallowed, so holding a
 * link does not also open it.
 */
export function LongPressMenu({ label, menu, children }: { label: string; menu: ReactNode; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  return (
    <div
      className="lp-wrap"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pressed.current = false;
        start.current = { x: event.clientX, y: event.clientY };
        cancel();
        timer.current = setTimeout(() => {
          pressed.current = true;
          try { navigator.vibrate?.(12); } catch { /* not on this device */ }
          setOpen(true);
        }, 480);
      }}
      onPointerMove={(event) => {
        // scrolling the list is not a long press
        if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClickCapture={(event) => {
        if (pressed.current) { event.preventDefault(); event.stopPropagation(); pressed.current = false; }
      }}
      onContextMenu={(event) => { event.preventDefault(); cancel(); setOpen(true); }}
    >
      {children}
      <button type="button" className="lp-more" onClick={() => setOpen(true)} aria-label={t(`خيارات: ${label}`, `Options: ${label}`)}>⋯</button>
      <dialog
        ref={sheet}
        className="bottom-sheet lp-sheet"
        aria-label={label}
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        onClick={(event) => { if (event.target === sheet.current) setOpen(false); }}
        onSubmitCapture={() => setOpen(false)}
      >
        <div className="bs-grip" aria-hidden="true" />
        <div className="bs-head">
          <strong className="lp-title">{label}</strong>
          <button type="button" className="bs-close" onClick={() => setOpen(false)} aria-label={t('إغلاق', 'Close')}>✕</button>
        </div>
        <div className="lp-actions">{menu}</div>
      </dialog>
    </div>
  );
}
