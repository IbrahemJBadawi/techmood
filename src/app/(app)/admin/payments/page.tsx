import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { BOOKING_STATUS, PAYMENT_STATUS, formatSlot, money } from '@/lib/booking';

import { ReceiptLink } from './ReceiptLink';
import { reviewPayment } from './actions';

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">هذه الصفحة للمشرفين فقط.</p>;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('id, booking_id, method_key, amount_usd, status, reference, proof_path, submitted_at, verified_at, rejection_reason')
    .order('submitted_at', { ascending: true, nullsFirst: false });

  const bookingIds = [...new Set((payments ?? []).map((row) => row.booking_id))];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: bookings }, { data: methods }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_code, status, scheduled_start, student_id, mentor_id, session_type_id')
      .in('id', bookingIds.length ? bookingIds : placeholder),
    supabase.from('payment_methods').select('key, name_ar, icon, reference_label_ar'),
  ]);

  const peopleIds = [
    ...new Set((bookings ?? []).flatMap((row) => [row.student_id, row.mentor_id].filter(Boolean))),
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
          <h2 style={{ fontSize: '1.2rem' }}>مراجعة المدفوعات</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">لوحة الإدارة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          التحقق من الدفع لا يؤكد الجلسة — بعده يذهب الطلب إلى المنتور ليوافق. كل قرار هنا
          يُسجَّل في سجل التدقيق باسمك ووقته.
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
          بانتظار التحقق ({waiting.length})
        </h3>

        {waiting.length === 0 ? (
          <p className="notice">لا مدفوعات بانتظار المراجعة 🎉</p>
        ) : (
          waiting.map((payment) => {
            const booking = bookingById.get(payment.booking_id);
            const student = personById.get(booking?.student_id ?? '');
            const mentor = personById.get(booking?.mentor_id ?? '');
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
                  <span className="id-chip">{booking?.booking_code}</span>
                </div>

                <div className="summary-rows" style={{ marginTop: 14 }}>
                  <div className="summary-row">
                    <span className="muted">موعد الجلسة</span>
                    <span>{when ? `${when.date} · ${when.time}` : '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span className="muted">{method?.reference_label_ar ?? 'المرجع'}</span>
                    <span className="eng">{payment.reference ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span className="muted">أُرسل في</span>
                    <span className="eng">
                      {payment.submitted_at ? new Date(payment.submitted_at).toLocaleString('ar-EG') : '—'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="muted">حالة الحجز</span>
                    <span className={`status-pill ${BOOKING_STATUS[booking?.status ?? 'payment_submitted'].className}`}>
                      {BOOKING_STATUS[booking?.status ?? 'payment_submitted'].text}
                    </span>
                  </div>
                </div>

                {payment.proof_path && <ReceiptLink proofPath={payment.proof_path} />}

                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <form action={reviewPayment}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="decision" value="verify" />
                    <button className="btn btn-primary btn-sm">تحقّق واعتمد</button>
                  </form>
                  <form action={reviewPayment} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="reason" required placeholder="سبب الرفض — يظهر للطالب" style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-ghost btn-sm">رفض</button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>سجلّ المدفوعات</h3>
          <table className="data">
            <thead>
              <tr><th>الحجز</th><th>الطالب</th><th>الطريقة</th><th>المبلغ</th><th>الحالة</th><th>تاريخ المراجعة</th></tr>
            </thead>
            <tbody>
              {settled.map((payment) => {
                const booking = bookingById.get(payment.booking_id);
                return (
                  <tr key={payment.id}>
                    <td className="eng">{booking?.booking_code}</td>
                    <td>{personById.get(booking?.student_id ?? '')?.full_name ?? '—'}</td>
                    <td>{methodByKey.get(payment.method_key)?.name_ar}</td>
                    <td className="eng">{money(payment.amount_usd)}</td>
                    <td>
                      <span className={`status-pill ${PAYMENT_STATUS[payment.status].className}`}>
                        {PAYMENT_STATUS[payment.status].text}
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
