import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, formatDateTime, type Text } from '@/lib/i18n';
import { BOOKING_STATUS, money } from '@/lib/booking';
import type { BookingStatus } from '@/lib/database.types';

export type BookingFilter =
  | 'all' | 'upcoming' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'needs_action';

export const FILTERS: { key: BookingFilter; label: Text }[] = [
  { key: 'all',          label: { ar: 'الكل',            en: 'All' } },
  { key: 'needs_action', label: { ar: 'يحتاج إجراءً',    en: 'Needs action' } },
  { key: 'upcoming',     label: { ar: 'قادمة',           en: 'Upcoming' } },
  { key: 'pending',      label: { ar: 'قيد الإجراء',     en: 'Pending' } },
  { key: 'confirmed',    label: { ar: 'مؤكّدة',           en: 'Confirmed' } },
  { key: 'completed',    label: { ar: 'مكتملة',          en: 'Completed' } },
  { key: 'cancelled',    label: { ar: 'ملغاة',           en: 'Cancelled' } },
];

const PENDING: BookingStatus[] = ['payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending'];
const CLOSED: BookingStatus[] = ['cancelled', 'rejected', 'refunded', 'expired'];

/**
 * Every booking this person is a party to — as the student, as the mentor, or
 * through their team. Which of those they are is not asked here: row-level
 * security already answered it, and an admin therefore sees the platform's
 * whole list on the same screen.
 */
export async function BookingList({ filter, past }: { filter: BookingFilter; past: boolean }) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('bookings')
    .select('id, booking_code, kind, status, scheduled_start, scheduled_end, price_usd, seats, mentor_id, student_id, team_id, session_type_id')
    .order('scheduled_start', { ascending: !past });

  const bookings = rows ?? [];
  const ids = [...new Set(bookings.flatMap((row) => [row.mentor_id, row.student_id]).filter(Boolean))] as string[];
  const typeIds = [...new Set(bookings.map((row) => row.session_type_id).filter(Boolean))] as string[];
  const teamIds = [...new Set(bookings.map((row) => row.team_id).filter(Boolean))] as string[];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: people }, { data: types }, { data: teams }, { data: rated }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : placeholder),
    supabase.from('session_types').select('id, name_ar, name_en').in('id', typeIds.length ? typeIds : placeholder),
    supabase.from('teams').select('id, title_ar').in('id', teamIds.length ? teamIds : placeholder),
    supabase.from('session_feedback').select('booking_id').eq('from_profile', user?.id ?? ''),
  ]);

  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const typeOf = new Map((types ?? []).map((row) => [row.id, row]));
  const teamOf = new Map((teams ?? []).map((row) => [row.id, row.title_ar]));
  const ratedBy = new Set((rated ?? []).map((row) => row.booking_id));

  const now = new Date().getTime();

  // "Needs action" is the one filter that is not a status: it is whatever this
  // person, and only this person, can move forward.
  const needsAction = (row: typeof bookings[number]) =>
    (row.student_id === user?.id && row.status === 'payment_pending')
    || (row.mentor_id === user?.id && row.status === 'mentor_pending')
    || (row.status === 'completed' && !ratedBy.has(row.id)
        && (row.student_id === user?.id || row.mentor_id === user?.id));

  const shown = bookings.filter((row) => {
    const isPast = new Date(row.scheduled_start).getTime() < now || CLOSED.includes(row.status) || row.status === 'completed';
    if (past !== isPast) return false;

    switch (filter) {
      case 'needs_action': return needsAction(row);
      case 'upcoming':     return row.status === 'confirmed' && new Date(row.scheduled_start).getTime() >= now;
      case 'pending':      return PENDING.includes(row.status);
      case 'confirmed':    return row.status === 'confirmed';
      case 'completed':    return row.status === 'completed';
      case 'cancelled':    return CLOSED.includes(row.status);
      default:             return true;
    }
  });

  if (shown.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا شيء هنا', 'Nothing here')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('جرّب فلتراً آخر، أو احجز جلسة جديدة.', 'Try another filter, or book a session.')}
        </p>
        <Link className="btn btn-primary btn-sm" href="/mentors">{t('احجز جلسة', 'Book a session')}</Link>
      </div>
    );
  }

  return (
    <table className="data booking-table">
      <thead>
        <tr>
          <th>{t('الجلسة', 'Session')}</th>
          <th>{t('مع', 'With')}</th>
          <th>{t('الموعد', 'When')}</th>
          <th>{t('المبلغ', 'Amount')}</th>
          <th>{t('الحالة', 'Status')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {shown.map((row) => {
          const type = typeOf.get(row.session_type_id ?? '');
          const status = BOOKING_STATUS[row.status];
          const counterpart = row.kind === 'team_mentor'
            ? teamOf.get(row.team_id ?? '') ?? t('فريق', 'Team')
            : row.mentor_id === user?.id
              ? nameOf.get(row.student_id ?? '') ?? '—'
              : nameOf.get(row.mentor_id) ?? '—';

          return (
            <tr key={row.id}>
              <td data-label={t('الجلسة', 'Session')}>
                {contentText(locale, type?.name_ar ?? null, type?.name_en) || t('جلسة إرشاد', 'Mentoring session')}
                {needsAction(row) && <span className="dot-flag" title={t('يحتاج إجراءً', 'Needs action')} />}
              </td>
              <td data-label={t('مع', 'With')}>{counterpart}</td>
              <td data-label={t('الموعد', 'When')} className="muted">{formatDateTime(locale, row.scheduled_start)}</td>
              <td data-label={t('المبلغ', 'Amount')} className="eng">{money(row.price_usd)}</td>
              <td data-label={t('الحالة', 'Status')}>
                <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
              </td>
              <td>
                <Link className="btn btn-ghost btn-sm" href={`/bookings/${row.id}`}>
                  {t('التفاصيل', 'Details')}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
