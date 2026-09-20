'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ExhibitionStatus, ProjectStatus } from '@/lib/database.types';

import { setProjectStatus, submitToExhibition, type ProjectState } from './actions';

const PROJECT_STATUS: Record<ProjectStatus, { text: string; className: string }> = {
  planning: { text: 'تخطيط', className: 'status-muted' },
  in_progress: { text: 'قيد التنفيذ', className: 'status-pending' },
  in_review: { text: 'قيد المراجعة', className: 'status-pending' },
  completed: { text: 'مكتمل', className: 'status-ok' },
  archived: { text: 'مؤرشف', className: 'status-muted' },
};

const ENTRY_STATUS: Record<ExhibitionStatus, { text: string; className: string }> = {
  draft: { text: 'مسودّة', className: 'status-muted' },
  submitted: { text: 'بانتظار مراجعة المعرض', className: 'status-pending' },
  approved: { text: 'منشور في المعرض', className: 'status-ok' },
  rejected: { text: 'لم يُقبل في المعرض', className: 'status-danger' },
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
  const [state, formAction, pending] = useActionState(submitToExhibition, undefined as ProjectState);
  const [showForm, setShowForm] = useState(false);

  const status = PROJECT_STATUS[project.status];
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const isPublished = entry?.status === 'approved';
  const canSubmit = canManage && project.status === 'completed' && entry?.status !== 'approved';

  return (
    <article className="panel section-block">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1rem' }}>{project.title_ar}</h3>
          <span className="id-chip" style={{ marginTop: 6, display: 'inline-block' }}>{project.code}</span>
        </div>
        <span className={`status-pill ${status.className}`}>{status.text}</span>
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
        <span className="eng">{doneCount}/{taskCount} مهمة</span>
        <span className="eng">{progress}%</span>
      </div>

      {entry && (
        <div className="row-between" style={{ marginTop: 14 }}>
          <span className={`status-pill ${ENTRY_STATUS[entry.status].className}`}>
            {ENTRY_STATUS[entry.status].text}
          </span>
          {isPublished && (
            <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
              عرض في المعرض ↗
            </Link>
          )}
        </div>
      )}

      {entry?.status === 'rejected' && entry.review_note_ar && (
        <p className="notice notice-danger" style={{ marginTop: 12 }}>{entry.review_note_ar}</p>
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
                  {PROJECT_STATUS[value].text}
                </button>
              </form>
            ))}
        </div>
      )}

      {canSubmit && !showForm && (
        <button className="btn btn-sky btn-sm" style={{ marginTop: 14 }} onClick={() => setShowForm(true)}>
          {entry ? 'أعد التقديم للمعرض' : 'قدّم للمعرض'}
        </button>
      )}

      {canSubmit && showForm && (
        <form action={formAction} style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="team_id" value={teamId} />

          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
            لا حاجة لسرد من فعل ماذا — نصيب كل عضو يُحسب تلقائياً من المهام التي أنجزها.
          </p>

          <div className="field">
            <label htmlFor={`summary-${project.id}`}>ملخص العمل</label>
            <textarea id={`summary-${project.id}`} name="summary" rows={3} required />
          </div>

          <div className="field">
            <label htmlFor={`tech-${project.id}`}>التقنيات (مفصولة بفاصلة)</label>
            <input id={`tech-${project.id}`} name="technologies" dir="ltr" defaultValue={(project.tags ?? []).join(', ')} />
          </div>

          <div className="field">
            <label htmlFor={`demo-${project.id}`}>رابط العرض التجريبي</label>
            <input id={`demo-${project.id}`} name="demo_url" type="url" dir="ltr" placeholder="https://" />
          </div>

          <div className="field">
            <label htmlFor={`docs-${project.id}`}>ملاحظة عن التوثيق</label>
            <textarea id={`docs-${project.id}`} name="documentation" rows={2} />
          </div>

          {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
          {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? 'جارٍ التقديم…' : 'قدّم للمعرض'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </form>
      )}
    </article>
  );
}
