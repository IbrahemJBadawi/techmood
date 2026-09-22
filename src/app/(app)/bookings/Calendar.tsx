import Link from 'next/link';

import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Locale } from '@/lib/i18n';
import {
  addDays, addMonths, dayKey, ENTRY_LABEL, GRID_HOURS, monthMatrix, startOfWeek,
  timeOf, TONE_LABEL, WEEKDAYS, type CalendarView,
} from '@/lib/calendar';
import type { Database } from '@/lib/database.types';

type Entry = Database['public']['Functions']['my_calendar']['Returns'][number];

function href(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return `/bookings?${search.toString()}`;
}

function monthTitle(locale: Locale, anchor: Date) {
  return anchor.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The calendar itself, in three views.
 *
 * It draws what `my_calendar()` returned and nothing else: every entry here is
 * a row that already exists elsewhere in the platform — a booking, a session,
 * a task, a milestone — so the calendar can never disagree with the thing it
 * shows. Colour says what something is and where it stands; it is never
 * decoration.
 */
export async function Calendar({
  view,
  anchor,
  entries,
  selected,
  filter,
}: {
  view: CalendarView;
  anchor: Date;
  entries: Entry[];
  selected?: string;
  filter?: string;
}) {
  const t = await getT();
  const locale = await getLocale();

  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    byDay.set(entry.on_date, [...(byDay.get(entry.on_date) ?? []), entry]);
  }

  const todayKey = dayKey(new Date());
  const base = { tab: 'calendar', view, filter, e: selected };

  const step = (direction: -1 | 1) =>
    view === 'month'
      ? dayKey(addMonths(anchor, direction))
      : dayKey(addDays(anchor, direction * (view === 'week' ? 7 : 1)));

  const chip = (entry: Entry) => (
    <Link
      className={`cal-chip tone-${entry.tone}${selected === entry.entry_id ? ' is-selected' : ''}`}
      href={href({ ...base, date: dayKey(anchor), e: entry.entry_id })}
      key={`${entry.entry_kind}-${entry.entry_id}`}
      title={`${t(ENTRY_LABEL[entry.entry_kind])} — ${t(TONE_LABEL[entry.tone])}`}
      scroll={false}
    >
      {entry.starts_at && <span className="cal-chip-time eng">{timeOf(entry.starts_at)}</span>}
      <span className="cal-chip-title">{entry.title_ar}</span>
    </Link>
  );

  return (
    <section className="section-block">
      <header className="cal-head">
        <div className="cal-nav">
          <Link className="btn btn-ghost btn-sm" href={href({ ...base, date: step(-1) })} scroll={false}>‹</Link>
          <Link className="btn btn-ghost btn-sm" href={href({ ...base, date: dayKey(new Date()) })} scroll={false}>
            {t('اليوم', 'Today')}
          </Link>
          <Link className="btn btn-ghost btn-sm" href={href({ ...base, date: step(1) })} scroll={false}>›</Link>
          <strong className="cal-title">
            {view === 'day' ? formatDate(locale, anchor) : monthTitle(locale, anchor)}
          </strong>
        </div>

        <div className="cal-views">
          {(['month', 'week', 'day'] as CalendarView[]).map((option) => (
            <Link
              className={`tab${option === view ? ' is-active' : ''}`}
              href={href({ ...base, view: option, date: dayKey(anchor) })}
              key={option}
              scroll={false}
            >
              {t(option === 'month' ? { ar: 'شهر', en: 'Month' }
                : option === 'week' ? { ar: 'أسبوع', en: 'Week' }
                : { ar: 'يوم', en: 'Day' })}
            </Link>
          ))}
        </div>
      </header>

      {view === 'month' && (
        <div className="cal-month">
          {WEEKDAYS.map((day) => (
            <div className="cal-weekday" key={day.en}>{t(day)}</div>
          ))}

          {monthMatrix(anchor).flat().map((date) => {
            const key = dayKey(date);
            const dayEntries = byDay.get(key) ?? [];
            const outside = date.getMonth() !== anchor.getMonth();

            return (
              <div
                className={`cal-day${outside ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}`}
                key={key}
              >
                <Link className="cal-daynum eng" href={href({ ...base, view: 'day', date: key })} scroll={false}>
                  {date.getDate()}
                </Link>
                {dayEntries.slice(0, 3).map(chip)}
                {dayEntries.length > 3 && (
                  <Link className="cal-more" href={href({ ...base, view: 'day', date: key })} scroll={false}>
                    +{dayEntries.length - 3}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'week' && (
        <div className="cal-week">
          <div className="cal-hourcol">
            <div className="cal-weekday" />
            {GRID_HOURS.map((hour) => (
              <div className="cal-hour eng" key={hour}>{String(hour).padStart(2, '0')}:00</div>
            ))}
          </div>

          {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index)).map((date) => {
            const key = dayKey(date);
            const dayEntries = byDay.get(key) ?? [];

            return (
              <div className={`cal-weekcol${key === todayKey ? ' is-today' : ''}`} key={key}>
                <div className="cal-weekday">
                  {t(WEEKDAYS[(date.getDay() + 1) % 7])}
                  <span className="eng"> {date.getDate()}</span>
                </div>

                {GRID_HOURS.map((hour) => (
                  <div className="cal-cell" key={hour}>
                    {dayEntries
                      .filter((entry) => entry.starts_at && new Date(entry.starts_at).getHours() === hour)
                      .map(chip)}
                    {hour === GRID_HOURS[0] &&
                      dayEntries.filter((entry) => !entry.starts_at).map(chip)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="cal-dayview">
          {(byDay.get(dayKey(anchor)) ?? []).length === 0 ? (
            <p className="notice">{t('لا مواعيد في هذا اليوم.', 'Nothing on this day.')}</p>
          ) : (
            GRID_HOURS.map((hour) => {
              const dayEntries = (byDay.get(dayKey(anchor)) ?? []).filter((entry) =>
                entry.starts_at
                  ? new Date(entry.starts_at).getHours() === hour
                  : hour === GRID_HOURS[0]);
              if (dayEntries.length === 0) return null;

              return (
                <div className="cal-dayrow" key={hour}>
                  <div className="cal-hour eng">{String(hour).padStart(2, '0')}:00</div>
                  <div className="cal-dayentries">{dayEntries.map(chip)}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="cal-legend">
        {(['mentor', 'team', 'internal', 'pending', 'done', 'task', 'late', 'cancelled'] as const).map((tone) => (
          <span className="cal-legend-item" key={tone}>
            <span className={`cal-dot tone-${tone}`} />
            {t(TONE_LABEL[tone])}
          </span>
        ))}
      </div>
    </section>
  );
}
