'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * «Are you sure?» as a small window in the middle of the screen (design lab:
 * «نافذة بالوسط»), in place of the browser's own confirm() box, which cannot be
 * styled and reads like a system error on a phone.
 *
 * Built on <dialog>.showModal(), so focus is trapped, Escape closes it and the
 * page behind is inert without any extra code.
 */

type Ask = { message: string; confirmLabel?: string; danger?: boolean };

export function useConfirm() {
  const [open, setOpen] = useState<Ask | null>(null);
  const settle = useRef<((yes: boolean) => void) | null>(null);

  const ask = useCallback((next: Ask) => new Promise<boolean>((resolve) => {
    settle.current = resolve;
    setOpen(next);
  }), []);

  const close = useCallback((yes: boolean) => {
    settle.current?.(yes);
    settle.current = null;
    setOpen(null);
  }, []);

  const dialog = open ? <ConfirmWindow ask={open} onClose={close} /> : null;
  return { ask, dialog };
}

function ConfirmWindow({ ask, onClose }: { ask: Ask; onClose: (yes: boolean) => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-text"
      onCancel={(event) => { event.preventDefault(); onClose(false); }}
      onClick={(event) => { if (event.target === ref.current) onClose(false); }}
    >
      <div className={`confirm-icon${ask.danger ? ' is-danger' : ''}`} aria-hidden="true">{ask.danger ? '!' : '?'}</div>
      <p id="confirm-dialog-text" className="confirm-text">{ask.message}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>{t('إلغاء', 'Cancel')}</button>
        <button type="button" className={`btn ${ask.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onClose(true)}>
          {ask.confirmLabel ?? t('نعم، متابعة', 'Yes, go ahead')}
        </button>
      </div>
    </dialog>
  );
}

/**
 * A submit button that asks first. Drop it into any form, server-rendered or
 * not: on «yes» it submits the form exactly as a plain click would have,
 * including its own name/value.
 */
export function ConfirmSubmit({
  message, confirmLabel, danger = true, className, name, value, disabled, busy, done, children,
}: {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** the action is running: the button shows its progress bar */
  busy?: boolean;
  /** the action just succeeded: the button shows its tick */
  done?: boolean;
  children: ReactNode;
}) {
  const { ask, dialog } = useConfirm();
  const approved = useRef(false);

  return (
    <>
      <button
        type="submit"
        className={className}
        name={name}
        value={value}
        disabled={disabled}
        aria-busy={busy}
        data-done={done || undefined}
        onClick={async (event) => {
          if (approved.current) { approved.current = false; return; }
          event.preventDefault();
          const button = event.currentTarget;
          if (await ask({ message, confirmLabel, danger })) {
            approved.current = true;
            button.form?.requestSubmit(button);
          }
        }}
      >
        {children}
      </button>
      {dialog}
    </>
  );
}
