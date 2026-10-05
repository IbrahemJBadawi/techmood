import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { getT } from '@/lib/i18n.server';
import { formatDate, type T, type Text } from '@/lib/i18n';
import type { AgendaColumn } from '@/lib/database.types';
import type { IconName } from '@/lib/roles';

export type AgendaEntry = {
  entry_kind: string;
  entry_id: string;
  title_ar: string;
  detail_ar: string | null;
  bucket: AgendaColumn;
  due_on: string | null;
  link: string;
};

const KIND: Record<string, { label: Text; icon: IconName; color: string }> = {
  lesson:     { label: { ar: 'درس',        en: 'Lesson' },     icon: 'academy',  color: '#2F6BFF' },
  work:       { label: { ar: 'تسليم',      en: 'Submission' }, icon: 'work',     color: '#E8590C' },
  assessment: { label: { ar: 'اختبار',     en: 'Assessment' }, icon: 'check',    color: '#0E9F6E' },
  session:    { label: { ar: 'جلسة',       en: 'Session' },    icon: 'calendar', color: '#7C5CFF' },
  team_task:  { label: { ar: 'مهمة فريق',  en: 'Team task' },  icon: 'team',     color: '#0B8FB3' },
};

const TODAY_LIMIT = 5;

const FALLBACK = { label: { ar: 'عنصر', en: 'Item' }, icon: 'layers' as IconName, color: '#5B6B7C' };

/**
 * One list, five sources. Nothing here is stored twice: a lesson stays a
 * lesson, a team task stays on its team's board, and this only says where each
 * of them stands today. What is due now is open; what is ahead and what is
 * done fold away so the list stays short.
 */
export async function DailyBoard({ entries }: { entries: AgendaEntry[] }) {
  const t = await getT();
  const now = entries.filter((entry) => entry.bucket === 'today' || entry.bucket === 'in_progress');
  const upcoming = entries.filter((entry) => entry.bucket === 'upcoming');
  const done = entries.filter((entry) => entry.bucket === 'completed');
  // Today shows the first five; the rest fold away under "more" (founder's request).
  const first = now.slice(0, TODAY_LIMIT);
  const rest = now.slice(TODAY_LIMIT);

  return (
    <section className="section-block">
      <div className="hm-head">
        <h2>{t('مهام اليوم', 'Today')}</h2>
        <Link href="/bookings?tab=calendar">{t('التقويم', 'Calendar')}</Link>
      </div>

      <div className="hm-card hm-today">
        {now.length === 0 ? (
          <p className="hm-today-empty">
            <span aria-hidden="true">🎉</span>
            {t('لا شيء مستحق اليوم. خذ درساً إضافياً أو ارتح.', 'Nothing due today. Take an extra lesson, or rest.')}
          </p>
        ) : (
          <ul className="hm-list">
            {first.map((entry) => <Row entry={entry} t={t} key={`${entry.entry_kind}-${entry.entry_id}`} />)}
          </ul>
        )}

        {rest.length > 0 && (
          <details className="hm-fold">
            <summary>{t('مهام أخرى لليوم', 'More for today')} <span className="hm-count">{rest.length}</span></summary>
            <ul className="hm-list">
              {rest.map((entry) => <Row entry={entry} t={t} key={`${entry.entry_kind}-${entry.entry_id}`} />)}
            </ul>
          </details>
        )}

        {upcoming.length > 0 && (
          <details className="hm-fold">
            <summary>{t('قادم', 'Coming up')} <span className="hm-count">{upcoming.length}</span></summary>
            <ul className="hm-list">
              {upcoming.map((entry) => <Row entry={entry} t={t} key={`${entry.entry_kind}-${entry.entry_id}`} />)}
            </ul>
          </details>
        )}

        {done.length > 0 && (
          <details className="hm-fold">
            <summary>{t('منجز', 'Done')} <span className="hm-count is-ok">{done.length}</span></summary>
            <ul className="hm-list is-done">
              {done.map((entry) => <Row entry={entry} t={t} key={`${entry.entry_kind}-${entry.entry_id}`} />)}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

function Row({ entry, t }: { entry: AgendaEntry; t: T }) {
  const kind = KIND[entry.entry_kind] ?? FALLBACK;
  return (
    <li>
      <Link className="hm-row" href={entry.link}>
        <span className="hm-row-icon" style={{ background: kind.color }}><Icon name={kind.icon} size={16} /></span>
        <span className="hm-row-main">
          <strong>{entry.title_ar}</strong>
          <span className="muted">
            {t(kind.label)}{entry.detail_ar && <> · {entry.detail_ar}</>}
          </span>
        </span>
        {entry.bucket === 'completed'
          ? <span className="hm-row-check" aria-label={t('منجز', 'Done')}><Icon name="check" size={14} /></span>
          : entry.due_on && (
            <time className="hm-row-when date" dateTime={entry.due_on}>
              {formatDate(t.locale, `${entry.due_on}T00:00:00`)}
            </time>
          )}
      </Link>
    </li>
  );
}
