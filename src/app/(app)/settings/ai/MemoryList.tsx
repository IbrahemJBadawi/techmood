'use client';

import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { MEMORY_KIND } from '@/lib/ai';
import type { AiMemoryKind } from '@/lib/database.types';

import { editMemory, forgetMemory, setMemoryActive } from './actions';

export type MemoryRow = {
  id: string;
  kind: AiMemoryKind;
  content_ar: string;
  from_assistant: boolean;
  is_active: boolean;
};

/** Read it, change the words, switch one line off, or delete it outright. */
export function MemoryList({ rows }: { rows: MemoryRow[] }) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await job();
      setError(result.ok ? null : result.error ?? null);
    });

  if (rows.length === 0) {
    return (
      <p className="muted">
        {t('لا يتذكّر المساعد شيئاً عنك بعد.', 'The assistant remembers nothing about you yet.')}
      </p>
    );
  }

  return (
    <>
      {error && <p className="form-error">{error}</p>}

      <ul className="ai-memory-list">
        {rows.map((row) => (
          <li key={row.id} className={row.is_active ? '' : 'is-off'}>
            <span className="status-pill status-muted">
              {t(MEMORY_KIND[row.kind] ?? { ar: row.kind, en: row.kind })}
            </span>

            {editing === row.id ? (
              <form
                className="ai-memory-edit"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = draft;
                  setEditing(null);
                  run(() => editMemory(row.id, value));
                }}
              >
                <input value={draft} onChange={(event) => setDraft(event.target.value)} />
                <button type="submit" className="primary-button" disabled={pending}>
                  {t('احفظ', 'Save')}
                </button>
                <button type="button" className="ghost-button" onClick={() => setEditing(null)}>
                  {t('إلغاء', 'Cancel')}
                </button>
              </form>
            ) : (
              <>
                <span className="ai-memory-text">{row.content_ar}</span>
                {row.from_assistant && (
                  <span className="muted">{t('استنتجه المساعد', 'Inferred')}</span>
                )}
                <span className="ai-memory-buttons">
                  <button type="button" className="ghost-button" disabled={pending}
                          onClick={() => { setEditing(row.id); setDraft(row.content_ar); }}>
                    {t('عدّل', 'Edit')}
                  </button>
                  <button type="button" className="ghost-button" disabled={pending}
                          onClick={() => run(() => setMemoryActive(row.id, !row.is_active))}>
                    {row.is_active ? t('أوقف', 'Mute') : t('شغّل', 'Unmute')}
                  </button>
                  <button type="button" className="ghost-button danger" disabled={pending}
                          onClick={() => run(() => forgetMemory(row.id))}>
                    {t('احذف', 'Delete')}
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
