'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { SCOPE, SCOPES_FOR, SURFACE } from '@/lib/ai';
import { ChatComposer, ChatThread, lastFailedPrompt } from '@/app/(app)/ai/ChatParts';
import type { AiScope } from '@/lib/database.types';
import {
  ask, confirmAction, declineAction, openPanel,
  type PanelState, type PanelWhere,
} from '@/app/(app)/ai/actions';

import { useAssistant } from './AssistantProvider';

const EMPTY: PanelState = {
  threadId: null, threadTitle: null, messages: [], actions: [], suggestions: [], live: false,
};

/**
 * The ✦ button, and the panel behind it.
 *
 * It sits in the shell, over whatever page is open, because that is the point:
 * the assistant is a layer, not a destination. What it knows comes from the
 * page that registered itself and from the context chip the person set — and
 * both are only ever an id and a scope. The reading happens in the database.
 */
export function Assistant() {
  const t = useT();
  const assistant = useAssistant();
  const [state, setState] = useState<PanelState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const isOpen = assistant?.isOpen ?? false;
  const where = assistant?.where;

  const wire: PanelWhere | null = where
    ? {
        surface: where.surface, scope: where.scope,
        entityType: where.entityType, entityId: where.entityId, label: where.label,
      }
    : null;

  // Opening, or moving to another page while open, reloads what this surface
  // offers. The thread is kept: a conversation should survive a click.
  useEffect(() => {
    if (!isOpen || !wire) return;
    let alive = true;
    openPanel(wire, state.threadId).then((next) => { if (alive) setState(next); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, where?.surface, where?.entityId]);

  if (!assistant || !wire || !where) return null;

  // A prompt handed over by an «اسأل الذكاء» button lands in the box, not in
  // the thread: the person still decides whether to send it.
  const { draft, setDraft } = assistant;

  // The question shows at once; the answer replaces the typing bubble.
  const send = (prompt: string) => {
    const question = prompt.trim();
    if (!question || pending) return;
    setDraft('');
    setSending(question);
    startTransition(async () => {
      const next = await ask(wire, question, state.threadId);
      setSending(null);
      setState(next);
    });
  };
  const retry = lastFailedPrompt(state);

  const decide = (id: string, yes: boolean) => {
    setBusy(id);
    startTransition(async () => {
      const result = yes ? await confirmAction(id) : await declineAction(id);
      const next = await openPanel(wire, state.threadId);
      setBusy(null);
      setState(result.ok ? next : { ...next, error: result.error });
    });
  };

  const surface = SURFACE[where.surface];

  return (
    <>
      <button
        type="button"
        className={`ai-fab${isOpen ? ' is-open' : ''}`}
        onClick={() => (isOpen ? assistant.close() : assistant.open())}
        aria-expanded={isOpen}
        aria-label={t('مساعد TechMood', 'TechMood AI')}
      >
        <span aria-hidden>{isOpen ? '×' : '✦'}</span>
      </button>

      {isOpen && (
        <aside className="ai-panel" role="dialog" aria-label={t('مساعد TechMood', 'TechMood AI')}>
          <header className="ai-panel-head">
            <div>
              <strong>✦ {t('مساعد TechMood', 'TechMood AI')}</strong>
              <span className="ai-surface-chip">
                {surface.icon} {t(surface.label)}
                {where.label ? ` — ${where.label}` : ''}
              </span>
            </div>
            <div className="ai-panel-tools">
              <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setState({ ...EMPTY, live: state.live,
                                                suggestions: state.suggestions })}>
                ＋ {t('محادثة جديدة', 'New chat')}
              </button>
              <button type="button" className="icon-button" onClick={assistant.close}
                      aria-label={t('إغلاق', 'Close')}>×</button>
            </div>
          </header>

          <div className="ai-scope-row" role="group" aria-label={t('نطاق السياق', 'Context')}>
            {SCOPES_FOR[where.surface].map((scope: AiScope) => (
              <button
                key={scope}
                type="button"
                className={`ai-scope${where.scope === scope ? ' is-on' : ''}`}
                onClick={() => assistant.setScope(scope)}
              >
                {SCOPE[scope].icon} {t(SCOPE[scope].label)}
              </button>
            ))}
          </div>

          {!state.live && (
            <p className="ai-notice">
              {t(
                'المساعد غير موصول بمزوّد نموذج في هذه النسخة: المحادثة والذاكرة والإجراءات تعمل، ولا أحد يجيب بعد.',
                'No model provider is wired up in this deployment: threads, memory and actions work, but nothing answers yet.',
              )}
            </p>
          )}

          <ChatThread
            state={state}
            sending={sending}
            busyAction={busy}
            onDecide={decide}
            onRetry={retry ? () => send(retry) : null}
            onSuggestion={send}
            emptyHint={t('أهلاً! اسألني عن هذه الصفحة، عن مسارك، أو عن أي شيء في TechMood.',
                         'Hi! Ask me about this page, your path, or anything on TechMood.')}
          />

          {state.error && <p className="form-error ai-form-error">{state.error}</p>}

          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft)}
            disabled={pending}
            placeholder={t('اكتب سؤالك…', 'Ask something…')}
          />

          <footer className="ai-panel-foot">
            <Link href="/ai">{t('كل المحادثات', 'All threads')}</Link>
            <Link href="/settings/ai">{t('الذاكرة والصلاحيات', 'Memory and permissions')}</Link>
          </footer>
        </aside>
      )}
    </>
  );
}
