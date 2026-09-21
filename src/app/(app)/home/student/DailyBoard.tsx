import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import type { AgendaColumn } from '@/lib/database.types';

export type AgendaEntry = {
  entry_kind: string;
  entry_id: string;
  title_ar: string;
  detail_ar: string | null;
  bucket: AgendaColumn;
  due_on: string | null;
  link: string;
};

const COLUMNS: { key: AgendaColumn; label: Text }[] = [
  { key: 'today',       label: { ar: 'اليوم',        en: 'Today' } },
  { key: 'in_progress', label: { ar: 'قيد التنفيذ',  en: 'In progress' } },
  { key: 'upcoming',    label: { ar: 'قادم',         en: 'Upcoming' } },
  { key: 'completed',   label: { ar: 'منجز',         en: 'Done' } },
];

const KIND_LABEL: Record<string, Text> = {
  lesson:    { ar: 'درس',        en: 'Lesson' },
  work:      { ar: 'تسليم',      en: 'Submission' },
  assessment:{ ar: 'اختبار',     en: 'Assessment' },
  session:   { ar: 'جلسة',       en: 'Session' },
  team_task: { ar: 'مهمة فريق',  en: 'Team task' },
};

/**
 * One board, five sources. Nothing here is stored twice: a lesson stays a
 * lesson, a team task stays on its team's board, and this only says where each
 * of them stands today. Dragging a card is therefore not offered — the card
 * would have to lie about where the truth lives.
 */
export async function DailyBoard({ entries }: { entries: AgendaEntry[] }) {
  const t = await getT();

  return (
    <section className="section-block">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem' }}>{t('لوحة اليوم', 'Today’s board')}</h2>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {t('تُجمع تلقائياً من دروسك وتسليماتك وجلساتك ومهام فريقك', 'Gathered from your lessons, submissions, sessions and team tasks')}
        </span>
      </div>

      <div className="kanban">
        {COLUMNS.map((column) => {
          const cards = entries.filter((entry) => entry.bucket === column.key);
          return (
            <div className="kanban-column" key={column.key}>
              <div className="kanban-head">
                <span>{t(column.label)}</span>
                <span className="kanban-count eng">{cards.length}</span>
              </div>

              {cards.length === 0 && <p className="kanban-empty">{t('لا شيء هنا.', 'Nothing here.')}</p>}

              {cards.map((card) => (
                <Link className="kanban-card" href={card.link} key={`${card.entry_kind}-${card.entry_id}`}>
                  <span className="kanban-kind">
                    {KIND_LABEL[card.entry_kind] ? t(KIND_LABEL[card.entry_kind]) : card.entry_kind}
                  </span>
                  <strong>{card.title_ar}</strong>
                  {card.detail_ar && <span className="muted">{card.detail_ar}</span>}
                  {card.due_on && (
                    <time dateTime={card.due_on}>
                      {formatDate(t.locale, `${card.due_on}T00:00:00`)}
                    </time>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
