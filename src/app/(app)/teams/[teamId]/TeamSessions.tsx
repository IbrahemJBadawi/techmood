import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { cancelTeamSession } from '../actions';
import { MeetingForm } from './calendar/MeetingForm';

const DAY_MS = 86400000;

function dayInPalestine(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE }).format(new Date(iso));
}

/**
 * The team's free sessions (0113): two a week for the team's own members, at
 * least three days apart, booked by the leader. Everybody in the team sees
 * what is coming and walks into the room from here; the leader also books and
 * calls off. The rules are the database's — this only shows them.
 */
export async function TeamSessions({ teamId, isLeader }: { teamId: string; isLeader: boolean }) {
  const t = await getT();
  const supabase = await createClient();

  const [{ data: weeks }, { data: sessions }] = await Promise.all([
    supabase.rpc('team_session_allowance', { p_team: teamId }),
    supabase
      .from('video_sessions')
      .select('id, session_code, start_at, end_at, status')
      .eq('team_id', teamId)
      .eq('session_type', 'team_internal')
      .neq('status', 'cancelled')
      .gte('end_at', new Date().toISOString())
      .order('start_at'),
  ]);

  // Days a new session cannot take: within two days of one already booked.
  const blocked = new Set<string>();
  for (const session of sessions ?? []) {
    const day = new Date(`${dayInPalestine(session.start_at)}T12:00:00Z`).getTime();
    for (let offset = -2; offset <= 2; offset += 1) {
      blocked.add(new Date(day + offset * DAY_MS).toISOString().slice(0, 10));
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString('ar-EG-u-nu-latn', {
    timeZone: PLATFORM_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  return (
    <section className="panel section-block team-sessions">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: '0.98rem' }}>{t('جلسات الفريق المجانية', 'Free team sessions')}</h3>
        <div className="tags-row">
          {(weeks ?? []).map((week, index) => (
            <span className={`status-pill ${week.remaining > 0 ? 'status-ok' : 'status-muted'}`} key={week.week_start}>
              {index === 0 ? t('هذا الأسبوع', 'This week') : t('الأسبوع القادم', 'Next week')}
              {': '}
              {t(`${week.remaining} من 2 متاحة`, `${week.remaining} of 2 left`)}
            </span>
          ))}
        </div>
      </div>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6, maxWidth: '68ch' }}>
        {t('جلستان في الأسبوع لأعضاء الفريق فقط، وبين الجلسة والأخرى ثلاثة أيام على الأقل. يحجزها قائد الفريق، وتصل الأعضاء دعوة بها.',
           'Two sessions a week, for the team’s members only, with at least three days between them. The team leader books them, and the members are invited.')}
      </p>

      {(sessions ?? []).length > 0 ? (
        <ul className="ts-list">
          {(sessions ?? []).map((session) => (
            <li key={session.id}>
              <div>
                <strong>{when(session.start_at)}</strong>
                <span className="muted">
                  {' · '}
                  {Math.round((new Date(session.end_at).getTime() - new Date(session.start_at).getTime()) / 60000)}
                  {' '}{t('دقيقة', 'min')}
                  {session.status === 'live' && <> · <span className="status-pill status-ok">{t('جارية الآن', 'Live now')}</span></>}
                </span>
              </div>
              <div className="ts-actions">
                <Link className="btn btn-primary btn-sm" href={`/sessions/${session.id}`}>{t('الغرفة', 'The room')}</Link>
                {isLeader && session.status === 'scheduled' && new Date(session.start_at) > new Date() && (
                  <form action={cancelTeamSession}>
                    <input type="hidden" name="team_id" value={teamId} />
                    <input type="hidden" name="session_id" value={session.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">{t('إلغاء', 'Call off')}</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice" style={{ marginTop: 10 }}>
          {isLeader
            ? t('لا جلسات قادمة — احجز جلسة للفريق من هنا.', 'No sessions coming — book one for the team below.')
            : t('لا جلسات قادمة. يحجزها قائد الفريق.', 'No sessions coming. The team leader books them.')}
        </p>
      )}

      {isLeader && <MeetingForm teamId={teamId} blockedDays={[...blocked]} />}
    </section>
  );
}
