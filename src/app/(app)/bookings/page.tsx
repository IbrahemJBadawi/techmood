import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { BOOKING_STATUS, formatSlot, money } from '@/lib/booking';
import type { BookingStatus } from '@/lib/database.types';

const OPEN_STATES: BookingStatus[] = [
  'payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending', 'confirmed',
];

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_code, status, scheduled_start, price_usd, mentor_id, session_type_id, reserved_until')
    .eq('student_id', user.id)
    .order('scheduled_start', { ascending: false });

  const mentorIds = [...new Set((bookings ?? []).map((row) => row.mentor_id))];
  const typeIds = [...new Set((bookings ?? []).map((row) => row.session_type_id).filter(Boolean))] as string[];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: mentors }, { data: types }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', mentorIds.length ? mentorIds : placeholder),
    supabase.from('session_types').select('id, name_ar').in('id', typeIds.length ? typeIds : placeholder),
  ]);

  const mentorById = new Map((mentors ?? []).map((row) => [row.id, row]));
  const typeById = new Map((types ?? []).map((row) => [row.id, row]));

  const open = (bookings ?? []).filter((row) => OPEN_STATES.includes(row.status));
  const past = (bookings ?? []).filter((row) => !OPEN_STATES.includes(row.status));

  function card(row: NonNullable<typeof bookings>[number]) {
    const status = BOOKING_STATUS[row.status];
    const when = formatSlot(row.scheduled_start);

    return (
      <article className="card" key={row.id}>
        <div className="row-between">
          <span className="id-chip">{row.booking_code}</span>
          <span className={`status-pill ${status.className}`}>{status.text}</span>
        </div>
        <h3>{typeById.get(row.session_type_id ?? '')?.name_ar ?? 'جلسة إرشاد'}</h3>
        <p>مع {mentorById.get(row.mentor_id)?.full_name ?? '—'}</p>
        <div className="row-between" style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
          <span>{when.date} · <span className="eng">{when.time}</span></span>
          <span className="eng">{money(row.price_usd)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-ghost btn-sm" href={`/bookings/${row.id}`}>التفاصيل</Link>
          {row.status === 'payment_pending' && (
            <Link className="btn btn-primary btn-sm" href={`/bookings/${row.id}/pay`}>أكمل الدفع</Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>حجوزاتي</h2>
          <Link className="btn btn-primary btn-sm" href="/mentors">حجز جديد</Link>
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>جلسات جارية</h3>
        {open.length === 0 ? (
          <p className="notice">لا جلسات جارية. تصفّح المنتورز لحجز جلستك الأولى.</p>
        ) : (
          <div className="card-grid">{open.map(card)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>سجلّ سابق</h3>
          <div className="card-grid">{past.map(card)}</div>
        </section>
      )}
    </>
  );
}
