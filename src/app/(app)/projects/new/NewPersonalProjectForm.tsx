'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { createPersonalProject, type NewProjectState } from '../actions-personal';

/** Name, what it is, what it is built with — the rest is added on the project's page. */
export function NewPersonalProjectForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(createPersonalProject, undefined as NewProjectState);

  return (
    <form action={formAction} className="panel section-block stack">
      <div className="field">
        <label htmlFor="title">{t('اسم المشروع', 'Project name')}</label>
        <input id="title" name="title" required minLength={3} maxLength={160} />
      </div>
      <div className="field">
        <label htmlFor="description">{t('ما هو، ولمن، وما المشكلة التي يحلها', 'What it is, who it is for, and the problem it solves')}</label>
        <textarea id="description" name="description" rows={4} maxLength={4000} />
      </div>
      <div className="field">
        <label htmlFor="tags">{t('التقنيات (مفصولة بفاصلة)', 'Technologies (comma separated)')}</label>
        <input id="tags" name="tags" dir="ltr" placeholder="React, Node.js, PostgreSQL" />
      </div>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <div>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ المشروع', 'Create the project')}
        </button>
      </div>
    </form>
  );
}
