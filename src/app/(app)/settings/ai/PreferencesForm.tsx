'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { saveAiPreferences, type AiSettingsState } from './actions';
import { useSavedFlash } from '@/lib/use-saved-flash';

export function PreferencesForm({ memory, actions }: { memory: boolean; actions: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<AiSettingsState, FormData>(
    saveAiPreferences, undefined,
  );
  const done = useSavedFlash(state);

  return (
    <form action={formAction} className="stack">
      <label className="switch-row">
        <input type="checkbox" name="memory" defaultChecked={memory} />
        <span>
          <strong>{t('ذاكرة المساعد', 'Assistant memory')}</strong>
          <span className="muted">
            {t('حين تُوقفها لا يُرسَل شيء ممّا يتذكّره، ويبقى ما سجّلته ظاهراً لك أدناه.',
               'With this off nothing remembered is sent, and what is stored stays visible to you below.')}
          </span>
        </span>
      </label>

      <label className="switch-row">
        <input type="checkbox" name="actions" defaultChecked={actions} />
        <span>
          <strong>{t('إجراءات المساعد', 'Assistant actions')}</strong>
          <span className="muted">
            {t('حين تُوقفها يظلّ يقترح، ولا يُنفَّذ اقتراح حتى لو ضغطت التأكيد.',
               'With this off it still suggests, and no suggestion runs even if you confirm it.')}
          </span>
        </span>
      </label>

      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.ok && <p className="sr-only" role="status">{state.ok}</p>}

      <button type="submit" className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending} data-done={done || undefined}>
        {done ? t('✓ حُفظ', '✓ Saved') : t('احفظ', 'Save')}
      </button>
    </form>
  );
}
