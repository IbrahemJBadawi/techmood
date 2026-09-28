import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { contentText, formatDate } from '@/lib/i18n';
import { BOOKING_STATUS, BOOKING_TIMELINE, PAYMENT_STATUS, formatSlot, money } from '@/lib/booking';
import { IS_MVP } from '@/lib/scope';
import { OF_LEARNER, OF_MENTOR } from '@/lib/criteria';

import { cancelBooking } from '../actions';
import { RatingForm } from '../../sessions/[sessionId]/RatingForm';
import { AttendanceForm, DeclineForm, MeetingLinkForm } from './SessionPanel';

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) notFound();

  const [{ data: mentorProfile }, { data: sessionType }, { data: payment }, { data: items }, { data: events }] =
    await Promise.all([
      supabase.from('profiles').select('full_name, techmood_id').eq('id', booking.mentor_id).single(),
      booking.session_type_id
        ? supabase.from('session_types').select('name_ar, name_en, duration_minutes').eq('id', booking.session_type_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('payments')
        .select('id, method_key, amount_usd, status, reference, rejection_reason, submitted_at, verified_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('booking_review_items').select('id, item_kind, label_ar').eq('booking_id', bookingId),
      supabase.from('booking_events').select('id, event_key, note_ar, created_at').eq('booking_id', bookingId).order('created_at'),
    ]);

  const { data: method } = payment
    ? await supabase.from('payment_methods').select('name_ar, name_en, icon').eq('key', payment.method_key).maybeSingle()
    : { data: null };

  // A team session is booked for named members — those are the people the room
  // will admit, so this is who the booking is actually for.
  const { data: seats } = booking.kind === 'team_mentor'
    ? await supabase
        .from('booking_seats')
        .select('profile_id, profiles(full_name, techmood_id)')
        .eq('booking_id', bookingId)
    : { data: null };

  const { data: team } = booking.team_id
    ? await supabase.from('teams').select('title_ar').eq('id', booking.team_id).maybeSingle()
    : { data: null };

  // Confirming the booking is what opens the room. There is no link to hand
  // out: the session is entered from the account it was booked for.
  const { data: videoSession } = await supabase
    .from('video_sessions')
    .select('id, session_code')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const { data: sessionPhase } = videoSession
    ? await supabase.rpc('session_phase', { p_session: videoSession.id })
    : { data: null };

  const status = BOOKING_STATUS[booking.status];
  const when = formatSlot(booking.scheduled_start);
  const isStudent = booking.student_id === user.id;
  const isMentor = booking.mentor_id === user.id;
  const isLearner = !isMentor && (isStudent || (seats ?? []).some((seat) => seat.profile_id === user.id));

  // The MVP runs sessions on the mentor's own meeting link (0104): the link,
  // when it opens, and who says the session was held.
  const [{ data: meetingRows }, { data: serverNow }] = IS_MVP && ['confirmed', 'completed'].includes(booking.status)
    ? await Promise.all([
        booking.status === 'confirmed'
          ? supabase.rpc('booking_meeting', { p_booking: bookingId })
          : Promise.resolve({ data: null }),
        supabase.rpc('server_now'),
      ])
    : [{ data: null }, { data: null }];
  const meeting = meetingRows?.[0] ?? null;
  // On a team booking the team's leader speaks for the learners (0104).
  const { data: leadsTeam } = meeting && booking.team_id && !isMentor
    ? await supabase.rpc('is_team_leader', { p_team: booking.team_id })
    : { data: false };
  const canRecord = isMentor || isStudent || leadsTeam === true;
  const now = new Date(serverNow ?? booking.updated_at);
  const started = new Date(booking.scheduled_start) <= now;

  // Rating, a week from the end of a completed session (0095).
  const [{ data: feedback }, { data: requiresEvaluation }] =
    IS_MVP && booking.status === 'completed' && (isMentor || isLearner)
      ? await Promise.all([
          supabase.rpc('session_feedback_for', { p_booking: bookingId }),
          supabase.rpc('booking_requires_evaluation', { p_booking: bookingId }),
        ])
      : [{ data: null }, { data: false }];
  const rateBy = new Date(new Date(booking.scheduled_end).getTime() + 7 * 24 * 60 * 60 * 1000);
  const alreadyRated = (feedback ?? []).some((row) => row.from_profile === user.id);
  const canRate = feedback !== null && !alreadyRated && booking.attendance === 'held' && now <= rateBy;

  // Where the booking has reached on the fixed journey.
  const reachedIndex = BOOKING_TIMELINE.reduce(
    (last, step, index) => (step.matches.includes(booking.status) ? index : last),
    -1,
  );

  return (
    <>
      <div className="row-between">
        <Link className="btn btn-ghost btn-sm" href="/bookings">{t('→ حجوزاتي', '← My bookings')}</Link>
        <Link className="btn btn-ghost btn-sm" href={`/support/new?type=booking&id=${booking.id}&category=booking`}>
          {t('مشكلة في هذا الحجز؟', 'A problem with this booking?')}
        </Link>
      </div>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{contentText(t.locale, sessionType?.name_ar ?? null, sessionType?.name_en) || t('جلسة إرشاد', 'Mentoring session')}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
              {t('مع ', 'with ')}{mentorProfile?.full_name}
            </p>
          </div>
          <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
        </div>

        <div className="tags-row" style={{ marginTop: 14 }}>
          <span className="id-chip">{booking.booking_code}</span>
          <span className="badge-pill">{when.date}</span>
          <span className="badge-pill eng">{when.time}</span>
          <span className="badge-pill eng">{sessionType?.duration_minutes ?? 60} min</span>
        </div>

        {booking.status === 'payment_pending' && isStudent && (
          <Link className="btn btn-primary btn-sm" style={{ marginTop: 16 }} href={`/bookings/${bookingId}/pay`}>
            {t('أكمل الدفع', 'Complete payment')}
          </Link>
        )}

        {IS_MVP && booking.status === 'cancelled' && booking.cancelled_reason?.startsWith('اعتذر المنتور') && (
          <p className="notice notice-warn" style={{ marginTop: 16 }}>
            {booking.cancelled_reason}.{' '}
            {isStudent && t('سيُعاد إليك المبلغ كاملاً على حساب الاستقبال في محفظتك.',
                            'Your money will be returned in full to the receiving account in your wallet.')}
          </p>
        )}

        {IS_MVP && booking.status === 'rejected' && (
          <p className="notice notice-danger" style={{ marginTop: 16 }}>
            {t('لم يُقبل الدفع، وعاد الموعد متاحاً.', 'The payment was not accepted, and the slot is free again.')}
            {payment?.rejection_reason ? ` ${payment.rejection_reason}` : ''}
          </p>
        )}

        {IS_MVP && booking.status === 'completed' && booking.attendance === 'learner_absent' && (
          <p className="notice" style={{ marginTop: 16 }}>
            {t('سجّل المنتور أن الطالب لم يحضر هذه الجلسة.', 'The mentor recorded that the learner did not come to this session.')}
          </p>
        )}

        {booking.status === 'refunded' && (
          <p className="notice" style={{ marginTop: 16 }}>
            {t('أُعيد المبلغ لهذا الحجز.', 'This booking was refunded.')}
          </p>
        )}

        {!IS_MVP && booking.status === 'rejected' && (
          <p className="notice notice-danger" style={{ marginTop: 16 }}>
            {t('اعتذر المنتور عن هذه الجلسة.', 'The mentor declined this session.')}
            {booking.cancelled_reason ? t(` السبب: ${booking.cancelled_reason}`, ` Reason: ${booking.cancelled_reason}`) : ''}
            {' '}{t('سيراجع فريق TechMood حالة الاسترداد وفق سياسة المنصة.', 'TechMood will review the refund under the platform policy.')}
          </p>
        )}

        {booking.status === 'expired' && (
          <p className="notice" style={{ marginTop: 16 }}>
            {t('انتهت مهلة إكمال الدفع، وعاد الموعد متاحاً. يمكنك إنشاء طلب جديد في أي وقت.', 'The payment window closed and the slot is free again. You can start a new request whenever you like.')}
          </p>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('مسار الطلب', 'Request journey')}</h3>
            <ul className="timeline">
              {BOOKING_TIMELINE.map((step, index) => (
                <li
                  key={step.key}
                  className={index < reachedIndex ? 'done' : index === reachedIndex ? 'current' : ''}
                >
                  <span className="tl-dot" />
                  <span className="tl-label">{t(step.label)}</span>
                </li>
              ))}
            </ul>
          </div>

          {seats && seats.length > 0 && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>
                {t('المشاركون', 'Participants')}
                {team && <span className="muted" style={{ fontWeight: 400 }}> · {team.title_ar}</span>}
              </h3>
              <ul className="plain-list">
                {seats.map((seat) => {
                  const person = seat.profiles as unknown as { full_name: string; techmood_id: string } | null;
                  return (
                    <li className="row-between" key={seat.profile_id} style={{ fontSize: '0.88rem' }}>
                      <span>{person?.full_name ?? '—'}</span>
                      <Link className="id-chip" href={`/u/${person?.techmood_id ?? ''}`}>
                        {person?.techmood_id}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
                {t('هؤلاء هم من دُفع لهم مقاعد، وهم وحدهم من تفتح لهم الغرفة.',
                   'These are the seats that were paid for, and they are the only people the room admits.')}
              </p>
            </div>
          )}

          {booking.session_goal_ar && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('هدف الجلسة', 'Session goal')}</h3>
              <p style={{ fontSize: '0.88rem' }}>{booking.session_goal_ar}</p>

              {(items?.length ?? 0) > 0 && (
                <>
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '14px 0 8px' }}>
                    {t('عناصر طلب الطالب مراجعتها', 'What the student asked to have reviewed')}
                  </p>
                  <div className="tags-row">
                    {items!.map((item) => (
                      <span className="badge-pill" key={item.id}>{item.label_ar}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {(events?.length ?? 0) > 0 && (
            <div className="panel">
              <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('السجل', 'History')}</h3>
              <table className="data">
                <tbody>
                  {events!.map((event) => (
                    <tr key={event.id}>
                      <td className="eng" style={{ width: 110 }}>
                        {formatDate(t.locale, event.created_at)}
                      </td>
                      <td>
                        {event.event_key.startsWith('payment_')
                          ? t('الدفع: ', 'Payment: ') + (() => {
                              const key = event.event_key.replace('payment_', '') as keyof typeof PAYMENT_STATUS;
                              return PAYMENT_STATUS[key] ? t(PAYMENT_STATUS[key].text) : event.event_key;
                            })()
                          : (() => {
                              const key = event.event_key as keyof typeof BOOKING_STATUS;
                              return BOOKING_STATUS[key] ? t(BOOKING_STATUS[key].text) : event.event_key;
                            })()}
                        {event.note_ar && <span className="muted"> — {event.note_ar}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('الدفع', 'Payment')}</h3>
            {payment ? (
              <div className="summary-rows">
                <div className="summary-row">
                  <span className="muted">{t('الحالة', 'Status')}</span>
                  <span className={`status-pill ${PAYMENT_STATUS[payment.status].className}`}>
                    {t(PAYMENT_STATUS[payment.status].text)}
                  </span>
                </div>
                <div className="summary-row"><span className="muted">{t('الطريقة', 'Method')}</span><span>{method?.icon} {contentText(t.locale, method?.name_ar ?? null, method?.name_en)}</span></div>
                {payment.reference && (
                  <div className="summary-row"><span className="muted">{t('المرجع', 'Reference')}</span><span className="eng">{payment.reference}</span></div>
                )}
                <div className="summary-row total"><span>{t('المبلغ', 'Amount')}</span><span className="eng">{money(payment.amount_usd)}</span></div>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا يوجد سجل دفع.', 'No payment record.')}</p>
            )}

            {payment?.rejection_reason && (
              <p className="notice notice-danger" style={{ marginTop: 12 }}>{payment.rejection_reason}</p>
            )}

            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 12 }}>
              {IS_MVP
                ? t('حين يتحقق فريق TechMood من الدفع تتأكّد الجلسة مباشرة.', 'Once TechMood verifies the payment, the session is confirmed straight away.')
                : t('التحقق من الدفع لا يؤكد الجلسة وحده — موافقة المنتور شرط ثانٍ مستقل.', 'Verifying the payment does not confirm the session on its own — the mentor’s acceptance is a separate, second condition.')}
            </p>
          </div>

          {IS_MVP && meeting && (isMentor || isLearner) && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{t('الاجتماع', 'The meeting')}</h3>

              {isMentor ? (
                <>
                  {!meeting.has_link && (
                    <p className="notice notice-warn" style={{ marginBottom: 10 }}>
                      {t('أضف رابط الاجتماع (Google Meet أو Zoom أو غيره) — يظهر للطالب قبل الموعد بعشر دقائق.',
                         'Add the meeting link (Google Meet, Zoom or another) — the learner sees it ten minutes before the time.')}
                    </p>
                  )}
                  <MeetingLinkForm bookingId={bookingId} current={meeting.url} />
                </>
              ) : meeting.can_join && meeting.url ? (
                <a className="btn btn-primary btn-sm" href={meeting.url} target="_blank" rel="noopener noreferrer" style={{ width: '100%' }}>
                  {t('انضم للاجتماع', 'Join the meeting')}
                </a>
              ) : (
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  {!meeting.has_link
                    ? t('سيضع المنتور رابط الاجتماع قبل الموعد.', 'The mentor will add the meeting link before the time.')
                    : now < new Date(meeting.opens_at)
                      ? t('الرابط جاهز، ويظهر زر الانضمام قبل الموعد بعشر دقائق.', 'The link is ready — the Join button appears ten minutes before the time.')
                      : t('انتهى وقت الجلسة.', 'The session time is over.')}
                </p>
              )}

              {started && canRecord && !booking.attendance && (
                <div style={{ marginTop: 14 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
                    {isMentor
                      ? t('بعد الجلسة سجّل ما حدث — به تكتمل الجلسة وتصل حصتك.', 'After the session, record what happened — that completes it and releases your share.')
                      : t('إن لم يحضر المنتور أبلغنا هنا؛ يراجعه فريق TechMood ويُعاد المبلغ.', 'If the mentor did not come, tell us here — TechMood reviews it and refunds you.')}
                  </p>
                  <AttendanceForm bookingId={bookingId} side={isMentor ? 'mentor' : 'learner'} />
                </div>
              )}

              {booking.attendance === 'mentor_absent' && (
                <p className="notice notice-warn" style={{ marginTop: 12 }}>
                  {t('أُبلغ عن غياب المنتور — ينتظر مراجعة فريق TechMood.', 'The mentor was reported absent — waiting for TechMood to review it.')}
                </p>
              )}

              {isMentor && !started && (
                <div style={{ marginTop: 14 }}>
                  <DeclineForm bookingId={bookingId} />
                </div>
              )}
            </div>
          )}

          {!IS_MVP && videoSession && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{t('غرفة الجلسة', 'The session room')}</h3>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                <span className="eng">{videoSession.session_code}</span>
                {' · '}
                {sessionPhase === 'waiting'
                  ? t('يفتح الباب قبل الموعد بخمس دقائق.', 'The door opens five minutes before the time.')
                  : sessionPhase === 'ended'
                    ? t('انتهت — الملخّص والتقييم بالداخل.', 'Over — the summary and the rating are inside.')
                    : t('الباب مفتوح الآن.', 'The door is open now.')}
              </p>
              <Link className={`btn btn-sm ${sessionPhase === 'lobby' || sessionPhase === 'live' ? 'btn-primary' : 'btn-ghost'}`}
                    href={`/sessions/${videoSession.id}`} style={{ width: '100%' }}>
                {sessionPhase === 'ended' ? t('ملخّص الجلسة', 'Session summary') : t('ادخل الجلسة', 'Enter the session')}
              </Link>
              <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
                {t('الدخول من حسابك ومن المشاركين المحجوزين فقط — لا يوجد رابط يمكن إرساله لأحد.',
                   'Entry is from your own account, and only for the people the session was booked for — there is no link to forward.')}
              </p>
            </div>
          )}

          {canRate && (
            <RatingForm
              bookingId={bookingId}
              criteria={isMentor ? OF_LEARNER : OF_MENTOR}
              revalidate={`/bookings/${bookingId}`}
              reviewOwed={isMentor && requiresEvaluation === true}
              dueAt={rateBy.toISOString()}
            />
          )}

          {isStudent && ['payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending'].includes(booking.status) && (
            <form action={cancelBooking} className="panel">
              <input type="hidden" name="booking_id" value={bookingId} />
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}>{t('إلغاء الطلب', 'Cancel the request')}</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
