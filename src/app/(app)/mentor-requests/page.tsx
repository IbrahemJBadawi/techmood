import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { formatSlot, money } from '@/lib/booking';
import { getT } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';

import { decideBooking } from './actions';

export default async function MentorRequestsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isMentor } = await supabase.rpc('is_mentor');
  if (isMentor !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمنتورز المعتمدين.', 'This page is for approved mentors.')}</p>;
  }

  // Only bookings whose payment TechMood already verified reach a mentor.
  const { data: requests } = await supabase
    .from('bookings')
    .select('id, booking_code, status, scheduled_start, scheduled_end, price_usd, mentor_share_usd, session_goal_ar, session_type_id, student_id')
    .eq('mentor_id', user.id)
    .in('status', ['mentor_pending', 'confirmed'])
    .order('scheduled_start');

  const studentIds = [...new Set((requests ?? []).map((row) => row.student_id).filter(Boolean))] as string[];
  const typeIds = [...new Set((requests ?? []).map((row) => row.session_type_id).filter(Boolean))] as string[];
  const bookingIds = (requests ?? []).map((row) => row.id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: students }, { data: types }, { data: items }, { data: xp }, { data: stars }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id, headline, github_url, linkedin_url').in('id', studentIds.length ? studentIds : placeholder),
    supabase.from('session_types').select('id, name_ar, name_en, duration_minutes').in('id', typeIds.length ? typeIds : placeholder),
    supabase.from('booking_review_items').select('booking_id, label_ar').in('booking_id', bookingIds.length ? bookingIds : placeholder),
    supabase.from('profile_xp').select('profile_id, total_xp').in('profile_id', studentIds.length ? studentIds : placeholder),
    supabase.from('profile_stars').select('profile_id, stars_avg').in('profile_id', studentIds.length ? studentIds : placeholder),
  ]);

  const studentById = new Map((students ?? []).map((row) => [row.id, row]));
  const typeById = new Map((types ?? []).map((row) => [row.id, row]));
  const xpById = new Map((xp ?? []).map((row) => [row.profile_id, row.total_xp]));
  const starsById = new Map((stars ?? []).map((row) => [row.profile_id, row.stars_avg]));

  // Confirming a booking opens its room; the mentor enters it the same way the
  // learner does, from their account and at its time.
  const { data: rooms } = bookingIds.length
    ? await supabase.from('video_sessions').select('id, booking_id').in('booking_id', bookingIds)
    : { data: [] as { id: string; booking_id: string | null }[] };
  const roomOf = new Map((rooms ?? []).map((room) => [room.booking_id ?? '', room.id]));

  const pending = (requests ?? []).filter((row) => row.status === 'mentor_pending');
  const confirmed = (requests ?? []).filter((row) => row.status === 'confirmed');

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('طلبات الجلسات', 'Session requests')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('كل طلب هنا تم التحقق من دفعه بالفعل. موافقتك هي الشرط الثاني والأخير لتأكيد الجلسة.', 'Every request here has already had its payment verified. Your acceptance is the second and final condition.')}
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{pending.length}</div>
            <div className="lbl">{t('بانتظار قرارك', 'Awaiting your decision')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{confirmed.length}</div>
            <div className="lbl">{t('جلسات مؤكدة', 'Confirmed sessions')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">
              {money(pending.reduce((sum, row) => sum + Number(row.mentor_share_usd), 0))}
            </div>
            <div className="lbl">{t('حصتك من الطلبات المعلّقة', 'Your share of the pending requests')}</div>
          </div>
        </div>
      </section>

      {pending.length === 0 ? (
        <p className="notice">{t('لا طلبات بانتظار قرارك.', 'Nothing waiting on you.')}</p>
      ) : (
        pending.map((request) => {
          const student = studentById.get(request.student_id ?? '');
          const type = typeById.get(request.session_type_id ?? '');
          const when = formatSlot(request.scheduled_start);
          const reviewItems = (items ?? []).filter((item) => item.booking_id === request.id);

          return (
            <article className="panel section-block" key={request.id}>
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>{contentText(t.locale, type?.name_ar ?? null, type?.name_en) || t('جلسة إرشاد', 'Mentoring session')}</h3>
                  <p className="muted" style={{ fontSize: '0.86rem', marginTop: 4 }}>
                    {when.date} · <span className="eng">{when.time}</span> ·{' '}
                    <span className="eng">{type?.duration_minutes ?? 60} min</span>
                  </p>
                </div>
                <span className="badge-pill eng">{t('حصتك ', 'Your share ')}{money(request.mentor_share_usd)}</span>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
                <div className="row-between">
                  <strong style={{ fontSize: '0.92rem' }}>{student?.full_name}</strong>
                  <span className="id-chip">{student?.techmood_id}</span>
                </div>
                <div className="tags-row" style={{ marginTop: 8, alignItems: 'center' }}>
                  <Stars value={starsById.get(request.student_id ?? '') ?? 0} />
                  <span className="xp-badge eng">{xpById.get(request.student_id ?? '') ?? 0} XP</span>
                  {student?.github_url && (
                    <a className="badge-pill eng" href={student.github_url} target="_blank" rel="noreferrer noopener">GitHub ↗</a>
                  )}
                </div>
              </div>

              {request.session_goal_ar && (
                <div style={{ marginTop: 14 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>{t('ما يحتاجه الطالب', 'What the student needs')}</p>
                  <p style={{ fontSize: '0.88rem' }}>{request.session_goal_ar}</p>
                </div>
              )}

              {reviewItems.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>{t('طلب مراجعة', 'Review requested')}</p>
                  <div className="tags-row">
                    {reviewItems.map((item, index) => (
                      <span className="badge-pill" key={`${item.booking_id}-${index}`}>{item.label_ar}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <form action={decideBooking}>
                  <input type="hidden" name="booking_id" value={request.id} />
                  <input type="hidden" name="decision" value="accept" />
                  <button className="btn btn-primary btn-sm">{t('قبول الجلسة', 'Accept the session')}</button>
                </form>
                <form action={decideBooking} style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <input type="hidden" name="booking_id" value={request.id} />
                  <input type="hidden" name="decision" value="decline" />
                  <input name="reason" placeholder={t('سبب الاعتذار (اختياري)', 'Why you are declining (optional)')} style={{ flex: 1, minWidth: 0 }} />
                  <button className="btn btn-ghost btn-sm">{t('اعتذار', 'Decline')}</button>
                </form>
              </div>
            </article>
          );
        })
      )}

      {confirmed.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('جلساتك المؤكدة', 'Your confirmed sessions')}</h3>
          <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
            {t('ضع رابط اللقاء لكل جلسة — يراه الطالب في صفحته الرئيسية وتصله رسالة به.', 'Add the meeting link for each session — the student sees it on their home page and gets a notification.')}
          </p>
          <div className="stack">
            {confirmed.map((row) => {
              const when = formatSlot(row.scheduled_start);
              return (
                <article className="panel session-row" key={row.id}>
                  <div>
                    <strong>{studentById.get(row.student_id ?? '')?.full_name}</strong>
                    <p className="muted" style={{ fontSize: '0.84rem' }}>
                      {typeById.get(row.session_type_id ?? '')?.name_ar} · {when.date} ·{' '}
                      <span className="eng">{when.time}</span> ·{' '}
                      <span className="eng">{money(row.mentor_share_usd)}</span>
                    </p>
                  </div>

                  {roomOf.get(row.id) && (
                    <Link className="btn btn-primary btn-sm" href={`/sessions/${roomOf.get(row.id)}`}>
                      {t('غرفة الجلسة', 'Session room')}
                    </Link>
                  )}

                  <Link className="btn btn-ghost btn-sm" href={`/bookings/${row.id}`}>{t('التفاصيل', 'Details')}</Link>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
