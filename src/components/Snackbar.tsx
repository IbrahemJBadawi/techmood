'use client';

import { useEffect, useRef, useState } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * The confirmation bar at the bottom of the screen (design lab: «شريط مع
 * تراجع»). Anything on the page calls showSnack() after an action succeeds;
 * when the action can be reversed it passes an «Undo» that does exactly that.
 * Errors stay next to the control that failed, where the person is looking.
 */
type Snack = { text: string; actionLabel?: string; onAction?: () => void };

const EVENT = 'tm-snack';
const SHOW_MS = 5000;

export function showSnack(snack: Snack) {
  window.dispatchEvent(new CustomEvent<Snack>(EVENT, { detail: snack }));
}

/** Mounted once in the root layout. */
export function SnackbarHost() {
  const t = useT();
  const [snack, setSnack] = useState<(Snack & { key: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onSnack = (event: Event) => {
      const detail = (event as CustomEvent<Snack>).detail;
      window.clearTimeout(timer.current);
      setSnack({ ...detail, key: Date.now() });
      timer.current = window.setTimeout(() => setSnack(null), SHOW_MS);
    };
    window.addEventListener(EVENT, onSnack);
    return () => {
      window.removeEventListener(EVENT, onSnack);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="snackbar-region" role="status" aria-live="polite">
      {snack && (
        <div className="snackbar" key={snack.key}>
          <span className="snackbar-text">{snack.text}</span>
          {snack.onAction && (
            <button
              type="button"
              className="snackbar-action"
              onClick={() => {
                window.clearTimeout(timer.current);
                setSnack(null);
                snack.onAction?.();
              }}
            >
              {snack.actionLabel ?? t('تراجع', 'Undo')}
            </button>
          )}
          <button type="button" className="snackbar-close" aria-label={t('إغلاق', 'Close')} onClick={() => setSnack(null)}>×</button>
        </div>
      )}
    </div>
  );
}
