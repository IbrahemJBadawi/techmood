'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { scheduleTeamMeeting, type TeamState } from '../../actions';

/**
 * The leader sets aside time for the team itself (0113). No mentor, no payment,
 * no link — a room inside TechMood that only the team's members can enter.
 * The day and hour are read on Palestine's clock; days too close to a session
 * already booked are named before the leader tries them.
 */
export function MeetingForm({ teamId, blockedDays = [] }: { teamId: string; blockedDays?: string[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(scheduleTeamMeeting, undefined as TeamState);
  const [day, setDay] = useState('');
  const [today] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()));
  const tooClose = day !== '' && blockedDays.includes(day);

  return (
    <form action={formAction} className="meeting-form" style={{ marginTop: 14 }}>
      <input type="hidden" name="team_id" value={teamId} />

      <div className="field">
        <label htmlFor="meeting-date">{t('اليوم', 'Day')}</label>
        <input id="meeting-date" name="date" type="date" required min={today} value={day}
               onChange={(event) => setDay(event.target.value)} aria-describedby="meeting-gap" />
      </div>

      <div className="field">
        <label htmlFor="meeting-time">{t('الساعة (فلسطين)', 'Hour (Palestine)')}</label>
        <input id="meeting-time" name="time" type="time" required />
      </div>

      <div className="field">
        <label htmlFor="meeting-minutes">{t('المدة', 'Length')}</label>
        <select id="meeting-minutes" name="minutes" defaultValue="60">
          <option value="30">30 {t('دقيقة', 'min')}</option>
          <option value="60">60 {t('دقيقة', 'min')}</option>
          <option value="90">90 {t('دقيقة', 'min')}</option>
          <option value="120">120 {t('دقيقة', 'min')}</option>
        </select>
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending || tooClose}>
        {pending ? t('جارٍ الحجز…', 'Booking…') : t('احجز جلسة للفريق', 'Book a team session')}
      </button>

      <p id="meeting-gap" className={tooClose ? 'notice notice-warn' : 'muted meeting-hint'}>
        {tooClose
          ? t('هذا اليوم قريب من جلسة محجوزة — اختر يوماً يبعد ثلاثة أيام على الأقل.', 'That day is too close to a booked session — pick one at least three days away.')
          : t('بين الجلسة والأخرى ثلاثة أيام على الأقل، وجلستان في الأسبوع.', 'At least three days between sessions, and two a week.')}
      </p>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
