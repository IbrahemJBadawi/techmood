import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import type { ProjectStatus } from '@/lib/database.types';

import { setProjectStatus } from './actions';
import { DeliverableForm, MilestoneForm } from './WorkForms';

const STATUS: Record<ProjectStatus, { text: Text; className: string }> = {
  planning:    { text: { ar: 'تخطيط',  en: 'Planning' },    className: 'status-muted' },
  in_progress: { text: { ar: 'جارٍ',    en: 'In progress' }, className: 'status-pending' },
  in_review:   { text: { ar: 'مراجعة', en: 'In review' },   className: 'status-pending' },
  completed:   { text: { ar: 'مكتمل',  en: 'Completed' },   className: 'status-ok' },
  archived:    { text: { ar: 'مؤرشف',  en: 'Archived' },    className: 'status-muted' },
};

/**
 * The work a market opening turned into.
 *
 * This page exists because "accepted" used to be where the record stopped. The
 * work is what a mentor can evaluate, what the exhibition can show and what
 * reputation is built from — so it has dates, deliverables and a state, and
 * both sides can see it: the person doing it, and the person paying for it.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, code, title_ar, description_ar, owner_id, client_id, opportunity_id, status, kind, agreed_amount_usd, created_at')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) notFound();

  const isOwner = project.owner_id === user.id;
  const isClient = project.client_id === user.id;

  const [{ data: people }, { data: milestones }, { data: evidence }, { data: entry }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id')
      .in('id', [project.owner_id, project.client_id].filter(Boolean) as string[]),
    supabase.from('project_milestones').select('id, title_ar, due_on, is_done')
      .eq('project_id', projectId).order('due_on', { nullsFirst: false }),
    supabase.from('project_evidence').select('id, kind, url, label').eq('project_id', projectId),
    supabase.from('exhibition_entries').select('id, status').eq('project_id', projectId).maybeSingle(),
  ]);

  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const status = STATUS[project.status];

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/marketplace?tab=work">
        {t('→ رجوع لعملي', '← Back to my work')}
      </Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <span className="id-chip">{project.code}</span>
            <h2 style={{ fontSize: '1.2rem', marginTop: 8 }}>{project.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
              {t('ينفّذه ', 'Built by ')}{nameOf.get(project.owner_id) ?? '—'}
              {project.client_id && ` · ${t('لصالح ', 'for ')}${nameOf.get(project.client_id) ?? '—'}`}
            </p>
          </div>
          <div style={{ textAlign: 'start' }}>
            <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
            {project.agreed_amount_usd !== null && (
              <p className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', marginTop: 8 }}>
                ${project.agreed_amount_usd}
              </p>
            )}
          </div>
        </div>

        {project.description_ar && (
          <p style={{ fontSize: '0.9rem', marginTop: 14, whiteSpace: 'pre-wrap' }}>{project.description_ar}</p>
        )}

        {isOwner && project.status !== 'completed' && (
          <form action={setProjectStatus} className="row-actions" style={{ marginTop: 16 }}>
            <input type="hidden" name="project_id" value={projectId} />
            <button className="btn btn-ghost btn-sm" name="status" value="in_progress">
              {t('بدأت العمل', 'Started')}
            </button>
            <button className="btn btn-ghost btn-sm" name="status" value="in_review">
              {t('جاهز للمراجعة', 'Ready for review')}
            </button>
            <button className="btn btn-primary btn-sm" name="status" value="completed">
              {t('أنهيت العمل', 'Finished')}
            </button>
          </form>
        )}

        {project.opportunity_id && (
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 12 }}>
            {t('هذا العمل جاء من فرصة في السوق. ', 'This work came from an opening in the market. ')}
            <Link href={`/marketplace/${project.opportunity_id}`}>{t('افتح الفرصة', 'Open it')}</Link>
          </p>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('المواعيد', 'Milestones')}</h3>
            {(milestones ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
                {t('لا مواعيد بعد.', 'No dates yet.')}
              </p>
            ) : (
              <ul className="plain-list" style={{ marginTop: 12 }}>
                {(milestones ?? []).map((milestone) => (
                  <li className="row-between" key={milestone.id} style={{ fontSize: '0.88rem' }}>
                    <span>{milestone.is_done ? '✓ ' : '○ '}{milestone.title_ar}</span>
                    <span className="muted">
                      {milestone.due_on ? formatDate(locale, milestone.due_on) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && <div style={{ marginTop: 14 }}><MilestoneForm projectId={projectId} /></div>}
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('التسليمات', 'Deliverables')}</h3>
            {(evidence ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
                {t('لم يُرفق شيء بعد.', 'Nothing attached yet.')}
              </p>
            ) : (
              <ul className="plain-list" style={{ marginTop: 12 }}>
                {(evidence ?? []).map((item) => (
                  <li key={item.id} style={{ fontSize: '0.88rem' }}>
                    <a href={item.url} target="_blank" rel="noreferrer noopener">
                      {item.label ?? item.url}
                    </a>
                    <span className="muted eng"> · {item.kind}</span>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && <div style={{ marginTop: 14 }}><DeliverableForm projectId={projectId} /></div>}
          </div>
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('ماذا بعد؟', 'What comes next')}</h3>

          <ul className="plain-list" style={{ fontSize: '0.86rem' }}>
            <li>
              {t('واجهت مشكلة؟ ', 'Stuck on something? ')}
              <Link href="/mentors">{t('احجز جلسة مع منتور', 'Book a mentor')}</Link>
            </li>
            {isOwner && project.status === 'completed' && !entry && (
              <li>
                {t('انتهى العمل — ', 'The work is done — ')}
                <Link href="/exhibition">{t('اعرضه في المعرض بعد تقييمه', 'submit it to the exhibition')}</Link>
              </li>
            )}
            {entry && (
              <li>
                {t('هذا العمل في المعرض. ', 'This work is in the exhibition. ')}
                <Link href="/exhibition">{t('افتحه', 'Open it')}</Link>
              </li>
            )}
            {isClient && (
              <li className="muted">
                {t('أنت ترى هذا العمل كصاحب الفرصة — التعديل لمن ينفّذه.',
                   'You see this as the client — changing it belongs to whoever is doing it.')}
              </li>
            )}
          </ul>

          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 14 }}>
            {t('العمل المنجز هنا هو ما يُقيَّم ويُعرض ويُبنى عليه سجلّك — لا مجرد سطر في سيرة ذاتية.',
               'Work finished here is what gets evaluated, exhibited and built into your record — not a line on a CV.')}
          </p>
        </aside>
      </div>
    </>
  );
}
