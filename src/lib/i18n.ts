/**
 * Two languages, one string in two places.
 *
 * TechMood is written in Arabic first — the Arabic is the source text, not a
 * translation of an English original — so the English lives next to it at the
 * point of use rather than behind a key in a table somewhere else:
 *
 *   t('حجوزاتي', 'My bookings')
 *
 * The reason is honesty about what changes together. A key table drifts: a
 * string gets reworded in Arabic, the key keeps its old English, and nobody
 * notices because the two live in different files. Here they cannot drift,
 * because they are one call.
 *
 * What this translates is the interface. It does NOT translate content: a
 * course description, a mentor's bio, a team's name, a message somebody wrote.
 * Those are data, and `contentText` below says plainly what to do when a row
 * has no English of its own.
 */
export type Locale = 'ar' | 'en';

/** A label that a library module carries in both languages. */
export type Text = { ar: string; en: string };

export type T = {
  (ar: string, en: string): string;
  (text: Text): string;
  locale: Locale;
};

export function makeT(locale: Locale): T {
  const translate = ((first: string | Text, second?: string) => {
    if (typeof first === 'string') return locale === 'ar' ? first : (second ?? first);
    return locale === 'ar' ? first.ar : first.en;
  }) as T;

  translate.locale = locale;
  return translate;
}

export const LOCALE_COOKIE = 'tm_locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'ar' || value === 'en';
}

export function dirFor(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Content the database stores in one language.
 *
 * Where a row carries its own English (a course title, a field name) that is
 * used. Where it does not — a course description, anything a person wrote —
 * the Arabic is returned as-is and marked, so an English reader sees Arabic
 * text rendered right-to-left rather than Arabic mangled into a left-to-right
 * paragraph. Showing the original is honest; machine-guessing it is not.
 */
export function contentText(locale: Locale, ar: string | null, en?: string | null): string {
  if (locale === 'en' && en) return en;
  return ar ?? '';
}

/** True when the string being shown is Arabic inside an English interface. */
export function needsRtlIsolation(locale: Locale, en?: string | null) {
  return locale === 'en' && !en;
}

/** Locale tag for Intl — dates, numbers, relative times. */
export function intlTag(locale: Locale) {
  return locale === 'ar' ? 'ar' : 'en-GB';
}

export function formatDate(locale: Locale, value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlTag(locale), {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

export function formatDateTime(locale: Locale, value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlTag(locale), {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function formatNumber(locale: Locale, value: number) {
  // Latin digits in both languages: the platform's numbers sit next to code,
  // prices and XP, and switching digit shapes between screens reads as a bug.
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB').format(value);
}

/** "5 أيام" / "5 days" — Arabic plurals are not the English two-form kind. */
export function plural(
  locale: Locale,
  count: number,
  forms: { one: string; two?: string; few?: string; many?: string; other: string },
) {
  if (locale === 'en') return count === 1 ? forms.one : forms.other;
  if (count === 1) return forms.one;
  if (count === 2) return forms.two ?? forms.other;
  if (count >= 3 && count <= 10) return forms.few ?? forms.other;
  return forms.many ?? forms.other;
}
