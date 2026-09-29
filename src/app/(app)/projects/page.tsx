import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { Text } from '@/lib/i18n';

export const generateMetadata = localizedTitle('مشاريعي — TechMood', 'My projects — TechMood');

const STATUS: Record<string, { label: Text; pill: string }> = {
  planning:    { label: { ar: 'تخطيط', en: 'Planning' }, pill: 'status-muted' },
  in_progress: { label: { ar: 'قيد العمل', en: 'In progress' }, pill: 'status-pending' },
  in_review:   { label: { ar: 'قيد المراجعة', en: 'In review' }, pill: 'status-pending' },
  completed:   { label: { ar: 'مكتمل', en: 'Completed' }, pill: 'status-ok' },
  sold:        { label: { ar: 'مُباع', en: 'Sold' }, pill: 'status-ok' },
  archived:    { label: { ar: 'مؤرشف', en: 'Archived' }, pill: 'status-muted' },
};

/**
 * Every project a member owns, whatever their role, with where each stands in
 * the exhibition and the market. The way into both: create a project here,
 * complete it on its page, then send it to the exhibition or put it up for sale.
 */
export default async function MyProjectsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, title_ar, status, updated_at, team_id, exhibition_entries(status), project_listings(status)')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <>
      <section className="section-block">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>{t('مشاريعي', 'My projects')}</h2>
          <Link className="btn btn-primary btn-sm" href="/projects/new">{t('+ مشروع جديد', '+ New project')}</Link>
        </div>
        <p className="muted" style={{ marginTop: 6, maxWidth: '68ch' }}>
          {t('أنشئ مشروعك، أكمله من صفحته، ثم قدّمه للمعرض أو اعرضه للبيع في السوق.',
             'Create your project, complete it from its page, then send it to the exhibition or put it up for sale in the market.')}
        </p>
      </section>

      {(projects ?? []).length === 0 ? (
        <p className="notice section-block">
          {t('لا مشاريع لك بعد. ', 'No projects yet. ')}
          <Link href="/projects/new">{t('أضف مشروعك الأول', 'Add your first project')}</Link>
        </p>
      ) : (
        <ul className="studio-list panel section-block">
          {(projects ?? []).map((project) => {
            const status = STATUS[project.status] ?? STATUS.planning;
            const entry = (project.exhibition_entries as unknown as { status: string }[] | null)?.[0];
            const listing = (project.project_listings as unknown as { status: string }[] | null)?.[0];
            return (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>{project.title_ar}</Link>
                <span className="muted eng">{project.code}</span>
                {entry && <span className="status-pill status-muted">{t('في المعرض', 'Exhibition')}: {entry.status}</span>}
                {listing && <span className="status-pill status-muted">{t('في السوق', 'Market')}: {listing.status}</span>}
                <span className={`status-pill ${status.pill}`}>{t(status.label)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
