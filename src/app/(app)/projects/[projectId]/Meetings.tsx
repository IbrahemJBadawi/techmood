'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { cancelMeeting, scheduleMeeting, type MeetingState } from './actions';

export type Meeting = {
  id: string;
  session_code: string;
  topic_ar: string | null;
  start_at: string;
  end_at: string;
  status: string;
  attended: number;
};

/**
 * The project's own meetings.
 *
 * No price, no mentor, no payment step — two parties to a contract agreeing to
 * talk. The room is the same internal room every other TechMood session uses,
 * so attendance, presence and the recording of who actually turned up all work
 * without a second implementation.
 */
export function Meetings({ projectId, meetings }: { projectId: string; meetings: Meeting[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<MeetingState, FormData>(
    scheduleMeeting, undefined,
  );
  const [cancelState, cancelAction] = useActionState<MeetingState, FormData>(
    cancelMeeting, undefined,
  );

  const live = meetings.filter((row) => row.status === 'scheduled' || row.status === 'live');
  const past = meetings.filter((row) => row.status !== 'scheduled' && row.status !== 'live');

  return (
    <div className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('اجتماعات المشروع', 'Project meetings')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('اجتماع بينك وبين الطرف الآخر — بلا سعر وبلا وسيط. الغرفة هي غرفة TechMood نفسها، والحضور يُسجَّل.',
           'A call between you and the other side — no price, no middle step. The room is TechMood’s own, and attendance is recorded.')}
      </p>

      {live.length > 0 && (
        <ul className="plain-list" style={{ marginTop: 12 }}>
          {live.map((meeting) => (
            <li key={meeting.id}>
              <span>
                <strong>{meeting.topic_ar ?? t('اجتماع', 'Meeting')}</strong>
                <span className="muted eng"> · {new Date(meeting.start_at).toLocaleString()}</span>
              </span>
              <span className="row-actions">
                <Link className="btn btn-primary btn-sm" href={`/sessions/${meeting.id}`}>
                  {t('ادخل الغرفة', 'Enter the room')}
                </Link>
                <form action={cancelAction}>
                  <input type="hidden" name="project_id" value={projectId} />
                  <input type="hidden" name="session_id" value={meeting.id} />
                  <button className="btn btn-ghost btn-sm">{t('ألغِ', 'Cancel')}</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      {cancelState?.error && <p className="notice notice-danger">{cancelState.error}</p>}

      <form action={formAction} style={{ marginTop: 14 }}>
        <input type="hidden" name="project_id" value={projectId} />

        <div className="field">
          <label htmlFor="topic">{t('موضوع الاجتماع', 'What is it about?')}</label>
          <input id="topic" name="topic"
                 placeholder={t('مراجعة التسليم الأول', 'Reviewing the first delivery')} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="start">{t('الوقت', 'When')}</label>
            <input id="start" name="start" type="datetime-local" required />
          </div>
          <div className="field">
            <label htmlFor="minutes">{t('المدّة', 'Length')}</label>
            <select id="minutes" name="minutes" defaultValue="60">
              <option value="30">30 {t('دقيقة', 'min')}</option>
              <option value="60">60 {t('دقيقة', 'min')}</option>
              <option value="90">90 {t('دقيقة', 'min')}</option>
            </select>
          </div>
        </div>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

        <button className="btn btn-ghost btn-sm" disabled={pending}>
          {pending ? t('جارٍ…', 'Booking…') : t('احجز اجتماعاً', 'Book a meeting')}
        </button>
      </form>

      {past.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ fontSize: '0.84rem' }}>
            {t('اجتماعات سابقة', 'Earlier meetings')} ({past.length})
          </summary>
          <ul className="plain-list" style={{ marginTop: 8 }}>
            {past.map((meeting) => (
              <li key={meeting.id}>
                <span>{meeting.topic_ar ?? t('اجتماع', 'Meeting')}</span>
                <span className="muted eng">
                  {new Date(meeting.start_at).toLocaleDateString()} · {meeting.status}
                  {meeting.attended > 0 && ` · ${meeting.attended} ${t('حضروا', 'attended')}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
