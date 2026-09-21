import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime, type Text } from '@/lib/i18n';
import type { SessionCriterion, SessionRole, VideoSessionType } from '@/lib/database.types';

import { RatingForm } from './RatingForm';
import { Room } from './Room';

const TYPE_LABEL: Record<VideoSessionType, Text> = {
  student_mentor: { ar: 'جلسة مع منتور',      en: 'Mentor session' },
  team_mentor:    { ar: 'جلسة فريق مع منتور', en: 'Team session with a mentor' },
  team_internal:  { ar: 'اجتماع فريق داخلي',  en: 'Internal team meeting' },
};

const ROLE_LABEL: Record<SessionRole, Text> = {
  mentor:  { ar: 'منتور',       en: 'Mentor' },
  student: { ar: 'متعلّم',      en: 'Learner' },
  member:  { ar: 'عضو',         en: 'Member' },
  leader:  { ar: 'قائد الفريق', en: 'Team lead' },
};

/** What a learner or a team judges a mentor on. */
const OF_MENTOR: SessionCriterion[] =
  ['quality', 'clarity', 'usefulness', 'punctuality', 'guidance', 'communication'];

/** What a mentor judges the other side on. */
const OF_LEARNER: SessionCriterion[] =
  ['commitment', 'preparation', 'participation', 'use_of_session', 'cooperation', 'communication'];

