'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { readThread, type ReadState } from './actions';

/**
 * Opening a private conversation: an open case and a reason, every time. The
 * database records the access on the case and the audit log, and tells the
 * person whose conversation it is.
 */
export function ReadThread({ threadId, cases }: { threadId: string; cases: { id: string; label: string }[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(readThread, undefined as ReadState);

  if (state?.lines) {
    return (
      <div className="stack" style={{ marginTop: 8 }}>
        {state.lines.map((line, index) => (
          <p key={index} className={`ticket-line is-${line.role === 'user' ? 'user' : 'assistant'}`} style={{ fontSize: '0.84rem', whiteSpace: 'pre-line' }}>
            <strong>{line.role === 'user' ? t('المستخدم', 'User') : t('المساعد', 'Assistant')}: </strong>{line.content}
          </p>
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return <p className="muted" style={{ fontSize: '0.78rem' }}>{t('قراءة المحتوى تحتاج قضية مفتوحة.', 'Reading the words needs an open case.')}</p>;
  }

  return (
    <form action={formAction} className="admin-inline-form">
      <input type="hidden" name="thread_id" value={threadId} />
      <select name="case_id" required aria-label={t('القضية', 'Case')}>
        {cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <input name="reason" required minLength={10} placeholder={t('سبب الاطلاع (يُبلَّغ صاحب المحادثة)', 'Why (the owner is told)')} />
      <button className="btn btn-ghost btn-sm" type="submit" disabled={pending} aria-busy={pending}>{pending ? t('جارٍ…', 'Working…') : t('اطّلع', 'Read')}</button>
      {state?.error && <p className="notice notice-danger" style={{ flexBasis: '100%' }}>{state.error}</p>}
    </form>
  );
}
