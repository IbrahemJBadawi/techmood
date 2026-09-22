'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { addMentorshipGoal, closeMentorshipGoal, linkSessionToGoal, type GoalState } from './actions';

export function AddGoalForm({ mentors }: { mentors: { id: string; name: string }[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    addMentorshipGoal, undefined,
  );

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('أضف هدفاً', 'Add a goal')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('ما الذي تريد أن تخرج به من الإرشاد؟ الجلسات بعدها تُحسب على هذا الهدف.',
           'What do you want to come out of mentoring with? Sessions after this count towards it.')}
      </p>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="title">{t('الهدف', 'The goal')}</label>
        <input id="title" name="title" required minLength={2}
               placeholder={t('أتقن مراجعة الكود', 'Get confident at code review')} />
      </div>

      <div className="field">
        <label htmlFor="detail">{t('لماذا؟', 'Why?')}</label>
        <textarea id="detail" name="detail" rows={2} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="mentor_id">{t('مع منتور', 'With a mentor')}</label>
          <select id="mentor_id" name="mentor_id" defaultValue="">
            <option value="">{t('لم أختر بعد', 'Not decided yet')}</option>
            {mentors.map((mentor) => (
              <option value={mentor.id} key={mentor.id}>{mentor.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="target_on">{t('بحلول', 'By')}</label>
          <input id="target_on" name="target_on" type="date" />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Saving…') : t('أضف', 'Add')}
      </button>
    </form>
  );
}

/** Closing a goal asks for the answer, because "did it work" is the point. */
export function CloseGoalForm({ goalId }: { goalId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    closeMentorshipGoal, undefined,
  );

  return (
    <form action={formAction} className="goal-close">
      <input type="hidden" name="goal_id" value={goalId} />
      <select name="status" defaultValue="achieved" aria-label={t('النتيجة', 'Outcome')}>
        <option value="achieved">{t('تحقّق', 'Achieved')}</option>
        <option value="dropped">{t('توقّفت عنه', 'Dropped it')}</option>
      </select>
      <input name="outcome" placeholder={t('ماذا حدث؟', 'What happened?')} />
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {t('أغلق', 'Close')}
      </button>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </form>
  );
}

export function LinkSessionForm({
  bookings, goals,
}: {
  bookings: { id: string; label: string }[];
  goals: { id: string; title: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    linkSessionToGoal, undefined,
  );

  if (bookings.length === 0 || goals.length === 0) return null;

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('اربط جلسة بهدف', 'Link a session to a goal')}</h3>
      <div className="field-row" style={{ marginTop: 10 }}>
        <div className="field">
          <label htmlFor="booking_id">{t('الجلسة', 'Session')}</label>
          <select id="booking_id" name="booking_id" required>
            {bookings.map((booking) => (
              <option value={booking.id} key={booking.id}>{booking.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="goal_id">{t('الهدف', 'Goal')}</label>
          <select id="goal_id" name="goal_id" required>
            {goals.map((goal) => (
              <option value={goal.id} key={goal.id}>{goal.title}</option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {t('اربط', 'Link')}
      </button>
    </form>
  );
}
