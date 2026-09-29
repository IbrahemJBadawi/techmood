/**
 * The platform keeps Palestine's clock. A day and an hour typed into a form
 * mean that time in Palestine, whatever timezone the server happens to run in
 * (Vercel runs in UTC, so `new Date('2026-10-01T18:00')` there is 21:00 local).
 */
export const PLATFORM_TIME_ZONE = 'Asia/Jerusalem';

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** `date` is YYYY-MM-DD and `time` HH:MM, both read on the platform's clock. */
export function localToUtc(date: string, time: string, timeZone = PLATFORM_TIME_ZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})/.exec(time);
  if (!match || !clock) return null;
  const naive = Date.UTC(+match[1], +match[2] - 1, +match[3], +clock[1], +clock[2]);
  // Twice, so a moment next to a daylight-saving change lands on the right side.
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60000;
  guess = naive - offsetMinutes(new Date(guess), timeZone) * 60000;
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}
