import { PLATFORM_TIME_ZONE } from '@/lib/zoned';
import type { Locale } from '@/lib/i18n';

/**
 * Twenty-six weeks of activity, a square a day — like a contribution graph
 * (0156). A square's shade is how much happened that day: lessons, approved
 * work, sessions, everything that earns XP. Nothing is drawn from guesses.
 */
export function ActivityGraph({ days, locale }: { days: { day: string; events: number; xp: number }[]; locale: Locale }) {
  const byDay = new Map(days.map((row) => [row.day, row]));
  const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE }).format(new Date()) + 'T00:00:00Z');
  // start on the Saturday 25 weeks before this week's, so columns are whole weeks
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 7 * 25 - ((today.getUTCDay() + 1) % 7));
  const cells: { key: string; level: number; label: string; future: boolean }[] = [];
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  let active = 0;
  let total = 0;
  for (let i = 0; i < 26 * 7; i += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    const events = row?.events ?? 0;
    if (events > 0) active += 1;
    total += events;
    const level = events === 0 ? 0 : events < 2 ? 1 : events < 4 ? 2 : events < 7 ? 3 : 4;
    cells.push({
      key, level, future: date > today,
      label: `${fmt.format(date)} — ${events} ${locale === 'ar' ? 'نشاط' : events === 1 ? 'activity' : 'activities'}`,
    });
  }

  return (
    <div>
      <div className="act-graph-wrap">
      <div className="act-graph" role="img"
           aria-label={locale === 'ar' ? `${total} نشاطاً في ${active} يوماً خلال آخر 6 أشهر` : `${total} activities on ${active} days in the last 6 months`}>
        {cells.map((cell) => (
          <span key={cell.key} className={`act-cell l${cell.level}${cell.future ? ' is-future' : ''}`} title={cell.future ? undefined : cell.label} />
        ))}
      </div>
      </div>
      <div className="act-legend" aria-hidden="true">
        <span className="muted">{locale === 'ar' ? `${active} يوم نشاط` : `${active} active days`}</span>
        <span className="act-scale">
          {locale === 'ar' ? 'أقل' : 'Less'}
          {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`act-cell l${level}`} />)}
          {locale === 'ar' ? 'أكثر' : 'More'}
        </span>
      </div>
    </div>
  );
}
