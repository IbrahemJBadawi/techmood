'use client';

import { useT } from '@/lib/i18n.client';
import type { MarketSaveKind } from '@/lib/database.types';

import { toggleSave } from './market-actions';

/**
 * Keeping something to come back to. What somebody saved is theirs alone — it
 * is not a count on the card and not a signal to anybody else.
 */
export function SaveButton({
  kind,
  target,
  saved,
  revalidate = '/marketplace',
}: {
  kind: MarketSaveKind;
  target: string;
  saved: boolean;
  revalidate?: string;
}) {
  const t = useT();

  return (
    <form action={toggleSave} className="save-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <button
        className={`save-btn${saved ? ' is-saved' : ''}`}
        title={saved ? t('محفوظ', 'Saved') : t('احفظ', 'Save')}
        aria-pressed={saved}
      >
        {saved ? '♥' : '♡'}
      </button>
    </form>
  );
}
