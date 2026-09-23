import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { BOOKING_STATUS, PAYMENT_STATUS, formatSlot, money } from '@/lib/booking';

import { ReceiptLink } from './ReceiptLink';
import { reviewPayment } from './actions';

export default async function AdminPaymentsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_code, booking_id, escrow_id, method_key, amount_usd, status, reference, proof_path, submitted_at, verified_at, rejection_reason, paid_currency, paid_amount, exchange_rate, info_request_ar, payer_note_ar')
    .order('submitted_at', { ascending: true, nullsFirst: false });

  const bookingIds = [...new Set((payments ?? []).map((row) => row.booking_id).filter(Boolean))] as string[];
  const escrowIds = [...new Set((payments ?? []).map((row) => row.escrow_id).filter(Boolean))] as string[];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: bookings }, { data: methods }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_code, status, scheduled_start, student_id, mentor_id, session_type_id')
      .in('id', bookingIds.length ? bookingIds : placeholder),
    supabase.from('payment_methods').select('key, name_ar, icon, reference_label_ar'),
  ]);

  // A payment now belongs to a booking or to a hold. The queue is the same one.
  const { data: escrows } = await supabase
    .from('escrows')
    .select('id, escrow_code, kind, project_id, payer_id, payee_id, amount_usd, commission_usd, net_usd, status')
    .in('id', escrowIds.length ? escrowIds : ['00000000-0000-0000-0000-000000000000']);

  const escrowById = new Map((escrows ?? []).map((row) => [row.id, row]));

  const peopleIds = [
    ...new Set([
      ...(bookings ?? []).flatMap((row) => [row.student_id, row.mentor_id]),
      ...(escrows ?? []).flatMap((row) => [row.payer_id, row.payee_id]),
    ].filter(Boolean)),
  ] as string[];

  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id')
    .in('id', peopleIds.length ? peopleIds : placeholder);

  const bookingById = new Map((bookings ?? []).map((row) => [row.id, row]));
  const methodByKey = new Map((methods ?? []).map((row) => [row.key, row]));
  const personById = new Map((people ?? []).map((row) => [row.id, row]));

  const waiting = (payments ?? []).filter((row) => row.status === 'under_review');
  const settled = (payments ?? []).filter((row) => row.status !== 'under_review');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('مراجعة المدفوعات', 'Review payments')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">{t('لوحة الإدارة', 'Admin panel')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('التحقق من الدفع لا يؤكد الجلسة — بعده يذهب الطلب إلى المنتور ليوافق. كل قرار هنا يُسجَّل في سجل التدقيق باسمك ووقته.',
             'Verifying a payment does not confirm the session — the request then goes to the mentor to accept. Every decision here is written to the audit log with your name and the time.')}
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
          {t('بانتظار التحقق', 'Awaiting verification')} ({waiting.length})
        </h3>

        {waiting.length === 0 ? (
          <p className="notice">{t('لا مدفوعات بانتظار المراجعة 🎉', 'No payments waiting 🎉')}</p>
        ) : (
          waiting.map((payment) => {
            const booking = payment.booking_id ? bookingById.get(payment.booking_id) : undefined;
            const escrow = payment.escrow_id ? escrowById.get(payment.escrow_id) : undefined;
            const student = personById.get(booking?.student_id ?? escrow?.payer_id ?? '');
            const mentor = personById.get(booking?.mentor_id ?? escrow?.payee_id ?? '');
            const method = methodByKey.get(payment.method_key);
            const when = booking ? formatSlot(booking.scheduled_start) : null;

            return (
              <article className="panel section-block" key={payment.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>
                      {method?.icon} {method?.name_ar} · <span className="eng">{money(payment.amount_usd)}</span>
                    </h3>
                    <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
                      {student?.full_name} → {mentor?.full_name}
                    </p>
                  </div>
                  <span>
                    <span className="id-chip">{payment.payment_code}</span>{' '}
                    <span className="id-chip">{booking?.booking_code ?? escrow?.escrow_code}</span>
                  </span>
                </div>

                <div className="summary-rows" style={{ marginTop: 14 }}>
                  {booking && (
                    <div className="summary-row">
                      <span className="muted">{t('موعد الجلسة', 'Session time')}</span>
                      <span>{when ? `${when.date} · ${when.time}` : '—'}</span>
                    </div>
                  )}
                  {escrow && (
                    <div className="summary-row">
                      <span className="muted">{t('نوع الدفع', 'What this is')}</span>
                      <span>
                        {escrow.kind === 'project_sale'
                          ? t('شراء مشروع جاهز', 'Buying finished work')
                          : t('حجز مالي لعمل عبر السوق', 'A hold for market work')}
                        {' · '}
                        <span className="eng">{money(escrow.commission_usd)} {t('عمولة', 'commission')}</span>
                      </span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="muted">{method?.reference_label_ar ?? t('المرجع', 'Reference')}</span>
                    <span className="eng">{payment.reference ?? '—'}</span>
                  </div>
                  {payment.paid_currency !== 'USD' && payment.paid_amount && (
                    <div className="summary-row">
                      <span className="muted">{t('ما أُرسل فعلاً', 'Actually sent')}</span>
                      <span className="eng">
                        {payment.paid_amount} {payment.paid_currency} @ {payment.exchange_rate}
                        {' ≈ '}{money(Number(payment.paid_amount) / Number(payment.exchange_rate))}
                      </span>
                    </div>
                  )}
                  {payment.payer_note_ar && (
                    <div className="summary-row">
                      <span className="muted">{t('جواب الدافع', 'Payer’s answer')}</span>
                      <span>{payment.payer_note_ar}</span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="muted">{t('أُرسل في', 'Sent on')}</span>
                    <span className="eng">
                      {payment.submitted_at ? new Date(payment.submitted_at).toLocaleString('ar-EG') : '—'}
                    </span>
                  </div>
                  {booking && (
                    <div className="summary-row">
                      <span className="muted">{t('حالة الحجز', 'Booking status')}</span>
                      <span className={`status-pill ${BOOKING_STATUS[booking.status].className}`}>
                        {t(BOOKING_STATUS[booking.status].text)}
                      </span>
                    </div>
                  )}
                </div>

                {payment.proof_path && <ReceiptLink proofPath={payment.proof_path} />}

                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <form action={reviewPayment}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="decision" value="verify" />
                    <button className="btn btn-primary btn-sm">{t('تحقّق واعتمد', 'Verify and approve')}</button>
                  </form>
                  <form action={reviewPayment} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input name="reason" required
                           placeholder={t('سؤال أو سبب — يظهر للدافع', 'A question or a reason — the payer sees it')}
                           style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-ghost btn-sm" name="decision" value="ask">
                      {t('↩ اطلب معلومات', '↩ Ask for information')}
                    </button>
                    <button className="btn btn-ghost btn-sm" name="decision" value="reject">
                      {t('✕ رفض', '✕ Reject')}
                    </button>
                  </form>
                  <a className="btn btn-ghost btn-sm" href={`/wallet/timeline/payment/${payment.id}`}>
                    {t('السجلّ', 'Timeline')}
                  </a>
                </div>
              </article>
            );
          })
        )}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('سجلّ المدفوعات', 'Payment history')}</h3>
          <table className="data">
            <thead>
              <tr><th>{t('الحجز', 'Booking')}</th><th>{t('الطالب', 'Student')}</th><th>{t('الطريقة', 'Method')}</th><th>{t('المبلغ', 'Amount')}</th><th>{t('الحالة', 'Status')}</th><th>{t('تاريخ المراجعة', 'Reviewed')}</th></tr>
            </thead>
            <tbody>
              {settled.map((payment) => {
                const booking = payment.booking_id ? bookingById.get(payment.booking_id) : undefined;
                const escrow = payment.escrow_id ? escrowById.get(payment.escrow_id) : undefined;
                return (
                  <tr key={payment.id}>
                    <td className="eng">{booking?.booking_code ?? escrow?.escrow_code ?? '—'}</td>
                    <td>{personById.get(booking?.student_id ?? escrow?.payer_id ?? '')?.full_name ?? '—'}</td>
                    <td>{methodByKey.get(payment.method_key)?.name_ar}</td>
                    <td className="eng">{money(payment.amount_usd)}</td>
                    <td>
                      <span className={`status-pill ${PAYMENT_STATUS[payment.status].className}`}>
                        {t(PAYMENT_STATUS[payment.status].text)}
                      </span>
                    </td>
                    <td className="eng">
                      {payment.verified_at ? new Date(payment.verified_at).toLocaleDateString('ar-EG') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
