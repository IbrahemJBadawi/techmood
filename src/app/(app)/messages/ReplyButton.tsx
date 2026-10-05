'use client';

import { useT } from '@/lib/i18n.client';

/** The event the composer listens for: reply to this message. */
export const REPLY_EVENT = 'tm-reply';
export type ReplyDetail = { id: string; author: string; text: string };

export function ReplyButton({ detail }: { detail: ReplyDetail }) {
  const t = useT();
  return (
    <button
      type="button"
      className="reaction-chip reply-chip"
      aria-label={t('ردّ على هذه الرسالة', 'Reply to this message')}
      title={t('ردّ', 'Reply')}
      onClick={() => window.dispatchEvent(new CustomEvent<ReplyDetail>(REPLY_EVENT, { detail }))}
    >
      ↩︎
    </button>
  );
}
