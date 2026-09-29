import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT, localizedTitle } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';

import { NewPersonalProjectForm } from './NewPersonalProjectForm';

export const generateMetadata = localizedTitle('مشروع جديد — TechMood', 'New project — TechMood');

/** Any member, any role: a project of their own, headed for the exhibition or the market. */
export default async function NewProjectPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  return (
    <>
      <nav className="crumbs" aria-label={t('مسار التنقل', 'Breadcrumb')}>
        <Link href="/projects">{t('مشاريعي', 'My projects')}</Link> / <span>{t('مشروع جديد', 'New project')}</span>
      </nav>
      <section className="section-block">
        <h2>{t('مشروع جديد', 'New project')}</h2>
        <p className="muted" style={{ marginTop: 6, maxWidth: '68ch' }}>
          {t('أضف مشروعك، ثم من صفحته: أكمله، وقدّمه للمعرض ليظهر في ملفك وجوازك، أو اعرضه للبيع في السوق. كلاهما تراجعه TechMood قبل أن يظهر.',
             'Add your project, then from its page: complete it, send it to the exhibition so it shows on your profile and passport, or put it up for sale in the market. TechMood reviews both before they show.')}
        </p>
      </section>
      <NewPersonalProjectForm />
    </>
  );
}
