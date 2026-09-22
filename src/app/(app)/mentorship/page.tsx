import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, formatDateTime, type Text } from '@/lib/i18n';
import type { MentorshipGoalStatus } from '@/lib/database.types';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';

import { AddGoalForm, CloseGoalForm, LinkSessionForm } from './GoalForms';

export const metadata = { title: 'Mentorship — TechMood' };

const GOAL_STATUS: Record<MentorshipGoalStatus, { label: Text; className: string }> = {
  active:   { label: { ar: 'مفتوح',     en: 'Open' },      className: 'status-pending' },
  achieved: { label: { ar: 'تحقّق',      en: 'Achieved' },  className: 'status-ok' },
  dropped:  { label: { ar: 'توقّف',      en: 'Dropped' },   className: 'status-muted' },
};

/**
 * The mentee's journey.
 *
 * The sessions, the payments, the room and the two-way rating all existed —
 * what did not was the thread between them. Without a goal, three sessions with
 * three mentors are three receipts; with one, they are an attempt at something,
 * and the person can say at the end whether it worked.
 */
export default async function MentorshipPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: overview }, { data: journey }, { data: sessions }] = await Promise.all([
    supabase.rpc('mentee_overview'),
    supabase.rpc('my_mentorship'),
    supabase
      .from('bookings')
      .select('id, mentor_id, scheduled_start, status, topic_ar, mentorship_goal_id')
      .eq('student_id', user.id)
      .in('status', ['confirmed', 'completed'])
      .order('scheduled_start', { ascending: false })
      .limit(30),
  ]);

  const m = overview?.[0];
  const goals = journey ?? [];
  const mine = sessions ?? [];

  const mentorIds = [...new Set(mine.map((row) => row.mentor_id))];
  const { data: mentorProfiles } = mentorIds.length
    ? await supabase.from('profiles').select('id, full_name, display_name').in('id', mentorIds)
    : { data: [] };

  const mentorName = new Map(
    (mentorProfiles ?? []).map((row) => [row.id, row.display_name ?? row.full_name]),
  );

  const tiles = [
    { value: m?.sessions_attended ?? 0, label: t('جلسات حضرتها', 'Sessions attended') },
    { value: m?.mentors ?? 0, label: t('منتورز', 'Mentors') },
    { value: m?.hours ?? 0, label: t('ساعات', 'Hours') },
    { value: m?.goals_achieved ?? 0, label: t('أهداف تحقّقت', 'Goals achieved') },
  ];

  const upcoming = mine.filter((row) => row.status === 'confirmed');

  return (
    <>
      <AiSurface surface="mentor" scope="profile" />

      <section className="section-block">
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('رحلتي في الإرشاد', 'My mentorship journey')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
              {t('الإرشاد ليس مكالمة تُحجز. هو هدف تختاره، منتور يساعدك عليه، جلسات تُحسب عليه، وجواب في النهاية: هل تحقّق؟',
                 'Mentoring is not a call you book. It is a goal you choose, a mentor who helps with it, sessions that count towards it — and an answer at the end: did it happen?')}
            </p>
          </div>
          <div className="row-actions">
            <AskAI prompt="بالنظر إلى أهدافي في الإرشاد، ما الأسئلة التي أطرحها في الجلسة القادمة؟" />
            <Link className="btn btn-primary btn-sm" href="/mentors">
              {t('ابحث عن منتور', 'Find a mentor')}
            </Link>
          </div>
        </div>

        <div className="stat-tiles" style={{ marginTop: 16 }}>
          {tiles.map((tile) => (
            <div className="stat-tile" key={tile.label}>
              <div className="val eng">{tile.value}</div>
              <div className="lbl">{tile.label}</div>
            </div>
          ))}
        </div>

        {m?.rating_received != null && (
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 12 }}>
            {t('ما قاله المنتورز عنك كمتدرّب: ', 'What mentors said about you as a mentee: ')}
            <span className="eng">{Number(m.rating_received).toFixed(2)}</span>
            {t(' من 5 — التقييم متبادل هنا، وهو جزء من سمعتك.',
               ' out of 5 — rating goes both ways here, and it is part of your reputation.')}
          </p>
        )}

        {(m?.awaiting_rating ?? 0) > 0 && (
          <p className="notice" style={{ marginTop: 12 }}>
            {t(`${m?.awaiting_rating} جلسة تنتظر تقييمك. التقييم يبقى مغلقاً حتى يكتب الطرفان.`,
               `${m?.awaiting_rating} session(s) waiting on your rating. Ratings stay sealed until both sides write.`)}
            {' '}
            <Link href="/sessions">{t('افتح جلساتي', 'Open my sessions')}</Link>
          </p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1.05rem' }}>{t('القادم', 'Coming up')}</h3>
          <ul className="plain-list" style={{ marginTop: 10 }}>
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <strong>{mentorName.get(booking.mentor_id) ?? '—'}</strong>
                <span className="muted">
                  {' — '}{formatDateTime(locale, booking.scheduled_start)}
                  {booking.topic_ar ? ` · ${booking.topic_ar}` : ''}
                </span>
                <Link className="btn btn-ghost btn-sm" href={`/bookings/${booking.id}`}
                      style={{ marginInlineStart: 8 }}>
                  {t('التفاصيل', 'Details')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section-block">
        <h3 style={{ fontSize: '1.05rem' }}>{t('أهدافي', 'My goals')}</h3>

        {goals.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
            {t('لا أهداف بعد. اكتب واحداً قبل أن تحجز — الجلسة التي تعرف لماذا حُجزت تنتهي بشيء.',
               'No goals yet. Write one before you book — a session that knows why it was booked ends with something.')}
          </p>
        ) : (
          <ul className="goal-list" style={{ marginTop: 10 }}>
            {goals.map((goal) => (
              <li key={goal.goal_id} className={goal.status === 'active' ? '' : 'is-closed'}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <strong>{goal.title_ar}</strong>
                    {goal.detail_ar && (
                      <p className="muted" style={{ fontSize: '0.84rem', margin: '4px 0 0' }}>
                        {goal.detail_ar}
                      </p>
                    )}
                    <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
                      {goal.mentor_name && <>{t('مع ', 'with ')}{goal.mentor_name} · </>}
                      <span className="eng">{goal.sessions}</span>
                      {t(' جلسة', ' session(s)')}
                      {goal.target_on && <> · {t('بحلول ', 'by ')}{formatDate(locale, goal.target_on)}</>}
                      {goal.last_session && <> · {t('آخر جلسة ', 'last ')}{formatDate(locale, goal.last_session)}</>}
                    </p>
                    {goal.outcome_ar && (
                      <p style={{ fontSize: '0.84rem', marginTop: 6 }}>{goal.outcome_ar}</p>
                    )}
                  </div>
                  <span className={`status-pill ${GOAL_STATUS[goal.status].className}`}>
                    {t(GOAL_STATUS[goal.status].label)}
                  </span>
                </div>

                {goal.status === 'active' && <CloseGoalForm goalId={goal.goal_id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="field-row">
        <AddGoalForm
          mentors={mentorIds.map((id) => ({ id, name: mentorName.get(id) ?? id }))}
        />
        <LinkSessionForm
          bookings={mine
            .filter((row) => !row.mentorship_goal_id)
            .map((row) => ({
              id: row.id,
              label: `${mentorName.get(row.mentor_id) ?? ''} — ${formatDate(locale, row.scheduled_start)}`,
            }))}
          goals={goals
            .filter((goal) => goal.status === 'active')
            .map((goal) => ({ id: goal.goal_id, title: goal.title_ar }))}
        />
      </div>
    </>
  );
}