/**
 * One session, in whichever of its four states it is in.
 *
 * Reading this page at all means being one of its participants: the row is
 * behind row-level security, so a stranger with the id gets the same answer as
 * a stranger with a wrong id — nothing. Which state is shown is the database's
 * answer too, never the browser's clock.
 */
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: session } = await supabase
    .from('video_sessions')
    .select('id, session_code, booking_id, team_id, session_type, start_at, end_at, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: phase }, { data: attendance }, { data: serverNow }] = await Promise.all([
    supabase.rpc('session_phase', { p_session: session.id }),
    supabase.rpc('session_attendance', { p_session: session.id }),
    supabase.rpc('server_now'),
  ]);

  const people = attendance ?? [];
  const me = people.find((person) => person.profile_id === user.id);
  const minutes = Math.round(
    (new Date(session.end_at).getTime() - new Date(session.start_at).getTime()) / 60000,
  );

  const header = (
    <section className="section-block">
      <p className="kicker">{t(TYPE_LABEL[session.session_type])} · {session.session_code}</p>
      <h2 style={{ fontSize: '1.2rem', marginTop: 4 }}>
        {formatDateTime(locale, session.start_at)}
      </h2>
      <p className="muted" style={{ fontSize: '0.88rem', marginTop: 4 }}>
        {minutes} {t('دقيقة', 'minutes')} · {people.length} {t('مشاركين', 'participants')}
      </p>
    </section>
  );

  // ---------------------------------------------------------------- waiting
  if (phase === 'waiting') {
    return (
      <>
        {header}
        <section className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('لم يحن الوقت بعد', 'Not time yet')}</h3>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8, maxWidth: '62ch' }}>
            {t('يفتح الباب قبل الموعد بخمس دقائق، وحينها تستطيع تجربة الكاميرا والميكروفون قبل بدء الجلسة. لا يوجد رابط يمكن إرساله لشخص خارج الجلسة.',
               'The door opens five minutes before the time, and you can check your camera and microphone there before the session starts. There is no link to send to somebody outside the session.')}
          </p>

          <ul className="plain-list" style={{ marginTop: 14 }}>
            {people.map((person) => (
              <li key={person.profile_id} className="row-between" style={{ fontSize: '0.88rem' }}>
                <span>{person.full_name}{person.profile_id === user.id && ` (${t('أنت', 'you')})`}</span>
                <span className="muted">{t(ROLE_LABEL[person.role])}</span>
              </li>
            ))}
          </ul>

          <div className="row-actions" style={{ marginTop: 16 }}>
            <Link className="btn btn-ghost btn-sm" href="/sessions">{t('كل جلساتي', 'All my sessions')}</Link>
            {session.booking_id && (
              <Link className="btn btn-ghost btn-sm" href="/bookings">{t('تفاصيل الحجز', 'Booking details')}</Link>
            )}
          </div>
        </section>
      </>
    );
  }

  // ------------------------------------------------------------ lobby / live
  if (phase === 'lobby' || phase === 'live') {
    return (
      <>
        {header}
        <Room
          sessionId={session.id}
          sessionCode={session.session_code}
          startAt={session.start_at}
          endAt={session.end_at}
          serverNow={serverNow ?? new Date().toISOString()}
          meId={user.id}
          participants={people.map((person) => ({
            profile_id: person.profile_id,
            full_name: person.full_name,
            role: person.role,
            is_present: person.is_present,
            minutes: person.minutes,
          }))}
        />
      </>
    );
  }

  // ------------------------------------------------------------------ ended
  const nobodyCame = session.status === 'no_show';
  const cancelled = session.status === 'cancelled';

  const { data: feedback } = session.booking_id
    ? await supabase.rpc('session_feedback_for', { p_booking: session.booking_id })
    : { data: [] };

  const rows = feedback ?? [];
  const mine = rows.find((row) => row.from_profile === user.id);
  const theirs = rows.find((row) => row.to_profile === user.id);

  const canRate = Boolean(session.booking_id) && !cancelled && !nobodyCame && Boolean(me) && !mine;

  return (
    <>
      {header}

      <section className="panel section-block">
        <div className="row-between">
          <h3 style={{ fontSize: '1rem' }}>{t('ملخّص الجلسة', 'Session summary')}</h3>
          <span className={`status-pill ${nobodyCame || cancelled ? 'status-muted' : 'status-ok'}`}>
            {cancelled
              ? t('ملغاة', 'Cancelled')
              : nobodyCame
                ? t('لم يحضر أحد', 'Nobody came')
                : t('انتهت', 'Completed')}
          </span>
        </div>

        <table className="data" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>{t('المشارك', 'Participant')}</th>
              <th>{t('الدور', 'Role')}</th>
              <th>{t('دخل', 'Entered')}</th>
              <th>{t('الحضور', 'Present for')}</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.profile_id}>
                <td>{person.full_name}{person.profile_id === user.id && ` (${t('أنت', 'you')})`}</td>
                <td className="muted">{t(ROLE_LABEL[person.role])}</td>
                <td className="muted">
                  {person.first_joined ? formatDateTime(locale, person.first_joined) : '—'}
                  {person.entries > 1 && ` · ${person.entries}×`}
                </td>
                <td>{person.minutes} {t('د', 'min')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
          {t('الحضور محسوب من سجلّ الدخول والخروج، لا من إعلان أحد أنه كان موجوداً.',
             'Attendance is counted from the log of entries and exits, not from anybody saying they were there.')}
        </p>
      </section>

      {canRate && session.booking_id && (
        <RatingForm
          bookingId={session.booking_id}
          criteria={me?.role === 'mentor' ? OF_LEARNER : OF_MENTOR}
          revalidate={`/sessions/${session.id}`}
        />
      )}

      {mine && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem' }}>{t('تقييمك', 'Your rating')}</h3>
          <p style={{ marginTop: 6 }}><Stars value={mine.stars} /></p>
          {mine.comment_ar && <p className="muted" style={{ fontSize: '0.86rem' }}>{mine.comment_ar}</p>}
        </section>
      )}

      {mine && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem' }}>{t('تقييم الطرف الآخر', 'What the other side wrote')}</h3>
          {theirs ? (
            <>
              <p style={{ marginTop: 6 }}><Stars value={theirs.stars} /> <span className="muted">— {theirs.from_name}</span></p>
              {theirs.comment_ar && <p className="muted" style={{ fontSize: '0.86rem' }}>{theirs.comment_ar}</p>}
            </>
          ) : (
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
              {t('مغلق حتى يكتب الطرف الآخر تقييمه، أو حتى تنتهي مهلة الأسبوع.',
                 'Sealed until the other side writes theirs, or the week to write in has passed.')}
            </p>
          )}
        </section>
      )}

      <div className="row-actions">
        <Link className="btn btn-ghost btn-sm" href="/sessions">{t('كل جلساتي', 'All my sessions')}</Link>
      </div>
    </>
  );
}
