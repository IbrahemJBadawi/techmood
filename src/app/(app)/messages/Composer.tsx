'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { sendMessage, type MessageState } from './actions';
import { REPLY_EVENT, type ReplyDetail } from './ReplyButton';
import { useT } from '@/lib/i18n.client';

export function Composer({ conversationId, readOnly, note }: { conversationId: string; readOnly: boolean; note?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(sendMessage, undefined as MessageState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [replyTo, setReplyTo] = useState<ReplyDetail | null>(null);

  // Clear the box (and the reply) once a send has gone through without an error.
  useEffect(() => {
    if (!pending && !state?.error && inputRef.current) {
      inputRef.current.value = '';
      setReplyTo(null);
    }
  }, [pending, state]);

  // A bubble's reply button names the message; the box takes it and the focus.
  useEffect(() => {
    const onReply = (event: Event) => {
      setReplyTo((event as CustomEvent<ReplyDetail>).detail);
      inputRef.current?.focus();
    };
    window.addEventListener(REPLY_EVENT, onReply);
    return () => window.removeEventListener(REPLY_EVENT, onReply);
  }, []);

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
      {replyTo && (
        <div className="chat-replying">
          <span className="cr-text">
            <strong>{t('ردّ على ', 'Replying to ')}{replyTo.author}</strong>
            <span>{replyTo.text}</span>
          </span>
          <button type="button" className="icon-button" onClick={() => setReplyTo(null)} aria-label={t('إلغاء الرد', 'Cancel the reply')}>✕</button>
        </div>
      )}
      <form action={formAction} className="chat-composer">
        <input type="hidden" name="conversation_id" value={conversationId} />
        {replyTo && <input type="hidden" name="reply_to_id" value={replyTo.id} />}
        <input ref={inputRef} name="body" placeholder={t('اكتب رسالة…', 'Write a message…')} autoComplete="off" required />
        <button className="chat-send" disabled={pending} aria-label={t('إرسال', 'Send')} aria-busy={pending}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </form>
    </>
  );
}
