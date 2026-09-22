import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, formatDate } from '@/lib/i18n';
import { money } from '@/lib/booking';

/**
 * The record a session leaves behind.
 *
 * Not a second copy of the booking list: this is what the hour produced —
 * how long it ran, what it cost, what each side said about it, and where the
 * attendance is written down. A rating still waiting to be written says so,
 * because that is the one thing here the person can still do.
 */
export async function History() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('bookings')
    .select('id, booking_code, kind, scheduled_start, scheduled_end, price_usd, mentor_id, student_id, team_id, session_type_id')
    .eq('status', 'completed')
    .order('scheduled_start', { ascending: false });

  const bookings = rows ?? [];

  if (bookings.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا سجلّ بعد', 'No record yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('تظهر هنا كل جلسة انعقدت فعلاً — بحضورها وتقييمها.',
             'Every session that actually took place appears here, with its attendance and its rating.')}
        </p>
      </div>
    );
  }

  const ids = [...new Set(bookings.flatMap((row) => [row.mentor_id, row.student_id]).filter(Boolean))] as string[];
  const typeIds = [...new Set(bookings.map((row) => row.session_type_id).filter(Boolean))] as string[];
  const bookingIds = bookings.map((row) => row.id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: people }, { data: types }, { data: feedback }, { data: sessions }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : placeholder),
    supabase.from('session_types').select('id, name_ar, name_en').in('id', typeIds.length ? typeIds : placeholder),
    supabase.from('session_feedback').select('booking_id, from_profile, stars').in('booking_id', bookingIds),
    supabase.from('video_sessions').select('id, booking_id').in('booking_id', bookingIds),
  ]);

  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const typeOf = new Map((types ?? []).map((row) => [row.id, row]));
  const roomOf = new Map((sessions ?? []).map((row) => [row.booking_id ?? '', row.id]));
  const mine = new Map((feedback ?? []).filter((row) => row.from_profile === user?.id).map((row) => [row.booking_id, row.stars]));

  return (
    <table className="data booking-table">
      <thead>
        <tr>
          <th>{t('الجلسة', 'Session')}</th>
          <th>{t('مع', 'With')}</th>
          <th>{t('التاريخ', 'Date')}</th>
          <th>{t('المدة', 'Length')}</th>
          <th>{t('المبلغ', 'Amount')}</th>
          <th>{t('تقييمك', 'Your rating')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {bookings.map((row) => {
          const type = typeOf.get(row.session_type_id ?? '');
          const minutes = Math.round(
            (new Date(row.scheduled_end).getTime() - new Date(row.scheduled_start).getTime()) / 60000,
          );
          const room = roomOf.get(row.id);
          const stars = mine.get(row.id);

          return (
            <tr key={row.id}>
              <td data-label={t('الجلسة', 'Session')}>
                {contentText(locale, type?.name_ar ?? null, type?.name_en) || t('جلسة إرشاد', 'Mentoring session')}
              </td>
              <td data-label={t('مع', 'With')}>
                {row.mentor_id === user?.id
                  ? nameOf.get(row.student_id ?? '') ?? t('فريق', 'Team')
                  : nameOf.get(row.mentor_id) ?? '—'}
              </td>
              <td data-label={t('التاريخ', 'Date')} className="muted">{formatDate(locale, row.scheduled_start)}</td>
              <td data-label={t('المدة', 'Length')} className="eng">{minutes}m</td>
              <td data-label={t('المبلغ', 'Amount')} className="eng">{money(row.price_usd)}</td>
              <td data-label={t('تقييمك', 'Your rating')}>
                {stars ? <Stars value={stars} /> : <span className="muted">{t('لم تقيّم بعد', 'Not rated yet')}</span>}
              </td>
              <td>
                {room && (
                  <Link className="btn btn-ghost btn-sm" href={`/sessions/${room}`}>
                    {stars ? t('السجل', 'The record') : t('قيّمها', 'Rate it')}
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
