'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { ACTION_STATUS, SCOPE, SCOPES_FOR, SURFACE } from '@/lib/ai';
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
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [state.messages.length, isOpen]);

  if (!assistant || !wire || !where) return null;

  // A prompt handed over by an «اسأل الذكاء» button lands in the box, not in
  // the thread: the person still decides whether to send it.
  const { draft, setDraft } = assistant;

  const send = (prompt: string) => {
    if (!prompt.trim() || pending) return;
    setDraft('');
    startTransition(async () => setState(await ask(wire, prompt, state.threadId)));
  };

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
        <span aria-hidden>✦</span>
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
              <button type="button" className="ghost-button"
                      onClick={() => setState({ ...EMPTY, live: state.live,
                                                suggestions: state.suggestions })}>
                {t('محادثة جديدة', 'New thread')}
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

          <div className="ai-stream">
            {state.messages.length === 0 && (
              <div className="ai-empty">
                <p>{t('اسألني عن هذه الصفحة، أو اختر:', 'Ask about this page, or pick one:')}</p>
                <div className="ai-suggestions">
                  {state.suggestions.map((s) => (
                    <button key={s.label} type="button" className="ai-suggestion"
                            onClick={() => send(s.prompt)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.messages.map((message) => (
              <div key={message.id} className={`ai-bubble ai-${message.role}`}>
                {message.errorAr
                  ? <em className="ai-error">{message.content}</em>
                  : message.content}
              </div>
            ))}

            {state.actions.filter((a) => a.status === 'proposed').map((action) => (
              <div className="ai-action" key={action.id}>
                <div>
                  <strong>{action.titleAr}</strong>
                  <p>{action.summaryAr}</p>
                </div>
                <div className="ai-action-buttons">
                  <button type="button" className="primary-button" disabled={busy === action.id}
                          onClick={() => decide(action.id, true)}>
                    {t('أكّد', 'Confirm')}
                  </button>
                  <button type="button" className="ghost-button" disabled={busy === action.id}
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

          <form
            className="ai-composer"
            onSubmit={(event) => { event.preventDefault(); send(draft); }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              rows={2}
              placeholder={t('اكتب سؤالك…', 'Ask something…')}
            />
            <button type="submit" className="primary-button" disabled={pending || !draft.trim()}>
              {t('أرسل', 'Send')}
            </button>
          </form>

          <footer className="ai-panel-foot">
            <Link href="/ai">{t('كل المحادثات', 'All threads')}</Link>
            <Link href="/settings/ai">{t('الذاكرة والصلاحيات', 'Memory and permissions')}</Link>
          </footer>
        </aside>
      )}
    </>
  );
}
