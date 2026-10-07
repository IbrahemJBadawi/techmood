'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { MentorPauseReason } from '@/lib/database.types';

import { setAccepting, type MentorFormState } from './availability-actions';
import { DateField } from '@/components/DateField';

/**
 * The mentor's own "not now".
 *
 * Off means no new request can be booked; requests already paid for still wait
 * for an answer. When the platform switched requests off because several went
 * unanswered, this says so plainly — and switching back on is the mentor's
 * decision, not a form to fill in for somebody else.
 */
export function AvailabilitySwitch({
  accepting,
  reason,
  until,
  note,
  responseHours,
  unansweredLimit,
}: {
  accepting: boolean;
  reason: MentorPauseReason | null;
  until: string | null;
  note: string | null;
  responseHours: number;
  unansweredLimit: number;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(setAccepting, undefined as MentorFormState);
  const [withDate, setWithDate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="panel section-block">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1rem' }}>{t('استقبال الطلبات', 'Taking requests')}</h3>
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4, maxWidth: '62ch' }}>
            {t(`تردّ على كل طلب مدفوع خلال ${responseHours} ساعة (أو قبل الجلسة بساعتين). الطلب الذي لا يُردّ عليه يُعتذر عنه تلقائياً ويُعاد المبلغ للطالب، وبعد ${unansweredLimit} طلبات كهذه يتوقف استقبالك حتى تعيد تفعيله.`,
               `Answer each paid request within ${responseHours} hours (or two hours before the session). An unanswered request is declined for you and the learner is refunded; after ${unansweredLimit} of those, requests stop until you switch them back on.`)}
          </p>
        </div>
        <span className={`status-pill ${accepting ? 'status-ok' : reason === 'unresponsive' ? 'status-danger' : 'status-muted'}`}>
          {accepting
            ? t('مفعّل', 'On')
            : reason === 'vacation'
              ? t('في إجازة', 'On holiday')
              : reason === 'unresponsive'
                ? t('أُوقف تلقائياً', 'Switched off automatically')
                : t('متوقف', 'Off')}
        </span>
      </div>

      {!accepting && (
        <p className={`notice ${reason === 'unresponsive' ? 'notice-danger' : ''}`} style={{ marginTop: 12 }}>
          {reason === 'unresponsive'
            ? t('أُوقف استقبالك لأن عدة طلبات انتهت مهلتها دون ردّ. فعّله متى كنت جاهزاً — تبدأ صفحة جديدة.',
                'Requests were switched off because several went unanswered. Switch them back on when you are ready — you start with a clean slate.')
            : until
              ? t(`متوقف حتى ${until}، ويعود تلقائياً بعدها.`, `Off until ${until}, then back on by itself.`)
              : t('متوقف حتى تعيد تفعيله.', 'Off until you switch it back on.')}
          {note && reason !== 'unresponsive' && <><br />{note}</>}
        </p>
      )}

      <form action={formAction} style={{ marginTop: 14 }}>
        {accepting ? (
          <>
            <input type="hidden" name="accepting" value="off" />
            <label className="switch-row">
              <input type="checkbox" checked={withDate} onChange={(event) => setWithDate(event.target.checked)} />
              {t('حتى تاريخ محدد (إجازة)', 'Until a date (holiday)')}
            </label>
            <div className="field-row" style={{ marginTop: 10 }}>
              {withDate && (
                <div className="field">
                  <label htmlFor="pause-until">{t('أعود يوم', 'Back on')}</label>
                  <DateField id="pause-until" name="until" min={today} required />
                </div>
              )}
              <div className="field">
                <label htmlFor="pause-note">{t('ملاحظة تظهر للطلاب (اختياري)', 'A note learners see (optional)')}</label>
                <input id="pause-note" name="note" maxLength={300} placeholder={t('مثال: في إجازة قصيرة', 'e.g. on a short break')} />
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" type="submit" disabled={pending} style={{ marginTop: 10 }} aria-busy={pending}>
              {pending ? t('جارٍ…', 'Working…') : t('أوقف استقبال الطلبات', 'Stop taking requests')}
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="accepting" value="on" />
            <button className="btn btn-primary btn-sm" type="submit" disabled={pending} aria-busy={pending}>
              {pending ? t('جارٍ…', 'Working…') : t('فعّل استقبال الطلبات', 'Start taking requests')}
            </button>
          </>
        )}
        {state?.error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{state.error}</p>}
        {state?.ok && <p className="notice notice-ok" style={{ marginTop: 10 }}>{state.ok}</p>}
      </form>
    </section>
  );
}
