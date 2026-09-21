import { getT } from '@/lib/i18n.server';
import { contentText } from '@/lib/i18n';
import type { BoardColumn, Database } from '@/lib/database.types';

type Step = Database['public']['Functions']['lesson_board']['Returns'][number];

const COLUMNS: { key: BoardColumn; ar: string; en: string }[] = [
  { key: 'todo',  ar: 'أمامك',      en: 'To do' },
  { key: 'doing', ar: 'قيد العمل',  en: 'In progress' },
  { key: 'done',  ar: 'تمّ',        en: 'Done' },
];

/**
 * The lesson as a small board.
 *
 * Nothing on it is stored: watching is a progress row, doing the assignment is
 * a submission, review is its status, documenting is a published link on that
 * submission. Move the work and the board moves — it cannot disagree with the
 * course page or the mentor's queue, because it is reading the same rows.
 */
export async function LessonBoard({ steps }: { steps: Step[] }) {
  const t = await getT();

  return (
    <section className="panel section-block" aria-labelledby="lesson-board">
      <h3 id="lesson-board" style={{ fontSize: '0.98rem' }}>{t('خطوات هذا الدرس', 'This lesson, step by step')}</h3>
      <div className="kanban" style={{ marginTop: 12 }}>
        {COLUMNS.map((column) => {
          const inColumn = steps.filter((step) => step.column_key === column.key);
          return (
            <div className="kanban-column" key={column.key}>
              <div className="kanban-head">
                <span>{t(column.ar, column.en)}</span>
                <span className="kanban-count eng">{inColumn.length}</span>
              </div>
              {inColumn.length === 0 ? (
                <p className="kanban-empty">{t('لا شيء هنا', 'Nothing here')}</p>
              ) : (
                inColumn.map((step) => (
                  <article className="kanban-card" key={step.step_key}>
                    <span className="kanban-kind">
                      {step.is_optional ? t('اختياري', 'Optional') : t('خطوة', 'Step')}
                    </span>
                    <strong style={{ fontSize: '0.86rem' }}>
                      {contentText(t.locale, step.title_ar, step.title_en)}
                    </strong>
                    {step.detail_ar && <p className="muted">{step.detail_ar}</p>}
                  </article>
                ))
              )}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
        {t('اللوحة تقرأ عملك الفعلي: التقدّم، التسليم، المراجعة، والنشر. لا تُحرَّك يدوياً.',
           'The board reads your actual work: progress, submission, review and publishing. It is not moved by hand.')}
      </p>
    </section>
  );
}
