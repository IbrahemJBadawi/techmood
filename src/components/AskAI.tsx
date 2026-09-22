'use client';

import { useAssistant } from '@/app/(app)/shell/AssistantProvider';
import { useT } from '@/lib/i18n.client';

/**
 * «✨ اسأل الذكاء» — the same assistant, opened from inside a lesson, a task,
 * a canvas or a job, already holding the question that page is usually asked.
 */
export function AskAI({ prompt, label, variant = 'ghost' }: {
  prompt: string;
  label?: string;
  variant?: 'ghost' | 'inline';
}) {
  const t = useT();
  const assistant = useAssistant();
  if (!assistant) return null;

  return (
    <button
      type="button"
      className={variant === 'inline' ? 'ask-ai ask-ai-inline' : 'ask-ai'}
      onClick={() => assistant.open(prompt)}
    >
      <span aria-hidden>✨</span>
      {label ?? t('اسأل الذكاء', 'Ask AI')}
    </button>
  );
}
