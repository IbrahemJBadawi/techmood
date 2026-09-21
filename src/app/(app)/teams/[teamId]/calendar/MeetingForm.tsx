'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { scheduleTeamMeeting, type TeamState } from '../../actions';

/**
 * Setting aside an hour for the team itself. No mentor, no payment, no link —
 * a room inside TechMood that the members already have the right to enter.
 */
export function MeetingForm({ teamId }: { teamId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(scheduleTeamMeeting, undefined as TeamState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="meeting-date">{t('اليوم', 'Day')}</label>
        <input id="meeting-date" name="date" type="date" required />
      </div>

      <div className="field">
        <label htmlFor="meeting-time">{t('الساعة', 'Hour')}</label>
        <input id="meeting-time" name="time" type="time" required />
      </div>

      <div className="field">
        <label htmlFor="meeting-minutes">{t('المدة', 'Length')}</label>
        <select id="meeting-minutes" name="minutes" defaultValue="60">
          <option value="30">30 {t('دقيقة', 'min')}</option>
          <option value="60">60 {t('دقيقة', 'min')}</option>
          <option value="90">90 {t('دقيقة', 'min')}</option>
        </select>
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الحجز…', 'Booking…') : t('احجز اجتماع الفريق', 'Book the meeting')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
