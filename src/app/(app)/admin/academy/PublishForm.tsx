'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import type { PublishState } from './actions';

/**
 * Publishing says what happened, including when the database refuses.
 *
 * The refusal is the point: a course with no lessons and a path whose required
 * courses are still outlines cannot be published, and the author should read
 * the reason here rather than wonder why nothing changed.
 */
export function PublishForm({
  action,
  idName,
  idValue,
  status,
  publishedValue,
  draftValue,
  revalidate,
  publishLabel,
  withdrawLabel,
}: {
  action: (prev: PublishState, formData: FormData) => Promise<PublishState>;
  idName: string;
  idValue: string;
  status: string;
  publishedValue: string;
  draftValue: string;
  revalidate: string;
  publishLabel: string;
  withdrawLabel: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  const isPublished = status === publishedValue;

  return (
    <form action={formAction} className="publish-form">
      <input type="hidden" name={idName} value={idValue} />
      <input type="hidden" name="status" value={isPublished ? draftValue : publishedValue} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <button className={`btn btn-sm ${isPublished ? 'btn-ghost' : 'btn-primary'}`} type="submit" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : isPublished ? withdrawLabel : publishLabel}
      </button>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
