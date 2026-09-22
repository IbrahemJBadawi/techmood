'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ExhibitionStatus, ProjectStatus } from '@/lib/database.types';

import { setExhibited, setProjectStatus, submitToExhibition, type ProjectState } from './actions';
import { useT } from '@/lib/i18n.client';
import type { Text } from '@/lib/i18n';

const PROJECT_STATUS: Record<ProjectStatus, { text: Text; className: string }> = {
  planning:    { text: { ar: 'تخطيط',       en: 'Planning' },    className: 'status-muted' },
  in_progress: { text: { ar: 'قيد التنفيذ', en: 'In progress' }, className: 'status-pending' },
  in_review:   { text: { ar: 'قيد المراجعة',en: 'In review' },   className: 'status-pending' },
  completed:   { text: { ar: 'مكتمل',       en: 'Completed' },   className: 'status-ok' },
  sold:        { text: { ar: 'مُباع', en: 'Sold' }, className: 'status-ok' },
  archived:    { text: { ar: 'مؤرشف',       en: 'Archived' },    className: 'status-muted' },
};

const ENTRY_STATUS: Record<ExhibitionStatus, { text: Text; className: string }> = {
  draft:             { text: { ar: 'مسودّة',                 en: 'Draft' },              className: 'status-muted' },
  submitted:         { text: { ar: 'بانتظار مراجعة منتور',  en: 'Awaiting a mentor' },  className: 'status-pending' },
  under_review:      { text: { ar: 'قيد المراجعة',          en: 'Under review' },       className: 'status-pending' },
  revision_required: { text: { ar: 'مطلوب تعديل',           en: 'Revision required' },  className: 'status-danger' },
  approved:          { text: { ar: 'معتمد — لم يُعرض بعد',  en: 'Approved — not on the wall yet' }, className: 'status-pending' },
  exhibited:         { text: { ar: 'معروض في المعرض',       en: 'In the exhibition' },  className: 'status-ok' },
  rejected:          { text: { ar: 'لم يُقبل في المعرض',     en: 'Not accepted' },       className: 'status-danger' },
};

