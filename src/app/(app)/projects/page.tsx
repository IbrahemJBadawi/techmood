import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';
import type { Text } from '@/lib/i18n';
import { mediaUrl } from '@/lib/showcase';

export const generateMetadata = localizedTitle('مشاريعي — TechMood', 'My projects — TechMood');

const STATUS: Record<string, { label: Text; pill: string }> = {
  planning:    { label: { ar: 'تخطيط', en: 'Planning' }, pill: 'status-muted' },
  in_progress: { label: { ar: 'قيد العمل', en: 'In progress' }, pill: 'status-pending' },
  in_review:   { label: { ar: 'قيد المراجعة', en: 'In review' }, pill: 'status-pending' },
  completed:   { label: { ar: 'مكتمل', en: 'Completed' }, pill: 'status-ok' },
  sold:        { label: { ar: 'مُباع', en: 'Sold' }, pill: 'status-ok' },
  archived:    { label: { ar: 'مؤرشف', en: 'Archived' }, pill: 'status-muted' },
};

const LISTING: Record<string, { label: Text; pill: string }> = {
  pending_review: { label: { ar: 'قيد مراجعة السوق', en: 'Market review' }, pill: 'status-pending' },
  listed:         { label: { ar: 'متاح للبيع', en: 'Available' }, pill: 'status-ok' },
  reserved:       { label: { ar: 'محجوز', en: 'Reserved' }, pill: 'status-pending' },
  sold:           { label: { ar: 'مباع', en: 'Sold' }, pill: 'status-ok' },
  withdrawn:      { label: { ar: 'غير متاح', en: 'Unavailable' }, pill: 'status-muted' },
  rejected:       { label: { ar: 'مرفوض', en: 'Refused' }, pill: 'status-danger' },
};

/**
 * Every project a member owns, whatever their role (0121): each is one page,
 * with where it stands in the gallery and the market, and the way to edit it.
 */
export default async function MyProjectsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, title_ar, status, updated_at, team_id, client_id, images, in_gallery, gallery_hidden_at, product_type, project_listings(status)')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <>
      <section className="section-block">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>{t('مشاريعي', 'My projects')}</h2>
          <div className="tags-row">
            <Link className="btn btn-primary btn-sm" href="/projects/new">{t('+ مشروع جديد', '+ New project')}</Link>
            <Link className="btn btn-sky btn-sm" href="/projects/new?intent=market&type=digital_service">{t('+ خدمة', '+ Service')}</Link>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 6, maxWidth: '68ch' }}>
          {t('كل مشروع صفحة واحدة: انشرها في المعرض، و/أو اعرضها للبيع في السوق. الأرقام (الإعجابات، المشاهدات، المبيعات) في صفحة تعديل كل مشروع.',
             'Each project is one page: publish it in the gallery and/or sell it in the market. The numbers (likes, views, sales) are on each project’s edit page.')}
        </p>
        {deleted && <p className="notice notice-ok" style={{ marginTop: 8 }}>{t('حُذف المشروع.', 'The project was deleted.')}</p>}
      </section>

      {(projects ?? []).length === 0 ? (
        <p className="notice section-block">
          {t('لا مشاريع لك بعد. ', 'No projects yet. ')}
          <Link href="/projects/new">{t('أضف مشروعك الأول', 'Add your first project')}</Link>
        </p>
      ) : (
        <ul className="sc-mine section-block">
          {(projects ?? []).map((project) => {
            const status = STATUS[project.status] ?? STATUS.planning;
            const listing = (project.project_listings as unknown as { status: string }[] | null)?.[0];
            const cover = mediaUrl((project.images as string[] | null)?.[0]);
            return (
              <li className="panel" key={project.id}>
                <span className="sc-mine-cover">
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" loading="lazy" />
                    : <span className="sc-card-initial">{project.title_ar.trim().charAt(0)}</span>}
                </span>
                <span className="sc-mine-body">
                  <Link href={`/projects/${project.id}`}><b>{project.title_ar}</b></Link>
                  <span className="muted eng" style={{ fontSize: '0.78rem' }}>{project.code}</span>
                  <span className="tags-row">
                    <span className={`status-pill ${status.pill}`}>{t(status.label)}</span>
                    {project.gallery_hidden_at
                      ? <span className="status-pill status-danger">{t('مخفي من TechMood', 'Hidden by TechMood')}</span>
                      : project.in_gallery && <span className="status-pill status-ok">🖼️ {t('في المعرض', 'In the gallery')}</span>}
                    {listing && <span className={`status-pill ${LISTING[listing.status]?.pill ?? 'status-muted'}`}>🛒 {t(LISTING[listing.status]?.label ?? { ar: listing.status, en: listing.status })}</span>}
                  </span>
                </span>
                {!project.client_id && (
                  <span className="sc-mine-actions">
                    <Link className="btn btn-primary btn-sm" href={`/projects/${project.id}/edit`}>{t('✎ الصفحة والبيع', '✎ Page & sale')}</Link>
                    <Link className="btn btn-ghost btn-sm" href={`/p/${project.code}`}>{t('عرض', 'View')}</Link>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
