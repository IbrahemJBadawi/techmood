import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import type { ProjectLink } from '@/lib/database.types';
import { galleryPath } from '@/lib/showcase';

import { ShowcaseEditor, type AcademicOption } from './ShowcaseEditor';
import { DeleteShowcase, ListingEditor } from './ListingEditor';

export const generateMetadata = localizedTitle('صفحة المشروع — TechMood', 'Project page — TechMood');

/**
 * Editing a project's page (0121): the page itself, the gallery switch, the
 * market listing, the owner's numbers, and deleting it. Only its editors get
 * here; the database refuses anyone else's writes anyway.
 */
export default async function EditShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ intent?: string; new?: string }>;
}) {
  const { projectId } = await params;
  const { intent, new: isNew } = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/projects/${projectId}/edit`);

  const [{ data: project }, { data: canEdit }] = await Promise.all([
    supabase.from('projects')
      .select('id, code, title_ar, tagline_ar, description_ar, product_type, category, tags, skills, demo_url, video_url, links, images, in_gallery, gallery_hidden_note, submission_id, path_id, course_id, team_id, client_id')
      .eq('id', projectId).maybeSingle(),
    supabase.rpc('can_edit_showcase', { p_project: projectId }),
  ]);
  if (!project) notFound();
  if (canEdit !== true) redirect(`/projects/${projectId}`);
  if (project.client_id) {
    return <p className="notice notice-danger">{t('عمل نُفّذ لعميل لا يُعرض في المعرض ولا يُباع.', 'Work done for a client is neither exhibited nor sold.')}</p>;
  }

  const [{ data: listing }, { data: stats }, { data: subs }, { data: enrolments }] = await Promise.all([
    supabase.from('project_listings')
      .select('id, status, price_usd, licence, summary_ar, includes, demo_url, discount_pct, discount_ends_at, repeat_buyer_pct, negotiable, review_note_ar')
      .eq('project_id', projectId).maybeSingle(),
    supabase.rpc('my_project_stats', { p_project: projectId }),
    supabase.from('submissions').select('id, assignments(title_ar)').eq('profile_id', user.id).order('updated_at', { ascending: false }).limit(40),
    supabase.from('enrollments').select('path_id, course_id, learning_paths(title_ar), courses(title_ar)').eq('profile_id', user.id),
  ]);
  // The hidden delivery link, readable by its seller (0099).
  const { data: realDelivery } = listing
    ? await supabase.rpc('listing_delivery_url', { p_listing: listing.id })
    : { data: null };

  const academicOptions: AcademicOption[] = [
    ...(subs ?? []).map((row) => ({
      value: `submission:${row.id}`,
      label: `${t('تسليم', 'Hand-in')}: ${(row.assignments as unknown as { title_ar: string } | null)?.title_ar ?? '—'}`,
    })),
    ...(enrolments ?? []).filter((row) => row.path_id).map((row) => ({
      value: `path:${row.path_id}`,
      label: `${t('مسار', 'Path')}: ${(row.learning_paths as unknown as { title_ar: string } | null)?.title_ar ?? '—'}`,
    })),
    ...(enrolments ?? []).filter((row) => row.course_id).map((row) => ({
      value: `course:${row.course_id}`,
      label: `${t('دورة', 'Course')}: ${(row.courses as unknown as { title_ar: string } | null)?.title_ar ?? '—'}`,
    })),
  ];
  const academic = project.submission_id ? `submission:${project.submission_id}`
    : project.path_id && !project.team_id ? `path:${project.path_id}`
    : project.course_id ? `course:${project.course_id}` : '';
  // the current link stays selectable even if it is not in the lists above
  if (academic && !academicOptions.some((option) => option.value === academic)) {
    academicOptions.unshift({ value: academic, label: t('الارتباط الحالي', 'The current link') });
  }

  const s = stats?.[0];
  const wantsMarket = intent === 'market' || intent === 'both' || Boolean(listing);

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/projects">{t('مشاريعي', 'My projects')}</Link> / <Link href={`/projects/${projectId}`}>{project.title_ar}</Link> / <span>{t('تعديل الصفحة', 'Edit page')}</span>
      </nav>

      <section className="section-block row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>{t('صفحة المشروع', 'Project page')}</h2>
          <p className="muted eng" style={{ fontSize: '0.84rem' }}>{project.code}</p>
        </div>
        <Link className="btn btn-ghost btn-sm" href={galleryPath(project.code)} target="_blank">{t('معاينة الصفحة ↗', 'Preview the page ↗')}</Link>
      </section>

      {isNew && (
        <p className="notice notice-ok section-block">
          {t('أُنشئ المشروع. أضف الصور والوصف والروابط، ثم انشره في المعرض و/أو اعرضه للبيع.',
             'Created. Add pictures, a description and links, then publish it in the gallery and/or put it up for sale.')}
        </p>
      )}

      {s && (
        <section className="sc-stats section-block" aria-label={t('إحصائيات المشروع', 'Project numbers')}>
          <span>❤️ <b className="eng">{s.likes}</b> {t('إعجاب', 'likes')}</span>
          <span>👁️ <b className="eng">{s.views}</b> {t('مشاهدة', 'views')}</span>
          <span>🔗 <b className="eng">{s.link_clicks}</b> {t('ضغطة رابط', 'link clicks')}</span>
          <span>🛒 <b className="eng">{s.sales_count}</b> {t('مبيعات', 'sales')}</span>
          <span>💵 <b className="eng">{money(s.revenue_usd)}</b> {t('صافي', 'net')}</span>
          <span>⭐ <b className="eng">{s.rating ?? '—'}</b> ({s.reviews_count})</span>
          {s.open_offers > 0 && <Link href="/marketplace?tab=offers">💬 <b className="eng">{s.open_offers}</b> {t('عروض سعر تنتظرك', 'offers waiting')}</Link>}
        </section>
      )}

      <ShowcaseEditor
        academicOptions={academicOptions}
        project={{
          id: project.id, title: project.title_ar, tagline: project.tagline_ar ?? '', description: project.description_ar ?? '',
          product_type: project.product_type, category: project.category,
          technologies: project.tags ?? [], skills: project.skills ?? [],
          demo_url: project.demo_url ?? '', video_url: project.video_url ?? '',
          links: (project.links as ProjectLink[] | null) ?? [], images: project.images ?? [],
          in_gallery: project.in_gallery, hidden_note: project.gallery_hidden_note, academic,
          is_team: Boolean(project.team_id),
        }}
      />

      {wantsMarket ? (
        <ListingEditor projectId={projectId} listing={listing ? { ...listing, delivery_url: (realDelivery as string | null) ?? null } : null} />
      ) : (
        <section className="panel section-block">
          <h3 className="sc-h">🛒 {t('البيع في السوق', 'Selling in the market')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>{t('تريد بيعه أيضاً؟ ', 'Want to sell it too? ')}
            <Link href={`/projects/${projectId}/edit?intent=both#sell`}>{t('اعرضه للبيع', 'Put it up for sale')}</Link></p>
        </section>
      )}

      {!project.team_id && <DeleteShowcase projectId={projectId} />}
    </>
  );
}
