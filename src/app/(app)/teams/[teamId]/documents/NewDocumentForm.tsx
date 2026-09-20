'use client';

import { useActionState, useState } from 'react';

import { DOCUMENT_KINDS } from '@/lib/teams';

import { saveDocument, type DocumentState } from './actions';

export function NewDocumentForm({
  teamId,
  projects,
}: {
  teamId: string;
  projects: { id: string; title_ar: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveDocument, undefined as DocumentState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        + مستند جديد
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field-row">
        <div className="field">
          <label htmlFor="kind">النوع</label>
          <select id="kind" name="kind" defaultValue="meeting_notes">
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind.key} value={kind.key}>{kind.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="project_id">المشروع (اختياري)</label>
          <select id="project_id" name="project_id" defaultValue="">
            <option value="">بلا ربط</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title_ar}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="title">العنوان</label>
        <input id="title" name="title" required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="body">المحتوى</label>
        <textarea id="body" name="body" rows={5} />
      </div>

      <div className="field">
        <label htmlFor="url">أو رابط خارجي</label>
        <input id="url" name="url" type="url" dir="ltr" placeholder="https://" />
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : 'احفظ'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إغلاق</button>
      </div>
    </form>
  );
}
