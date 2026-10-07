'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { setPrimaryField, type FieldState } from './actions';
import { useSavedFlash } from '@/lib/use-saved-flash';

export function PrimaryFieldPicker({
  fields,
}: {
  fields: { id: string; name: string; nameEn: string; isPrimary: boolean }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(setPrimaryField, undefined as FieldState);
  const done = useSavedFlash(state);

  return (
    <form action={formAction} className="panel">
      <div className="stack">
        {fields.map((field) => (
          <label className="radio-row" key={field.id}>
            <input type="radio" name="field_id" value={field.id} defaultChecked={field.isPrimary} />
            <span>
              <strong>{t.locale === 'ar' ? field.name : field.nameEn}</strong>
              <span className="muted" dir={t.locale === 'ar' ? 'ltr' : 'rtl'}>
                {' '}{t.locale === 'ar' ? field.nameEn : field.name}
              </span>
            </span>
            {field.isPrimary && <span className="pill pill-ok">{t('الرئيسي', 'Primary')}</span>}
          </label>
        ))}
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="sr-only" role="status">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending} style={{ marginTop: 12 }} aria-busy={pending} data-done={done || undefined}>
        {pending ? t('جارٍ الحفظ…', 'Saving…') : done ? t('✓ حُفظ', '✓ Saved') : t('اجعله الرئيسي', 'Make it primary')}
      </button>
    </form>
  );
}
