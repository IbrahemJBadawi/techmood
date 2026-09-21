'use client';

import { useActionState, useState } from 'react';

import { createProject, type ProjectState } from './actions';
import { useT } from '@/lib/i18n.client';

export function NewProjectForm({ teamId }: { teamId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createProject, undefined as ProjectState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" style={{ marginBottom: 18 }} onClick={() => setOpen(true)}>
        {t('+ مشروع جديد', '+ New project')}
      </button>
    );
  }

  return (
    <form action={formAction} className="panel section-block">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="title">{t('اسم المشروع', 'Project name')}</label>
        <input id="title" name="title" required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="description">{t('وصف المشروع', 'Project description')}</label>
        <textarea id="description" name="description" rows={3} />
      </div>

      <div className="field">
        <label htmlFor="tags">{t('التقنيات (مفصولة بفاصلة)', 'Technologies (comma separated)')}</label>
        <input id="tags" name="tags" dir="ltr" placeholder="React, Node.js, PostgreSQL" />
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ المشروع', 'Create project')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إغلاق', 'Close')}</button>
      </div>
    </form>
  );
}
