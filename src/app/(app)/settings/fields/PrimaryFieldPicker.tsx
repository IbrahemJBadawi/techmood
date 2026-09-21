'use client';

import { useActionState } from 'react';

import { setPrimaryField, type FieldState } from './actions';

export function PrimaryFieldPicker({
  fields,
}: {
  fields: { id: string; name: string; nameEn: string; isPrimary: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(setPrimaryField, undefined as FieldState);

  return (
    <form action={formAction} className="panel">
      <div className="stack">
        {fields.map((field) => (
          <label className="radio-row" key={field.id}>
            <input type="radio" name="field_id" value={field.id} defaultChecked={field.isPrimary} />
            <span>
              <strong>{field.name}</strong>
              <span className="muted" dir="ltr"> {field.nameEn}</span>
            </span>
            {field.isPrimary && <span className="pill pill-ok">الرئيسي</span>}
          </label>
        ))}
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? 'جارٍ الحفظ…' : 'اجعله الرئيسي'}
      </button>
    </form>
  );
}
