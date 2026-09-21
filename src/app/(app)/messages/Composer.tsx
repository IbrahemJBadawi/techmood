'use client';

import { useActionState, useEffect, useRef } from 'react';

import { sendMessage, type MessageState } from './actions';
import { useT } from '@/lib/i18n.client';

export function Composer({ conversationId, readOnly }: { conversationId: string; readOnly: boolean }) {
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
          {t('هذه المحادثة للقراءة فقط — انتهت العلاقة التي أنشأتها.', 'This conversation is read-only — the relationship that created it has ended.')}
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
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? '…' : t('إرسال', 'Send')}
        </button>
      </form>
    </>
  );
}
