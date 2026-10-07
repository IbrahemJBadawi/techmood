'use client';

import { useActionState, type ReactNode } from 'react';

import { ConfirmSubmit } from '@/components/ConfirmDialog';
import { useT } from '@/lib/i18n.client';

export type ActionFormState = { error?: string; ok?: string } | undefined;

/**
 * A form that says what happened.
 *
 * Most admin writes are refused by the database when they break a rule, and
 * the reason it gives is the useful part — so every such form shows it next to
 * the button instead of silently leaving the page unchanged.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  variant = 'primary',
  confirm,
}: {
  action: (prev: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  variant?: 'primary' | 'ghost';
  /** When set, a window in the middle of the screen asks this before submitting. */
  confirm?: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, undefined as ActionFormState);

  return (
    <form action={formAction} className={className}>
      {children}
      {confirm ? (
        <ConfirmSubmit className={`btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`} disabled={pending}
                       message={confirm} confirmLabel={submitLabel} danger={variant === 'ghost'}>
          {pending ? t('جارٍ…', 'Working…') : submitLabel}
        </ConfirmSubmit>
      ) : (
        <button className={`btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`} type="submit" disabled={pending}>
          {pending ? t('جارٍ…', 'Working…') : submitLabel}
        </button>
      )}
      {state?.error && <p className="notice notice-danger" style={{ marginTop: 8, flexBasis: '100%' }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ marginTop: 8, flexBasis: '100%' }}>{state.ok}</p>}
    </form>
  );
}
