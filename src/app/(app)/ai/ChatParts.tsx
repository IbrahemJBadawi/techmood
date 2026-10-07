'use client';

import { useEffect, useRef } from 'react';

import { AiText } from '@/components/AiText';
import { useT } from '@/lib/i18n.client';
import { ACTION_STATUS } from '@/lib/ai';

import type { PanelState } from './actions';

/**
 * What the floating panel and the full conversation page share: the thread,
 * the proposal cards, the "typing" bubble, and the box to write in.
 *
 * The question appears the moment it is sent (it is already written down in
 * the database by the time the answer arrives), and the answer is shown
 * formatted, never as raw Markdown.
 */
export function ChatThread({
  state, sending, busyAction, onDecide, onRetry, onSuggestion, emptyHint, emptyExtra,
}: {
  /** more to offer under the suggestions when nothing has been asked yet */
  emptyExtra?: React.ReactNode;
  state: PanelState;
  /** a question on its way: shown at once, with the typing bubble under it */
  sending: string | null;
  busyAction: string | null;
  onDecide: (id: string, yes: boolean) => void;
  onRetry: (() => void) | null;
  onSuggestion: (prompt: string) => void;
  emptyHint: string;
}) {
  const t = useT();
  const endRef = useRef<HTMLDivElement>(null);
  const count = state.messages.length + (sending ? 1 : 0) + state.actions.length;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [count]);

  return (
    <div className="ai-stream" aria-live="polite">
      {state.messages.length === 0 && !sending && (
        <div className="ai-empty">
          <span className="ai-empty-mark" aria-hidden>✦</span>
          <p>{emptyHint}</p>
          {state.suggestions.length > 0 && (
            <div className="ai-suggestions">
              {state.suggestions.map((s) => (
                <button key={s.label} type="button" className="ai-suggestion" onClick={() => onSuggestion(s.prompt)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {emptyExtra}
        </div>
      )}

      {state.messages.map((message) => (
        <div key={message.id} className={`ai-bubble ai-${message.role}${message.errorAr ? ' is-error' : ''}`}>
          {message.errorAr
            ? <span className="ai-error">⚠️ {message.content}</span>
            : message.role === 'assistant' ? <AiText text={message.content} /> : message.content}
        </div>
      ))}

      {sending && (
        <>
          <div className="ai-bubble ai-user">{sending}</div>
          <div className="ai-bubble ai-assistant is-thinking" aria-label={t('المساعد يكتب…', 'The assistant is typing…')}>
            <span className="ai-dots" aria-hidden><i /><i /><i /></span>
          </div>
        </>
      )}

      {state.actions.filter((a) => a.status === 'proposed').map((action) => (
        <div className="ai-action" key={action.id}>
          <div>
            <span className="ai-action-kicker">{t('اقتراح — لا يحدث شيء قبل موافقتك', 'A suggestion — nothing happens until you confirm')}</span>
            <strong>{action.titleAr}</strong>
            <p>{action.summaryAr}</p>
          </div>
          <div className="ai-action-buttons">
            <button type="button" className="btn btn-primary btn-sm" disabled={busyAction === action.id}
                    onClick={() => onDecide(action.id, true)}>
              {t('نفّذ', 'Do it')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busyAction === action.id}
                    onClick={() => onDecide(action.id, false)}>
              {t('لا، شكراً', 'No thanks')}
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

      {onRetry && !sending && (
        <button type="button" className="btn btn-ghost btn-sm ai-retry" onClick={onRetry}>
          ↻ {t('أعد المحاولة', 'Try again')}
        </button>
      )}

      <div ref={endRef} />
    </div>
  );
}

/** The box: grows with what is written, Enter sends, Shift+Enter breaks the line. */
export function ChatComposer({
  value, onChange, onSend, disabled, placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  const t = useT();
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <textarea
        ref={boxRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSend();
          }
        }}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit" className="ai-send" disabled={disabled || !value.trim()} aria-label={t('أرسل', 'Send')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
        </svg>
      </button>
    </form>
  );
}

/** The last question the person asked, to send again after a failed answer. */
export function lastFailedPrompt(state: PanelState): string | null {
  const last = state.messages[state.messages.length - 1];
  if (!state.error && !(last && last.role === 'assistant' && last.errorAr)) return null;
  const question = [...state.messages].reverse().find((m) => m.role === 'user');
  return question?.content ?? null;
}
