import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { dayKey, parseDay, rangeFor, type CalendarView } from '@/lib/calendar';
import type { Text } from '@/lib/i18n';

import { Availability, type Window } from './Availability';
import { BlockTime } from './BlockTime';
import { BookingList, FILTERS, type BookingFilter } from './BookingList';
import { Calendar } from './Calendar';
import { History } from './History';
import { Preview } from './Preview';
import { AiSurface } from '@/components/AiSurface';

export const metadata = { title: 'Bookings & Calendar — TechMood' };

type Tab = 'overview' | 'calendar' | 'bookings' | 'availability' | 'history';

const TAB_LABEL: Record<Tab, Text> = {
  overview:     { ar: 'نظرة عامة', en: 'Overview' },
  calendar:     { ar: 'التقويم',   en: 'Calendar' },
  bookings:     { ar: 'الحجوزات',  en: 'Bookings' },
  availability: { ar: 'توفّري',    en: 'Availability' },
  history:      { ar: 'السجل',     en: 'History' },
};

/**
 * Bookings & Calendar — one place where time is decided.
 *
 * Everything on this page is read from where it already lives: the calendar
 * from `my_calendar()`, the numbers from `booking_stats()`, what is waiting
 * from `needs_action()`. The page owns no state of its own, which is why it
 * cannot drift from the booking, the session or the team board it draws.
 *
 * What it shows follows the person, not a role switch: a mentor sees their
 * day and their availability because they are a mentor, and the same screen
 * shows an admin the platform's whole list, because that is what row-level
 * security returns to them.
 */
