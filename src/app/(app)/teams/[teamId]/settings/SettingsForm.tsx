'use client';

import { useActionState } from 'react';

import { TEAM_KIND } from '@/lib/teams';
import type { Team } from '@/lib/database.types';

import { saveTeamSettings, type SettingsState } from './actions';
import { useT } from '@/lib/i18n.client';

export function SettingsForm({ team }: { team: Team }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveTeamSettings, undefined as SettingsState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('عام', 'General')}</h3>
      <input type="hidden" name="team_id" value={team.id} />

      <div className="field">
        <label htmlFor="title">{t('اسم الفريق', 'Team name')}</label>
        <input id="title" name="title" defaultValue={team.title_ar} required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="description">{t('الوصف', 'Description')}</label>
        <textarea id="description" name="description" rows={3} defaultValue={team.description_ar ?? ''} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="kind">{t('النوع', 'Kind')}</label>
          <select id="kind" name="kind" defaultValue={team.kind}>
            {Object.entries(TEAM_KIND).map(([key, label]) => (
              <option key={key} value={key}>{t(label)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">{t('حالة الفريق', 'Team status')}</label>
          <select id="status" name="status" defaultValue={team.status}>
            <option value="active">{t('نشط', 'Active')}</option>
            <option value="completed">{t('مكتمل', 'Completed')}</option>
            <option value="archived">{t('مؤرشف', 'Archived')}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="focus">{t('مجال العمل', 'Focus')}</label>
        <input id="focus" name="focus" defaultValue={team.focus_ar ?? ''} />
      </div>

      <div className="field">
        <label htmlFor="needs">{t('الأدوار المطلوبة (مفصولة بفاصلة)', 'Roles needed (comma separated)')}</label>
        <input id="needs" name="needs" defaultValue={(team.needs ?? []).join(t('، ', ', '))} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="visibility">{t('الظهور', 'Visibility')}</label>
          <select id="visibility" name="visibility" defaultValue={team.visibility}>
            <option value="private">{t('خاص تماماً', 'Fully private')}</option>
            <option value="listed">{t('ملف مهني عام', 'Public professional profile')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="join_policy">{t('الانضمام', 'Joining')}</label>
          <select id="join_policy" name="join_policy" defaultValue={team.join_policy}>
            <option value="invite_only">{t('بالدعوة فقط', 'By invitation only')}</option>
            <option value="request_allowed">{t('يسمح بطلبات الانضمام', 'Requests to join allowed')}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="public_summary">{t('ما يظهر في الملف العام', 'What the public profile shows')}</label>
        <textarea id="public_summary" name="public_summary" rows={2} defaultValue={team.public_summary_ar ?? ''} />
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          {t('الملف العام ينشر الاسم والأعضاء والمشاريع المكتملة فقط — لا المهام ولا المحادثة ولا المستندات، مهما كان هذا الإعداد.',
             'A public profile publishes only the name, the members and the finished projects — never the tasks, the conversation or the documents, whatever this setting says.')}
        </span>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ الإعدادات', 'Save settings')}
      </button>
    </form>
  );
}
