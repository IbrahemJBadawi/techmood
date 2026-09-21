import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime, type Text } from '@/lib/i18n';
import type { Database, SessionPhase, VideoSessionType } from '@/lib/database.types';

type Session = Database['public']['Functions']['my_sessions']['Returns'][number];

const TYPE_LABEL: Record<VideoSessionType, Text> = {
  student_mentor: { ar: 'جلسة مع منتور',      en: 'Mentor session' },
  team_mentor:    { ar: 'جلسة فريق مع منتور', en: 'Team session with a mentor' },
  team_internal:  { ar: 'اجتماع فريق داخلي',  en: 'Internal team meeting' },
};

const PHASE: Record<SessionPhase, { text: Text; className: string }> = {
  waiting: { text: { ar: '🔒 لم يفتح بعد', en: '🔒 Not open yet' },   className: 'status-muted' },
  lobby:   { text: { ar: '🟡 الغرفة مفتوحة', en: '🟡 Lobby open' },    className: 'status-pending' },
  live:    { text: { ar: '🟢 جارية الآن',    en: '🟢 Live now' },      className: 'status-ok' },
  ended:   { text: { ar: '✓ انتهت',          en: '✓ Ended' },         className: 'status-muted' },
};

/**
 * Every call this person has, ahead and behind.
 *
 * A session is not a link somebody was sent: it exists because a booking was
 * confirmed or a team scheduled its own hour, and it appears here for the
 * people it was booked for. The state on each row is the server's, not the
 * browser's — which is why the button changes on its own.
 */
export default async function SessionsPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase.rpc('my_sessions', { p_past: false }),
    supabase.rpc('my_sessions', { p_past: true }),
  ]);

  const row = (session: Session, isPast: boolean) => (
    <article className="panel session-row" key={session.id}>
      <div>
        <p className="kicker">{t(TYPE_LABEL[session.session_type])}</p>
        <h3 style={{ fontSize: '1rem', margin: '4px 0' }}>
          {session.counterpart ?? t('جلسة', 'Session')}
        </h3>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {formatDateTime(locale, session.start_at)}
          {' · '}
          {Math.round((new Date(session.end_at).getTime() - new Date(session.start_at).getTime()) / 60000)} min
          {session.participants > 2 && ` · ${session.participants} ${t('مشاركين', 'participants')}`}
        </p>
      </div>

      <div className="session-row-actions">
        <span className={`status-pill ${PHASE[session.phase].className}`}>{t(PHASE[session.phase].text)}</span>
        {!isPast && session.phase !== 'ended' && (
          <Link
            className={`btn btn-sm ${session.phase === 'waiting' ? 'btn-ghost' : 'btn-primary'}`}
            href={`/sessions/${session.id}`}
          >
            {session.phase === 'waiting'
              ? t('التفاصيل', 'Details')
              : session.phase === 'lobby'
                ? t('ادخل الغرفة', 'Enter the lobby')
                : t('انضم للمكالمة', 'Join the call')}
          </Link>
        )}
        {isPast && (
          <Link className="btn btn-ghost btn-sm" href={`/sessions/${session.id}`}>
            {t('ملخّص الجلسة', 'Session summary')}
          </Link>
        )}
      </div>
    </article>
  );

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('جلساتي', 'My sessions')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('كل مكالمة هنا لها سبب: حجز مؤكد أو اجتماع حجزه فريقك. لا يوجد رابط اجتماع عام يمكن إرساله لأحد — الدخول من حسابك، وفي وقته.',
             'Every call here has a reason: a confirmed booking, or an hour your team set aside. There is no public meeting link to forward — you enter from your account, at its time.')}
        </p>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('قادمة', 'Ahead')}</h3>
        {(upcoming ?? []).length === 0 ? (
          <div className="panel empty-state">
            <h3 style={{ fontSize: '0.98rem' }}>{t('لا جلسات قادمة', 'Nothing booked')}</h3>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              {t('احجز جلسة مع منتور، أو رتّب اجتماعاً لفريقك.',
                 'Book a session with a mentor, or set an hour aside with your team.')}
            </p>
            <Link className="btn btn-primary btn-sm" href="/mentors">{t('تصفّح المنتورين', 'Browse mentors')}</Link>
          </div>
        ) : (
          <div className="stack">{(upcoming ?? []).map((session) => row(session, false))}</div>
        )}
      </section>

      {(past ?? []).length > 0 && (
        <section className="section-block">
          <h3 className="academy-heading">{t('سجل الجلسات', 'Session history')}</h3>
          <div className="stack">{(past ?? []).map((session) => row(session, true))}</div>
        </section>
      )}
    </>
  );
}
