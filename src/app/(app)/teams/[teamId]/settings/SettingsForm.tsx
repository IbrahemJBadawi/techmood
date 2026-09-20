'use client';

import { useActionState } from 'react';

import { TEAM_KIND } from '@/lib/teams';
import type { Team } from '@/lib/database.types';

import { saveTeamSettings, type SettingsState } from './actions';

export function SettingsForm({ team }: { team: Team }) {
  const [state, formAction, pending] = useActionState(saveTeamSettings, undefined as SettingsState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>عام</h3>
      <input type="hidden" name="team_id" value={team.id} />

      <div className="field">
        <label htmlFor="title">اسم الفريق</label>
        <input id="title" name="title" defaultValue={team.title_ar} required minLength={3} />
      </div>

      <div className="field">
        <label htmlFor="description">الوصف</label>
        <textarea id="description" name="description" rows={3} defaultValue={team.description_ar ?? ''} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="kind">النوع</label>
          <select id="kind" name="kind" defaultValue={team.kind}>
            {Object.entries(TEAM_KIND).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">حالة الفريق</label>
          <select id="status" name="status" defaultValue={team.status}>
            <option value="active">نشط</option>
            <option value="completed">مكتمل</option>
            <option value="archived">مؤرشف</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="focus">مجال العمل</label>
        <input id="focus" name="focus" defaultValue={team.focus_ar ?? ''} />
      </div>

      <div className="field">
        <label htmlFor="needs">الأدوار المطلوبة (مفصولة بفاصلة)</label>
        <input id="needs" name="needs" defaultValue={(team.needs ?? []).join('، ')} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="visibility">الظهور</label>
          <select id="visibility" name="visibility" defaultValue={team.visibility}>
            <option value="private">خاص تماماً</option>
            <option value="listed">ملف مهني عام</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="join_policy">الانضمام</label>
          <select id="join_policy" name="join_policy" defaultValue={team.join_policy}>
            <option value="invite_only">بالدعوة فقط</option>
            <option value="request_allowed">يسمح بطلبات الانضمام</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="public_summary">ما يظهر في الملف العام</label>
        <textarea id="public_summary" name="public_summary" rows={2} defaultValue={team.public_summary_ar ?? ''} />
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          الملف العام ينشر الاسم والأعضاء والمشاريع المكتملة فقط — لا المهام ولا المحادثة ولا
          المستندات، مهما كان هذا الإعداد.
        </span>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? 'جارٍ الحفظ…' : 'احفظ الإعدادات'}
      </button>
    </form>
  );
}
