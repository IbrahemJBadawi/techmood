'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { DOCUMENT_KIND } from '@/lib/incubator';
import type { CompanyDocumentKind } from '@/lib/database.types';

import { addDocument, type DocumentState } from './actions';

const KINDS = Object.keys(DOCUMENT_KIND) as CompanyDocumentKind[];

export function DocumentForm({ startupId }: { startupId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addDocument, undefined as DocumentState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="title">{t('العنوان', 'Title')}</label>
        <input id="title" name="title" required />
      </div>
      <div className="field">
        <label htmlFor="kind">{t('النوع', 'Kind')}</label>
        <select id="kind" name="kind" defaultValue="other">
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>{t(DOCUMENT_KIND[kind])}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="url">{t('الرابط', 'Link')}</label>
        <input id="url" name="url" type="url" dir="ltr" required />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Saving…') : t('احفظ', 'Save')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
