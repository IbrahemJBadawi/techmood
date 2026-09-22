import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { BOOKING_STATUS, PAYMENT_STATUS, money } from '@/lib/booking';
import { ENTRY_LABEL, TONE_LABEL } from '@/lib/calendar';
import type { Database } from '@/lib/database.types';

type Entry = Database['public']['Functions']['my_calendar']['Returns'][number];

/**
 * What one entry is, without leaving the calendar.
 *
 * A booking's card carries the three things somebody asks before opening
 * anything: who it is with, where the money stands, and whether the room is
 * open. The door only appears when the database says the door is open.
 */
export async function Preview({ entry }: { entry: Entry }) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const isBooking = entry.entry_kind === 'mentor_session' || entry.entry_kind === 'team_session';

  const { data: booking } = isBooking
    ? await supabase
        .from('bookings')
        .select('id, booking_code, kind, status, scheduled_start, scheduled_end, price_usd, seats, mentor_id, student_id, team_id, topic_ar')
        .eq('id', entry.entry_id)
        .maybeSingle()
    : { data: null };

  const [{ data: people }, { data: payment }, { data: room }] = await Promise.all([
    booking
      ? supabase.from('profiles').select('id, full_name, techmood_id')
          .in('id', [booking.mentor_id, booking.student_id].filter(Boolean) as string[])
      : Promise.resolve({ data: [] as { id: string; full_name: string; techmood_id: string }[] }),
    booking
      ? supabase.from('payments').select('status').eq('booking_id', booking.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    isBooking
      ? supabase.from('video_sessions').select('id').eq('booking_id', entry.entry_id).maybeSingle()
      : Promise.resolve({ data: entry.entry_kind === 'team_meeting' || entry.entry_kind === 'project_meeting'
          ? { id: entry.entry_id } : null }),
  ]);

  const { data: phase } = room
    ? await supabase.rpc('session_phase', { p_session: room.id })
    : { data: null };

  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const status = booking ? BOOKING_STATUS[booking.status] : null;

  return (
    <aside className="panel preview-card">
      <div className="row-between">
        <span className="kicker">{t(ENTRY_LABEL[entry.entry_kind])}</span>
        <span className={`cal-dot tone-${entry.tone}`} title={t(TONE_LABEL[entry.tone])} />
      </div>

      <h3 style={{ fontSize: '1rem', margin: '6px 0' }}>{entry.title_ar}</h3>

      {entry.starts_at ? (
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {formatDateTime(locale, entry.starts_at)}
          {entry.ends_at && ` — ${new Date(entry.ends_at).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: '0.84rem' }}>{entry.detail_ar}</p>
      )}

      {booking && (
        <div className="preview-rows">
          <div className="row-between">
            <span className="muted">{t('مع', 'With')}</span>
            <span>
              {booking.kind === 'team_mentor'
                ? `${nameOf.get(booking.mentor_id) ?? t('منتور', 'Mentor')} · ${booking.seats} ${t('مقاعد', 'seats')}`
                : nameOf.get(booking.mentor_id) ?? nameOf.get(booking.student_id ?? '') ?? '—'}
            </span>
          </div>
          <div className="row-between">
            <span className="muted">{t('المبلغ', 'Amount')}</span>
            <span className="eng">{money(booking.price_usd)}</span>
          </div>
          {payment && (
            <div className="row-between">
              <span className="muted">{t('الدفع', 'Payment')}</span>
              <span className={`status-pill ${PAYMENT_STATUS[payment.status].className}`}>
                {t(PAYMENT_STATUS[payment.status].text)}
              </span>
            </div>
          )}
          {status && (
            <div className="row-between">
              <span className="muted">{t('الحالة', 'Status')}</span>
              <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
            </div>
          )}
          <div className="row-between">
            <span className="muted">{t('المرجع', 'Reference')}</span>
            <span className="id-chip">{booking.booking_code}</span>
          </div>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: 14 }}>
        <Link className="btn btn-ghost btn-sm" href={entry.link}>
          {isBooking ? t('تفاصيل الحجز', 'View booking') : t('افتح', 'Open')}
        </Link>

        {booking && (
          <Link className="btn btn-ghost btn-sm" href="/messages">{t('المحادثة', 'Open chat')}</Link>
        )}

        {room && (phase === 'lobby' || phase === 'live') && (
          <Link className="btn btn-primary btn-sm" href={`/sessions/${room.id}`}>
            {t('ادخل الجلسة', 'Join session')}
          </Link>
        )}
        {room && phase === 'ended' && (
          <Link className="btn btn-ghost btn-sm" href={`/sessions/${room.id}`}>
            {t('ملخّص الجلسة', 'Session summary')}
          </Link>
        )}
      </div>

      {room && phase === 'waiting' && (
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          {t('يفتح باب الغرفة قبل الموعد بخمس دقائق.', 'The room opens five minutes before the time.')}
        </p>
      )}
    </aside>
  );
}
