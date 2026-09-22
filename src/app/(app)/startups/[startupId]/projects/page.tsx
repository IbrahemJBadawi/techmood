import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import type { ProjectStatus } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';

const STATUS: Record<ProjectStatus, Text> = {
  planning:    { ar: 'تخطيط',  en: 'Planning' },
  in_progress: { ar: 'جارٍ',    en: 'In progress' },
  in_review:   { ar: 'مراجعة', en: 'In review' },
  completed:   { ar: 'مكتمل',  en: 'Completed' },
  sold:        { ar: 'مُباع',   en: 'Sold' },
  archived:    { ar: 'مؤرشف',  en: 'Archived' },
};

/**
 * What the company is actually building. Most of these arrive from a card on a
 * canvas — which is the whole point of having the canvases in the same room.
 */
export default async function StartupProjectsPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, title_ar, description_ar, status, created_at')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false });

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — المشاريع', ' — projects')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/canvases`}>
            {t('من لوحة إلى مشروع', 'From a canvas to a project')}
          </Link>
        </div>
      </section>

      <StartupNav startupId={startupId} />

      {(projects ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا مشاريع بعد', 'No projects yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('افتح لوحة، اختر بطاقة، واجعلها مشروعاً — هكذا تتحوّل الفكرة إلى عمل له صاحب وموعد.',
               'Open a canvas, pick a card, and make it a project — that is how an idea becomes work with an owner and a date.')}
          </p>
          <Link className="btn btn-primary btn-sm" href={`/startups/${startupId}/canvases`}>
            {t('افتح اللوحات', 'Open the canvases')}
          </Link>
        </div>
      ) : (
        <div className="stack section-block">
          {(projects ?? []).map((project) => (
            <article className="panel session-row" key={project.id}>
              <div style={{ minWidth: 0 }}>
                <span className="id-chip">{project.code}</span>
                <h3 style={{ fontSize: '0.95rem', marginTop: 8 }}>{project.title_ar}</h3>
                {project.description_ar && (
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>{project.description_ar}</p>
                )}
                <p className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                  {formatDate(locale, project.created_at)}
                </p>
              </div>

              <div className="session-row-actions">
                <span className="status-pill status-muted">{t(STATUS[project.status])}</span>
                <Link className="btn btn-ghost btn-sm" href={`/projects/${project.id}`}>{t('افتح', 'Open')}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
