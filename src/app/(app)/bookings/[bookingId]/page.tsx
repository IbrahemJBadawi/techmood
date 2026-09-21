import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { contentText, formatDate } from '@/lib/i18n';
import { BOOKING_STATUS, BOOKING_TIMELINE, PAYMENT_STATUS, formatSlot, money } from '@/lib/booking';

import { cancelBooking } from '../actions';

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

  const status = BOOKING_STATUS[booking.status];
  const when = formatSlot(booking.scheduled_start);
  const isStudent = booking.student_id === user.id;

  // Where the booking has reached on the fixed journey.
  const reachedIndex = BOOKING_TIMELINE.reduce(
    (last, step, index) => (step.matches.includes(booking.status) ? index : last),
    -1,
  );

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/bookings">{t('→ حجوزاتي', '← My bookings')}</Link>

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

        {booking.status === 'rejected' && (
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
              {t('التحقق من الدفع لا يؤكد الجلسة وحده — موافقة المنتور شرط ثانٍ مستقل.', 'Verifying the payment does not confirm the session on its own — the mentor’s acceptance is a separate, second condition.')}
            </p>
          </div>

          {booking.status === 'confirmed' && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{t('رابط اللقاء', 'Meeting link')}</h3>
              {booking.meeting_url ? (
                <a className="btn btn-primary btn-sm" href={booking.meeting_url}
                   target="_blank" rel="noreferrer noopener" style={{ width: '100%' }}>
                  {t('ادخل الجلسة', 'Join the session')}
                </a>
              ) : (
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  {t('لم يضع المنتور الرابط بعد. سيصلك إشعار فور إضافته.', 'The mentor has not added the link yet. You will be notified the moment they do.')}
                </p>
              )}
            </div>
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
