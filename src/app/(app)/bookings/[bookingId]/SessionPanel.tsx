'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import {
  declineBooking,
  recordAttendance,
  setMeetingLink,
  type SessionState,
} from '../actions';

function Result({ state }: { state: SessionState }) {
  if (state?.error) return <p className="notice notice-danger" style={{ marginTop: 10 }}>{state.error}</p>;
  if (state?.ok) return <p className="notice notice-ok" style={{ marginTop: 10 }}>{state.ok}</p>;
  return null;
}

/** The mentor sets (or changes) the link the learner will join from. */
export function MeetingLinkForm({ bookingId, current }: { bookingId: string; current: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState(setMeetingLink, undefined as SessionState);

  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="field">
        <label htmlFor="meeting-url">{t('رابط الاجتماع', 'Meeting link')}</label>
        <input
          id="meeting-url"
          name="url"
          type="url"
          inputMode="url"
          dir="ltr"
          placeholder="https://meet.google.com/…"
          defaultValue={current ?? ''}
          required
        />
      </div>
      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={pending}>
        {current ? t('تحديث الرابط', 'Update the link') : t('حفظ الرابط', 'Save the link')}
      </button>
      <Result state={state} />
    </form>
  );
}

/** The mentor cannot make it: the reason goes to the learner, and the money back to them. */
export function DeclineForm({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(declineBooking, undefined as SessionState);

  return (
    <details>
      <summary className="muted" style={{ fontSize: '0.84rem', cursor: 'pointer' }}>
        {t('لا أستطيع حضور هذه الجلسة', 'I cannot make this session')}
      </summary>
      <form action={action} style={{ marginTop: 10 }}>
        <input type="hidden" name="booking_id" value={bookingId} />
        <div className="field">
          <label htmlFor="decline-reason">{t('سبب الاعتذار — يصل للطالب', 'Why — the learner will read this')}</label>
          <textarea id="decline-reason" name="reason" rows={3} minLength={10} maxLength={500} required />
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} disabled={pending}>
          {t('اعتذر وأعِد المبلغ للطالب', 'Decline and refund the learner')}
        </button>
        <Result state={state} />
      </form>
    </details>
  );
}

/**
 * Who was there, once the session has started. The mentor closes it (held, or
 * the learner did not come); the learner can only report the mentor missing,
 * which goes to the admins.
 */
export function AttendanceForm({ bookingId, side }: { bookingId: string; side: 'mentor' | 'learner' }) {
  const t = useT();
  const [state, action, pending] = useActionState(recordAttendance, undefined as SessionState);

  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      {side === 'mentor' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-primary btn-sm" name="outcome" value="held" disabled={pending}>
            {t('انعقدت الجلسة', 'The session took place')}
          </button>
          <button className="btn btn-ghost btn-sm" name="outcome" value="learner_absent" disabled={pending}>
            {t('لم يحضر الطالب', 'The learner did not come')}
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} name="outcome" value="mentor_absent" disabled={pending}>
          {t('لم يحضر المنتور', 'The mentor did not come')}
        </button>
      )}
      <Result state={state} />
    </form>
  );
}
