'use client';

import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { ChatComposer, ChatThread, lastFailedPrompt } from '../ChatParts';
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
  const [sending, setSending] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (prompt: string) => {
    const question = prompt.trim();
    if (!question || pending) return;
    setDraft('');
    setSending(question);
    startTransition(async () => {
      const next = await ask(where, question, state.threadId);
      setSending(null);
      setState(next);
    });
  };
  const retry = lastFailedPrompt(state);

  const decide = (id: string, yes: boolean) => {
    setBusy(id);
    startTransition(async () => {
      const result = yes ? await confirmAction(id) : await declineAction(id);
      const next = await openPanel(where, state.threadId);
      setBusy(null);
      setState(result.ok ? next : { ...next, error: result.error });
    });
  };

  return (
    <section className="card ai-conversation">
      {!state.live && (
        <p className="ai-notice">
          {t('المساعد غير موصول بمزوّد نموذج في هذه النسخة.', 'No model provider is wired up in this deployment.')}
        </p>
      )}

      <ChatThread
        state={state}
        sending={sending}
        busyAction={busy}
        onDecide={decide}
        onRetry={retry ? () => send(retry) : null}
        onSuggestion={send}
        emptyHint={t('اكتب سؤالك لتبدأ.', 'Write your question to start.')}
      />

      {state.error && <p className="form-error ai-form-error">{state.error}</p>}

      <ChatComposer value={draft} onChange={setDraft} onSend={() => send(draft)} disabled={pending}
                    placeholder={t('اكتب سؤالك…', 'Ask something…')} />
    </section>
  );
}
