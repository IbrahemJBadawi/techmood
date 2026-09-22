'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { ShareScope } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { createShare, type ShareState } from './actions';

const SCOPE: Record<ShareScope, Text> = {
  canvas:   { ar: 'لوحة واحدة',    en: 'One canvas' },
  plan:     { ar: 'خطة العمل',     en: 'The business plan' },
  roadmap:  { ar: 'خارطة الطريق',  en: 'The roadmap' },
  showcase: { ar: 'تعريف الشركة',  en: 'The company overview' },
};

export function ShareForm({
  startupId,
  canvases,
}: {
  startupId: string;
  canvases: { id: string; title_ar: string }[];
}) {
  const t = useT();
  const [scope, setScope] = useState<ShareScope>('showcase');
  const [state, formAction, pending] = useActionState(createShare, undefined as ShareState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="scope">{t('ما الذي تشاركه؟', 'What are you sharing?')}</label>
        <select id="scope" name="scope" value={scope} onChange={(event) => setScope(event.target.value as ShareScope)}>
          {(Object.keys(SCOPE) as ShareScope[]).map((option) => (
            <option key={option} value={option}>{t(SCOPE[option])}</option>
          ))}
        </select>
      </div>

      {scope === 'canvas' && (
        <div className="field">
          <label htmlFor="canvas_id">{t('اللوحة', 'The canvas')}</label>
          <select id="canvas_id" name="canvas_id" defaultValue={canvases[0]?.id}>
            {canvases.map((canvas) => (
              <option key={canvas.id} value={canvas.id}>{canvas.title_ar}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="label">{t('لمن؟', 'For whom?')}</label>
        <input id="label" name="label" placeholder={t('مستثمر، شريك، لجنة', 'An investor, a partner, a jury')} />
      </div>

      <div className="field">
        <label htmlFor="expires_on">{t('ينتهي في', 'Expires on')}</label>
        <input id="expires_on" name="expires_on" type="date" />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Creating…') : t('أنشئ رابطاً', 'Create a link')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