export default async function BookingsHub({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string; view?: string; date?: string; filter?: string; e?: string;
  }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const tab = (['overview', 'calendar', 'bookings', 'availability', 'history'] as Tab[])
    .find((key) => key === params.tab) ?? 'overview';
  const view = (['month', 'week', 'day'] as CalendarView[])
    .find((key) => key === params.view) ?? 'month';
  const anchor = parseDay(params.date);
  const filter = (FILTERS.find((row) => row.key === params.filter)?.key ?? 'all') as BookingFilter;

  const [{ data: isMentor }, { data: stats }, { data: actions }] = await Promise.all([
    supabase.rpc('is_mentor'),
    supabase.rpc('booking_stats'),
    supabase.rpc('needs_action'),
  ]);

  const numbers = stats?.[0];
  const waiting = actions ?? [];
  const mentor = isMentor === true;
  const tabs: Tab[] = mentor
    ? ['overview', 'calendar', 'bookings', 'availability', 'history']
    : ['overview', 'calendar', 'bookings', 'history'];

  const { from, to } = rangeFor(view, anchor);
  const { data: entries } = await supabase.rpc('my_calendar', { p_from: from, p_to: to });

  // The overview shows the same calendar, on the week the person is in.
  const overviewRange = rangeFor('week', new Date());
  const { data: weekEntries } = tab === 'overview'
    ? await supabase.rpc('my_calendar', { p_from: overviewRange.from, p_to: overviewRange.to })
    : { data: null };

  const selected = (entries ?? []).find((entry) => entry.entry_id === params.e);

  const [{ data: windows }, { data: blocks }, { data: load }] = mentor && tab === 'availability'
    ? await Promise.all([
        supabase.from('mentor_availability').select('day_of_week, start_time, end_time').eq('mentor_id', user.id),
        supabase.from('mentor_time_off').select('id, starts_at, ends_at, reason')
          .eq('mentor_id', user.id).gte('ends_at', new Date().toISOString()).order('starts_at'),
        supabase.from('mentor_profiles').select('daily_session_limit, buffer_minutes')
          .eq('profile_id', user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const { data: dayLoad } = mentor
    ? await supabase.rpc('mentor_day_load', { p_date: dayKey(new Date()) })
    : { data: null };

  const card = (label: Text, value: string | number, href?: string) => (
    <Link className="stat-card" href={href ?? '#'} key={label.en}>
      <span className="stat-value eng">{value}</span>
      <span className="stat-label">{t(label)}</span>
    </Link>
  );

  return (
    <>
      <AiSurface surface="booking" />

      <section className="section-block">
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('الحجوزات والتقويم', 'Bookings & Calendar')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
              {t('كل ما له موعد في مكان واحد: جلساتك، طلباتك، أوقاتك، وما ينتظر قرارك. لا شيء هنا مكتوب مرتين — الصفحة تجمع ولا تملك.',
                 'Everything with a time on it, in one place: your sessions, your requests, your hours, and whatever is waiting on you. Nothing here is written twice — the page gathers, it owns nothing.')}
            </p>
          </div>

          <div className="row-actions">
            <Link className="btn btn-ghost btn-sm" href="/sessions">{t('غرف الجلسات', 'Session rooms')}</Link>
            {mentor && (
              <Link className="btn btn-ghost btn-sm" href="/bookings?tab=availability">
                {t('إدارة توفّري', 'Manage availability')}
              </Link>
            )}
            <Link className="btn btn-primary btn-sm" href="/mentors">{t('احجز جلسة', 'Book a session')}</Link>
          </div>
        </div>
      </section>

      {numbers && (
        <section className="stat-strip">
          {card({ ar: 'قادمة', en: 'Upcoming' }, numbers.upcoming, '/bookings?tab=bookings&filter=upcoming')}
          {card({ ar: 'قيد الإجراء', en: 'Pending' }, numbers.pending, '/bookings?tab=bookings&filter=pending')}
          {card({ ar: 'مكتملة', en: 'Completed' }, numbers.completed, '/bookings?tab=history')}
          {card({ ar: 'هذا الشهر', en: 'This month' }, numbers.this_month, '/bookings?tab=calendar')}
          {card({ ar: 'ساعات تعلّم', en: 'Hours learned' }, `${numbers.hours}h`, '/bookings?tab=history')}
          {mentor && card({ ar: 'جلسات اليوم', en: 'Today' },
            dayLoad?.[0] ? `${dayLoad[0].booked}/${dayLoad[0].day_limit}` : numbers.today_as_mentor,
            '/bookings?tab=calendar&view=day')}
          {mentor && card({ ar: 'بانتظار قرارك', en: 'To decide' }, numbers.mentor_pending, '/mentor-requests')}
          {mentor && card({ ar: 'أرباح الجلسات', en: 'Earnings' }, money(numbers.mentor_earnings), '/wallet')}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="section-block">
          <div className="panel needs-action">
            <h3 style={{ fontSize: '0.96rem' }}>
              {t('يحتاج إجراءً منك', 'Needs action')}
              <span className="badge-pill" style={{ marginInlineStart: 8 }}>
                {waiting.reduce((sum, row) => sum + row.count, 0)}
              </span>
            </h3>
            <ul className="plain-list" style={{ marginTop: 10 }}>
              {waiting.map((row) => (
                <li className="row-between" key={row.action_key} style={{ fontSize: '0.88rem' }}>
                  <span>{row.label_ar}</span>
                  <Link className="btn btn-ghost btn-sm" href={row.link}>
                    {row.count} · {t('افتح', 'Open')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <nav className="tabs" aria-label={t('أقسام الصفحة', 'Sections')}>
        {tabs.map((key) => (
          <Link className={`tab${key === tab ? ' is-active' : ''}`} href={`/bookings?tab=${key}`} key={key}>
            {t(TAB_LABEL[key])}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <Calendar view="week" anchor={new Date()} entries={weekEntries ?? []} filter={params.filter} />
          <section className="section-block">
            <h3 className="academy-heading">{t('القادم', 'Coming up')}</h3>
            <BookingList filter="upcoming" past={false} />
          </section>
        </>
      )}

      {tab === 'calendar' && (
        <div className={selected ? 'calendar-layout' : undefined}>
          <Calendar view={view} anchor={anchor} entries={entries ?? []} selected={params.e} filter={params.filter} />
          {selected && <Preview entry={selected} />}
        </div>
      )}

      {tab === 'bookings' && (
        <section className="section-block">
          <div className="filter-row">
            {FILTERS.map((row) => (
              <Link
                className={`chip${row.key === filter ? ' is-active' : ''}`}
                href={`/bookings?tab=bookings&filter=${row.key}`}
                key={row.key}
              >
                {t(row.label)}
              </Link>
            ))}
          </div>

          <h3 className="academy-heading" style={{ marginTop: 18 }}>{t('قادمة', 'Ahead')}</h3>
          <BookingList filter={filter} past={false} />

          <h3 className="academy-heading" style={{ marginTop: 22 }}>{t('مضت', 'Behind')}</h3>
          <BookingList filter={filter} past />
        </section>
      )}

      {tab === 'availability' && mentor && (
        <>
          <Availability
            windows={(windows ?? []) as Window[]}
            dailyLimit={load?.daily_session_limit ?? 5}
            bufferMinutes={load?.buffer_minutes ?? 0}
          />
          <BlockTime blocks={blocks ?? []} />
        </>
      )}

      {tab === 'history' && (
        <section className="section-block">
          <History />
        </section>
      )}
    </>
  );
}
