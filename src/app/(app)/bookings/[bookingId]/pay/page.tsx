import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';
import { formatSlot, money } from '@/lib/booking';
import type { PaymentMethod } from '@/lib/database.types';

import { PaymentForm } from './PaymentForm';
import { AnswerForm } from './AnswerForm';

export default async function PayBookingPage({
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
    .select('id, booking_code, status, price_usd, scheduled_start, scheduled_end, reserved_until, mentor_id, session_type_id, student_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) notFound();
  if (booking.student_id !== user.id) redirect(`/bookings/${bookingId}`);

  // Nothing to pay unless the booking is still waiting for it.
  if (booking.status !== 'payment_pending') redirect(`/bookings/${bookingId}`);

  const [{ data: payment }, { data: mentorProfile }, { data: sessionType }] = await Promise.all([
    supabase
      .from('payments')
      .select('id, payment_code, method_key, amount_usd, status, rejection_reason, info_request_ar')
      .eq('booking_id', bookingId)
      .in('status', ['pending', 'rejected', 'needs_info'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', booking.mentor_id).single(),
    booking.session_type_id
      ? supabase.from('session_types').select('name_ar, name_en, duration_minutes').eq('id', booking.session_type_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!payment) notFound();

  // The receiving details are column-locked (0075): they come only from
  // payment_instructions(), which shows them to the person who owes this
  // payment, on the method they chose, while it is still open.
  const { data: instructions } = await supabase.rpc('payment_instructions', { p_payment: payment.id });
  const row = instructions?.[0] ?? null;
  const method: PaymentMethod | null = row
    ? {
        key: row.method_key, name_ar: row.name_ar, name_en: row.name_en, icon: row.icon,
        category: 'local', is_enabled: true, sort_order: 0, use_for: [],
        instructions_ar: row.instructions_ar, recipient_name: row.recipient_name,
        account_number: row.account_number, wallet_number: row.wallet_number, iban: row.iban,
        swift: row.swift, bank_name: row.bank_name, bank_address: row.bank_address,
        city: row.city, country: row.country, requires_receipt: row.requires_receipt,
        requires_reference: row.requires_reference, reference_label_ar: row.reference_label_ar,
        supports_automatic_payment: false, supports_payout: false,
      }
    : null;

  const when = formatSlot(booking.scheduled_start);
  const expired = booking.reserved_until ? new Date(booking.reserved_until) < new Date() : false;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/bookings">{t('→ حجوزاتي', '← My bookings')}</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('إتمام الدفع', 'Complete your payment')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('طلب رقم ', 'Request ')}<span className="id-chip">{booking.booking_code}</span>
          {' · '}{t('دفعة ', 'Payment ')}<span className="id-chip">{payment.payment_code}</span>
        </p>
      </section>

      {expired ? (
        <p className="notice notice-danger">
          {t('انتهت مهلة حجز هذا الموعد. اختر موعداً جديداً من صفحة المنتور.', 'The hold on this slot has expired. Pick a new time from the mentor’s page.')}
        </p>
      ) : (
        booking.reserved_until && (
          <p className="notice section-block">
            {t('الموعد محجوز لك حتى ', 'The slot is held for you until ')}
            <span className="eng">
              {new Date(booking.reserved_until).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {t('. أكمل الدفع قبل ذلك حتى لا يعود الموعد متاحاً لغيرك.', '. Pay before then, or the slot goes back to everyone else.')}
          </p>
        )
      )}

      {payment.status === 'rejected' && payment.rejection_reason && (
        <p className="notice notice-danger section-block">
          <strong>{t('لم يُقبل إثبات الدفع السابق:', 'The previous proof of payment was not accepted:')}</strong> {payment.rejection_reason}
          <br />
          {t('ارفع إيصالاً جديداً أو اختر طريقة دفع أخرى.', 'Upload a new receipt, or choose a different method.')}
        </p>
      )}

      <div className="detail-grid">
        <section>
          {!expired && payment.status === 'needs_info' && (
            <AnswerForm paymentId={payment.id} bookingId={booking.id}
                        question={payment.info_request_ar ?? ''} />
          )}
          {!expired && payment.status !== 'needs_info' && method && (
            <PaymentForm
              bookingId={booking.id}
              method={method}
              amount={payment.amount_usd}
              userId={user.id}
            />
          )}
        </section>

        <aside className="panel" style={{ alignSelf: 'start' }}>
          <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('ملخص الحجز', 'Booking summary')}</h3>
          <div className="summary-rows">
            <div className="summary-row"><span className="muted">{t('المنتور', 'Mentor')}</span><span>{mentorProfile?.full_name}</span></div>
            <div className="summary-row"><span className="muted">{t('الجلسة', 'Session')}</span><span>{contentText(t.locale, sessionType?.name_ar ?? null, sessionType?.name_en) || '—'}</span></div>
            <div className="summary-row"><span className="muted">{t('التاريخ', 'Date')}</span><span>{when.date}</span></div>
            <div className="summary-row"><span className="muted">{t('الوقت', 'Time')}</span><span className="eng">{when.time}</span></div>
            <div className="summary-row"><span className="muted">{t('المدة', 'Duration')}</span><span className="eng">{sessionType?.duration_minutes ?? 60} min</span></div>
            <div className="summary-row total"><span>{t('الإجمالي', 'Total')}</span><span className="eng">{money(booking.price_usd)}</span></div>
          </div>
        </aside>
      </div>
    </>
  );
}
