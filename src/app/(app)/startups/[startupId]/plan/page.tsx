import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { PLAN_SECTIONS } from '@/lib/incubator';
import type { BusinessPlanSection } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { PlanSectionCard } from './PlanSectionCard';

export default async function BusinessPlanPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase.from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: sections }, { data: progress }, { data: canEdit }] = await Promise.all([
    supabase.from('business_plan_sections').select('*').eq('startup_id', startupId),
    supabase.from('business_plan_progress').select('*').eq('startup_id', startupId).maybeSingle(),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
  ]);

  const byKey = new Map((sections ?? []).map((row) => [row.section, row as BusinessPlanSection]));
  const percent = progress?.percent ?? 0;

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — خطة العمل', ' — business plan')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('عشرة أقسام. اكتب ما تعرفه الآن، وعلّم القسم مكتملاً حين يصبح جاهزاً — لا يمكن تعليم قسم فارغ كمكتمل.',
             'Ten sections. Write what you know now and mark a section complete when it is ready — an empty section cannot be marked complete.')}
        </p>

        <div className="row-between" style={{ marginTop: 16 }}>
          <span className="muted" style={{ fontSize: '0.82rem' }}>
            {t(`${progress?.completed_sections ?? 0} من 10 أقسام مكتملة`,
               `${progress?.completed_sections ?? 0} of 10 sections complete`)}
          </span>
          <span className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>{percent}%</span>
        </div>
        <div className="progress-track" style={{ marginTop: 6 }}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <StartupNav startupId={startupId} />

      {PLAN_SECTIONS.map((section) => (
        <PlanSectionCard
          key={section.key}
          startupId={startupId}
          sectionKey={section.key}
          label={section.label}
          hint={section.hint}
          value={byKey.get(section.key) ?? null}
          canEdit={canEdit === true}
        />
      ))}
    </>
  );
}
