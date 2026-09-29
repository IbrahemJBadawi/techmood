'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ExhibitionStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';
import { useT } from '@/lib/i18n.client';

import { setProjectExhibited, submitProjectToExhibition, type ExhibitState } from '../actions-personal';

const ENTRY_STATUS: Record<ExhibitionStatus, { text: Text; className: string }> = {
  draft:             { text: { ar: 'مسودّة', en: 'Draft' }, className: 'status-muted' },
  submitted:         { text: { ar: 'بانتظار مراجعة منتور', en: 'Awaiting a mentor' }, className: 'status-pending' },
  under_review:      { text: { ar: 'قيد المراجعة', en: 'Under review' }, className: 'status-pending' },
  revision_required: { text: { ar: 'مطلوب تعديل', en: 'Revision required' }, className: 'status-danger' },
  approved:          { text: { ar: 'اعتمده منتور — اعرضه متى شئت', en: 'Approved — put it on the wall when you like' }, className: 'status-pending' },
  exhibited:         { text: { ar: 'معروض في المعرض', en: 'In the exhibition' }, className: 'status-ok' },
  rejected:          { text: { ar: 'لم يُقبل في المعرض', en: 'Not accepted' }, className: 'status-danger' },
};

/**
 * The exhibition, from the project's own page (for its owner): send it once it
 * is complete, see where the review stands, and put it on the wall — or take
 * it down — once a mentor approved it.
 */
export function ExhibitionPanel({
  projectId,
  completed,
  tags,
  entry,
}: {
  projectId: string;
  completed: boolean;
  tags: string[];
  entry: { id: string; entry_code: string; status: ExhibitionStatus; review_note_ar: string | null } | null;
}) {
  const t = useT();
  const [state, submit, submitting] = useActionState(submitProjectToExhibition, undefined as ExhibitState);
  const [shown, exhibit, exhibiting] = useActionState(setProjectExhibited, undefined as ExhibitState);
  const [open, setOpen] = useState(false);

  const onWall = entry?.status === 'exhibited';
  const canSubmit = completed && !onWall && entry?.status !== 'submitted' && entry?.status !== 'under_review';
  const look = entry ? ENTRY_STATUS[entry.status] : null;

  return (
    <section className="hm-card section-block">
      <h3 className="pj-h">{t('المعرض', 'The exhibition')}</h3>

      {!completed && !entry && (
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {t('حين تنهي المشروع («أنهيت العمل» أعلاه) تقدّمه للمعرض من هنا، ويراجعه منتور قبل أن يظهر.',
             'Once you finish the project (“Finished” above) you send it to the exhibition from here; a mentor reviews it before it shows.')}
        </p>
      )}

      {entry && look && (
        <p style={{ marginTop: 4 }}>
          <span className={`status-pill ${look.className}`}>{t(look.text)}</span>
          {onWall && <> <Link href={`/exhibition/${entry.entry_code}`}>{t('افتحه في المعرض ↗', 'Open it in the exhibition ↗')}</Link></>}
        </p>
      )}
      {(entry?.status === 'revision_required' || entry?.status === 'rejected') && entry.review_note_ar && (
        <p className="notice notice-danger" style={{ marginTop: 8 }}>{entry.review_note_ar}</p>
      )}

      {entry && (entry.status === 'approved' || onWall) && (
        <form action={exhibit} style={{ marginTop: 10 }}>
          <input type="hidden" name="entry_id" value={entry.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="public" value={onWall ? 'false' : 'true'} />
          <button className={`btn btn-sm ${onWall ? 'btn-ghost' : 'btn-primary'}`} disabled={exhibiting}>
            {exhibiting ? t('جارٍ…', 'Working…') : onWall ? t('اسحبه من المعرض', 'Take it off the wall') : t('اعرضه في المعرض', 'Put it on the wall')}
          </button>
          {shown?.error && <p className="notice notice-danger" style={{ marginTop: 8 }}>{shown.error}</p>}
          {shown?.ok && <p className="notice notice-ok" style={{ marginTop: 8 }}>{shown.ok}</p>}
        </form>
      )}

      {canSubmit && !open && (
        <button className="btn btn-sky btn-sm" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
          {entry ? t('أعد التقديم للمعرض', 'Resubmit to the exhibition') : t('قدّم للمعرض', 'Submit to the exhibition')}
        </button>
      )}

      {canSubmit && open && (
        <form action={submit} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="project_id" value={projectId} />
          <div className="field">
            <label htmlFor="ex-summary">{t('ملخص العمل', 'Summary of the work')}</label>
            <textarea id="ex-summary" name="summary" rows={3} required />
          </div>
          <div className="field">
            <label htmlFor="ex-tech">{t('التقنيات (مفصولة بفاصلة)', 'Technologies (comma separated)')}</label>
            <input id="ex-tech" name="technologies" dir="ltr" defaultValue={tags.join(', ')} />
          </div>
          <div className="field">
            <label htmlFor="ex-demo">{t('رابط العرض التجريبي', 'Demo link')}</label>
            <input id="ex-demo" name="demo_url" type="url" dir="ltr" placeholder="https://" />
          </div>
          <div className="field">
            <label htmlFor="ex-problem">{t('المشكلة التي يعالجها', 'The problem it solves')}</label>
            <textarea id="ex-problem" name="problem" rows={2} />
          </div>
          <div className="field">
            <label htmlFor="ex-solution">{t('الحل الذي بنيته', 'The solution you built')}</label>
            <textarea id="ex-solution" name="solution" rows={2} />
          </div>
          <div className="field">
            <label htmlFor="ex-outcomes">{t('ماذا بُني فعلاً — سطر لكل شيء', 'What was actually built — one per line')}</label>
            <textarea id="ex-outcomes" name="outcomes" rows={3} />
          </div>
          <div className="field">
            <label htmlFor="ex-cover">{t('رابط صورة للمشروع (اختياري)', 'A cover image link (optional)')}</label>
            <input id="ex-cover" name="cover_url" type="url" dir="ltr" placeholder="https://" />
          </div>
          {state?.error && <p className="notice notice-danger">{state.error}</p>}
          {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
          <div className="tags-row">
            <button className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? t('جارٍ التقديم…', 'Submitting…') : t('قدّم للمعرض', 'Submit to the exhibition')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
