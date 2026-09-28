'use client';

import { useActionState, useEffect, useRef } from 'react';

import { sendMessage, type MessageState } from './actions';
import { useT } from '@/lib/i18n.client';

export function Composer({ conversationId, readOnly, note }: { conversationId: string; readOnly: boolean; note?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(sendMessage, undefined as MessageState);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear the box once a send has gone through without an error.
  useEffect(() => {
    if (!pending && !state?.error && inputRef.current) inputRef.current.value = '';
  }, [pending, state]);

  if (readOnly) {
    return (
      <div className="chat-composer">
        <p className="muted" style={{ fontSize: '0.84rem', margin: 'auto' }}>
          {note ?? t('هذه المحادثة للقراءة فقط — انتهت العلاقة التي أنشأتها.', 'This conversation is read-only — the relationship that created it has ended.')}
        </p>
      </div>
    );
  }

  return (
    <>
      {state?.error && (
        <p className="notice notice-danger" style={{ margin: '0 13px 10px', fontSize: '0.82rem' }}>
          {state.error}
        </p>
      )}
      <form action={formAction} className="chat-composer">
        <input type="hidden" name="conversation_id" value={conversationId} />
        <input ref={inputRef} name="body" placeholder={t('اكتب رسالة…', 'Write a message…')} autoComplete="off" required />
        <button className="chat-send" disabled={pending} aria-label={t('إرسال', 'Send')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </form>
    </>
  );
}
