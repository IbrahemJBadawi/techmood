import Link from 'next/link';

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

const COLUMNS: { key: AgendaColumn; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'in_progress', label: 'قيد التنفيذ' },
  { key: 'upcoming', label: 'قادم' },
  { key: 'completed', label: 'منجز' },
];

const KIND_LABEL: Record<string, string> = {
  lesson: 'درس',
  work: 'تسليم',
  assessment: 'اختبار',
  session: 'جلسة',
  team_task: 'مهمة فريق',
};

/**
 * One board, five sources. Nothing here is stored twice: a lesson stays a
 * lesson, a team task stays on its team's board, and this only says where each
 * of them stands today. Dragging a card is therefore not offered — the card
 * would have to lie about where the truth lives.
 */
export function DailyBoard({ entries }: { entries: AgendaEntry[] }) {
  return (
    <section className="section-block">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem' }}>لوحة اليوم</h2>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          تُجمع تلقائياً من دروسك وتسليماتك وجلساتك ومهام فريقك
        </span>
      </div>

      <div className="kanban">
        {COLUMNS.map((column) => {
          const cards = entries.filter((entry) => entry.bucket === column.key);
          return (
            <div className="kanban-column" key={column.key}>
              <div className="kanban-head">
                <span>{column.label}</span>
                <span className="kanban-count eng">{cards.length}</span>
              </div>

              {cards.length === 0 && <p className="kanban-empty">لا شيء هنا.</p>}

              {cards.map((card) => (
                <Link className="kanban-card" href={card.link} key={`${card.entry_kind}-${card.entry_id}`}>
                  <span className="kanban-kind">{KIND_LABEL[card.entry_kind] ?? card.entry_kind}</span>
                  <strong>{card.title_ar}</strong>
                  {card.detail_ar && <span className="muted">{card.detail_ar}</span>}
                  {card.due_on && (
                    <time dateTime={card.due_on}>
                      {new Date(`${card.due_on}T00:00:00`).toLocaleDateString('ar')}
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
