import type { CalendarEntryKind, CalendarTone } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/**
 * Dates, as the calendar needs them.
 *
 * Everything here is plain arithmetic on local dates: the week starts on
 * Saturday, because that is where the week starts for the people this is
 * built for, and a day is a `YYYY-MM-DD` key rather than a Date, so a cell and
 * an entry can be compared without a timezone ever entering the question.
 */
export type CalendarView = 'month' | 'week' | 'day';

export const CALENDAR_VIEWS: CalendarView[] = ['month', 'week', 'day'];

/** Saturday first, the way a week is read here. */
export const WEEKDAYS: Text[] = [
  { ar: 'السبت',   en: 'Sat' },
  { ar: 'الأحد',   en: 'Sun' },
  { ar: 'الإثنين', en: 'Mon' },
  { ar: 'الثلاثاء', en: 'Tue' },
  { ar: 'الأربعاء', en: 'Wed' },
  { ar: 'الخميس',  en: 'Thu' },
  { ar: 'الجمعة',  en: 'Fri' },
];

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDay(key: string | undefined): Date {
  const parsed = key ? new Date(`${key}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
  return next;
}

/** How far back from a date the Saturday is. */
function sinceSaturday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -sinceSaturday(date));
}

/** The six weeks a month grid is drawn on, including the days either side. */
export function monthMatrix(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];

  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day += 1) days.push(addDays(start, week * 7 + day));
    weeks.push(days);
    // A month that fits in five weeks does not get a sixth of other months.
    const last = days[6];
    if (week >= 4 && last.getMonth() !== anchor.getMonth()) break;
  }

  return weeks;
}

/** The window of dates a view asks the database for. */
export function rangeFor(view: CalendarView, anchor: Date): { from: string; to: string } {
  if (view === 'day') return { from: dayKey(anchor), to: dayKey(anchor) };
  if (view === 'week') {
    const start = startOfWeek(anchor);
    return { from: dayKey(start), to: dayKey(addDays(start, 6)) };
  }
  const weeks = monthMatrix(anchor);
  return { from: dayKey(weeks[0][0]), to: dayKey(weeks[weeks.length - 1][6]) };
}

/** The hours a week or day grid is drawn over. */
export const GRID_HOURS = Array.from({ length: 15 }, (_, index) => index + 7); // 07:00 – 21:00

export const ENTRY_LABEL: Record<CalendarEntryKind, Text> = {
  mentor_session: { ar: 'جلسة منتور',    en: 'Mentor session' },
  team_session:   { ar: 'جلسة فريق',     en: 'Team session' },
  team_meeting:   { ar: 'اجتماع فريق',   en: 'Team meeting' },
  task:           { ar: 'مهمة',          en: 'Task' },
  milestone:      { ar: 'معلم مشروع',    en: 'Milestone' },
  sprint:         { ar: 'سبرنت',         en: 'Sprint' },
};

/**
 * Colour says what a thing is and where it stands — nothing else. Five tones
 * for five meanings, drawn from the platform's own palette rather than from a
 * new set of colours invented for this page.
 */
export const TONE_LABEL: Record<CalendarTone, Text> = {
  mentor:    { ar: 'جلسة منتور مؤكدة', en: 'Confirmed mentor session' },
  team:      { ar: 'جلسة فريق مؤكدة',  en: 'Confirmed team session' },
  internal:  { ar: 'اجتماع فريق',      en: 'Team meeting' },
  pending:   { ar: 'قيد الإجراء',      en: 'In progress' },
  done:      { ar: 'انتهت',            en: 'Done' },
  cancelled: { ar: 'ملغاة',            en: 'Cancelled' },
  task:      { ar: 'موعد تسليم',       en: 'Due' },
  late:      { ar: 'متأخرة',           en: 'Late' },
  milestone: { ar: 'معلم',             en: 'Milestone' },
  sprint:    { ar: 'سبرنت',            en: 'Sprint' },
};

export function timeOf(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