export function ProjectCard({
  teamId,
  project,
  entry,
  taskCount,
  doneCount,
  canManage,
}: {
  teamId: string;
  project: {
    id: string; code: string; title_ar: string; description_ar: string | null;
    status: ProjectStatus; tags: string[]; completed_at: string | null;
  };
  entry: { id: string; entry_code: string; status: ExhibitionStatus; review_note_ar: string | null } | null;
  taskCount: number;
  doneCount: number;
  canManage: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitToExhibition, undefined as ProjectState);
  const [exhibitState, exhibitAction, exhibiting] = useActionState(setExhibited, undefined as ProjectState);
  const [showForm, setShowForm] = useState(false);

  const status = PROJECT_STATUS[project.status];
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const isPublished = entry?.status === 'exhibited';
  // Approval is the mentor's judgement; going public is the builder's call.
  const canExhibit = canManage && entry?.status === 'approved';
  const canSubmit = canManage && project.status === 'completed' && !isPublished;

  return (
    <article className="panel section-block">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1rem' }}>{project.title_ar}</h3>
          <span className="id-chip" style={{ marginTop: 6, display: 'inline-block' }}>{project.code}</span>
        </div>
        <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
      </div>

      {project.description_ar && (
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 10 }}>{project.description_ar}</p>
      )}

      <div className="tags-row" style={{ marginTop: 10 }}>
        {(project.tags ?? []).map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
      </div>

      <div className="progress-track" style={{ marginTop: 14 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="row-between" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: 6 }}>
        <span className="eng">{doneCount}/{taskCount} {t('مهمة', 'tasks')}</span>
        <span className="eng">{progress}%</span>
      </div>

      {entry && (
        <div className="row-between" style={{ marginTop: 14 }}>
          <span className={`status-pill ${ENTRY_STATUS[entry.status].className}`}>
            {t(ENTRY_STATUS[entry.status].text)}
          </span>
          {isPublished && (
            <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
              {t('عرض في المعرض ↗', 'View in the exhibition ↗')}
            </Link>
          )}
        </div>
      )}

      {(entry?.status === 'revision_required' || entry?.status === 'rejected') && entry.review_note_ar && (
        <p className="notice notice-danger" style={{ marginTop: 12 }}>{entry.review_note_ar}</p>
      )}

      {(canExhibit || isPublished) && entry && canManage && (
        <form action={exhibitAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="entry_id" value={entry.id} />
          <input type="hidden" name="team_id" value={teamId} />
          <input type="hidden" name="public" value={isPublished ? 'false' : 'true'} />
          <button className={`btn btn-sm ${isPublished ? 'btn-ghost' : 'btn-primary'}`} disabled={exhibiting}>
            {exhibiting
              ? t('جارٍ…', 'Working…')
              : isPublished
                ? t('اسحبه من المعرض', 'Take it off the wall')
                : t('اعرضه في المعرض', 'Put it on the wall')}
          </button>
          {exhibitState?.error && <p className="notice notice-danger" style={{ marginTop: 8 }}>{exhibitState.error}</p>}
          {exhibitState?.ok && <p className="notice" style={{ marginTop: 8 }}>{exhibitState.ok}</p>}
          {canExhibit && (
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 8 }}>
              {t('اعتمده منتور. عرضه قرارك أنت.', 'A mentor approved it. Whether it goes public is your call.')}
            </p>
          )}
        </form>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {(['planning', 'in_progress', 'in_review', 'completed'] as ProjectStatus[])
            .filter((value) => value !== project.status)
            .map((value) => (
              <form action={setProjectStatus} key={value}>
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="team_id" value={teamId} />
                <input type="hidden" name="status" value={value} />
                <button className="btn btn-ghost btn-sm" style={{ padding: '5px 11px', fontSize: '0.74rem' }}>
                  {t(PROJECT_STATUS[value].text)}
                </button>
              </form>
            ))}
        </div>
      )}

      {canSubmit && !showForm && (
        <button className="btn btn-sky btn-sm" style={{ marginTop: 14 }} onClick={() => setShowForm(true)}>
          {entry ? t('أعد التقديم للمعرض', 'Resubmit to the exhibition') : t('قدّم للمعرض', 'Submit to the exhibition')}
        </button>
      )}

      {canSubmit && showForm && (
        <form action={formAction} style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="team_id" value={teamId} />

          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
            {t('لا حاجة لسرد من فعل ماذا — نصيب كل عضو يُحسب تلقائياً من المهام التي أنجزها.', 'No need to list who did what — each member’s share is computed from the tasks they closed.')}
          </p>

          <div className="field">
            <label htmlFor={`summary-${project.id}`}>{t('ملخص العمل', 'Summary of the work')}</label>
            <textarea id={`summary-${project.id}`} name="summary" rows={3} required />
          </div>

          <div className="field">
            <label htmlFor={`tech-${project.id}`}>{t('التقنيات (مفصولة بفاصلة)', 'Technologies (comma separated)')}</label>
            <input id={`tech-${project.id}`} name="technologies" dir="ltr" defaultValue={(project.tags ?? []).join(', ')} />
          </div>

          <div className="field">
            <label htmlFor={`demo-${project.id}`}>{t('رابط العرض التجريبي', 'Demo link')}</label>
            <input id={`demo-${project.id}`} name="demo_url" type="url" dir="ltr" placeholder="https://" />
          </div>

          <div className="field">
            <label htmlFor={`problem-${project.id}`}>{t('المشكلة التي يعالجها', 'The problem it solves')}</label>
            <textarea id={`problem-${project.id}`} name="problem" rows={2} />
          </div>

          <div className="field">
            <label htmlFor={`solution-${project.id}`}>{t('الحل الذي بنيتموه', 'The solution you built')}</label>
            <textarea id={`solution-${project.id}`} name="solution" rows={2} />
          </div>

          <div className="field">
            <label htmlFor={`outcomes-${project.id}`}>{t('ماذا بُني فعلاً — سطر لكل شيء', 'What was actually built — one per line')}</label>
            <textarea id={`outcomes-${project.id}`} name="outcomes" rows={4} />
          </div>

          <div className="field">
            <label htmlFor={`cover-${project.id}`}>{t('صورة المشروع', 'A cover image')}</label>
            <input id={`cover-${project.id}`} name="cover_url" type="url" dir="ltr" placeholder="https://" />
          </div>

          <div className="field">
            <label htmlFor={`docs-${project.id}`}>{t('ملاحظة عن التوثيق', 'A note about the documentation')}</label>
            <textarea id={`docs-${project.id}`} name="documentation" rows={2} />
          </div>

          {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
          {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? t('جارٍ التقديم…', 'Submitting…') : t('قدّم للمعرض', 'Submit to the exhibition')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      )}
    </article>
  );
}
