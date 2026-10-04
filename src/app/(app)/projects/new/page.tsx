import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';

import { NewPersonalProjectForm } from './NewPersonalProjectForm';

export const generateMetadata = localizedTitle('مشروع جديد — TechMood', 'New project — TechMood');

/**
 * Any member, any role: a project page of their own, for the gallery, the
 * market or both (0121). It need not come from the academy; when it does
 * (?assignment=… from a hand-in), it is linked to that submission.
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; assignment?: string; type?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const params = await searchParams;
  const intent = params.intent === 'market' || params.intent === 'both' ? params.intent : 'gallery';

  // Only a hand-in of one's own is offered as the link.
  let assignmentTitle: string | null = null;
  let assignmentId: string | null = null;
  if (params.assignment && /^[0-9a-f-]{36}$/.test(params.assignment)) {
    const { data: mine } = await supabase
      .from('submissions').select('id, assignments(title_ar)')
      .eq('assignment_id', params.assignment).eq('profile_id', user.id).maybeSingle();
    if (mine) {
      assignmentId = params.assignment;
      assignmentTitle = (mine.assignments as unknown as { title_ar: string } | null)?.title_ar ?? null;
    }
  }

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/projects">{t('مشاريعي', 'My projects')}</Link> / <span>{t('مشروع جديد', 'New project')}</span>
      </nav>
      <section className="section-block">
        <h2>{t('مشروع جديد', 'New project')}</h2>
        <p className="muted" style={{ marginTop: 6, maxWidth: '68ch' }}>
          {t('صفحة واحدة لمشروعك: صور، وصف، ديمو وروابط، وتقنيات. تنشرها في المعرض فوراً، و/أو تعرضها للبيع في السوق بعد مراجعة TechMood. لا يشترط أن يكون المشروع من الأكاديمية.',
             'One page for your project: pictures, a description, a demo and links, technologies. Publish it in the gallery at once, and/or sell it in the market after TechMood checks it. It need not come from the academy.')}
        </p>
      </section>
      <NewPersonalProjectForm intent={intent} assignmentId={assignmentId} assignmentTitle={assignmentTitle}
                             defaultType={params.type === 'digital_service' ? 'digital_service' : 'full_project'} />
    </>
  );
}
