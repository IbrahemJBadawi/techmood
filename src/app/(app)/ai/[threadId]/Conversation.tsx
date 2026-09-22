'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { ACTION_STATUS } from '@/lib/ai';
import {
  ask, confirmAction, declineAction, openPanel,
  type PanelState, type PanelWhere,
} from '../actions';

/**
 * The same conversation as the floating panel, full width.
 *
 * It shares the server actions rather than reimplementing them, so a thread
 * behaves identically whether it is read here or over a page.
 */
export function Conversation({ initial, where }: { initial: PanelState; where: PanelWhere }) {
  const t = useT();
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [state.messages.length]);

  const send = (prompt: string) => {
    if (!prompt.trim() || pending) return;
    setDraft('');
    startTransition(async () => setState(await ask(where, prompt, state.threadId)));
  };

  const decide = (id: string, yes: boolean) => {
    startTransition(async () => {
      const result = yes ? await confirmAction(id) : await declineAction(id);
      const next = await openPanel(where, state.threadId);
      setState(result.ok ? next : { ...next, error: result.error });
    });
  };

  return (
    <section className="card ai-conversation">
      {!state.live && (
        <p className="ai-notice">
          {t(
            'المساعد غير موصول بمزوّد نموذج في هذه النسخة.',
            'No model provider is wired up in this deployment.',
          )}
        </p>
      )}

      <div className="ai-stream is-full">
        {state.messages.map((message) => (
          <div key={message.id} className={`ai-bubble ai-${message.role}`}>
            {message.errorAr ? <em className="ai-error">{message.content}</em> : message.content}
          </div>
        ))}

        {state.actions.filter((a) => a.status === 'proposed').map((action) => (
          <div className="ai-action" key={action.id}>
            <div>
              <strong>{action.titleAr}</strong>
              <p>{action.summaryAr}</p>
            </div>
            <div className="ai-action-buttons">
              <button type="button" className="primary-button" disabled={pending}
                      onClick={() => decide(action.id, true)}>
                {t('أكّد', 'Confirm')}
              </button>
              <button type="button" className="ghost-button" disabled={pending}
                      onClick={() => decide(action.id, false)}>
                {t('لا', 'No')}
              </button>
            </div>
          </div>
        ))}

        {state.actions.filter((a) => a.status !== 'proposed').map((action) => (
          <div className="ai-action is-settled" key={action.id}>
            <span className={`status-pill ${ACTION_STATUS[action.status]?.className ?? ''}`}>
              {t(ACTION_STATUS[action.status]?.label ?? { ar: action.status, en: action.status })}
            </span>
            <span>{action.summaryAr}</span>
            {action.errorAr && <em className="ai-error">{action.errorAr}</em>}
          </div>
        ))}

        {pending && <div className="ai-bubble ai-assistant is-thinking">…</div>}
        <div ref={endRef} />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={t('اكتب سؤالك…', 'Ask something…')}
        />
        <button type="submit" className="primary-button" disabled={pending || !draft.trim()}>
          {t('أرسل', 'Send')}
        </button>
      </form>
    </section>
  );
}
