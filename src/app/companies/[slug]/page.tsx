import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { CANVAS_KIND, ORG_KIND, STARTUP_STAGES } from '@/lib/incubator';
import type { CanvasKind } from '@/lib/database.types';

export const metadata = { title: 'A TechMood company' };

/**
 * The company as the world sees it.
 *
 * Nothing here is written for this page: the stage comes from the ladder it
 * actually climbed, the projects from work that was finished, the canvases from
 * whichever walls the company decided to open. A showcase that could say
 * anything would be worth nothing, so this one can only repeat what the
 * workspace already proved.
 */
export default async function CompanyShowcase({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from('startups')
    .select('id, slug, name_ar, kind, one_liner_ar, description_ar, problem_ar, solution_ar, industry_ar, location_ar, website_url, logo_url, stage, founded_on, is_public')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();

  if (!company) notFound();

  const [{ data: canvases }, { data: projects }, { data: history }, { data: members }] = await Promise.all([
    supabase.from('canvases')
      .select('id, kind, title_ar, summary_ar')
      .eq('startup_id', company.id)
      .eq('visibility', 'public'),
    supabase.from('projects')
      .select('id, title_ar, description_ar, status')
      .eq('startup_id', company.id)
      .in('status', ['completed', 'sold'])
      .eq('is_public', true),
    supabase.from('startup_stage_history')
      .select('stage, note_ar, changed_at')
      .eq('startup_id', company.id)
      .order('changed_at'),
    supabase.from('startup_members')
      .select('profile_id, role, title_ar')
      .eq('startup_id', company.id)
      .in('role', ['founder', 'cofounder', 'manager']),
  ]);

  const ids = (members ?? []).map((row) => row.profile_id);
  const { data: people } = await supabase
    .from('profiles').select('id, full_name, techmood_id, headline')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const stage = STARTUP_STAGES.find((row) => row.key === company.stage);

  return (
    <main className="public-page">
      <section className="panel section-block">
        <p className="kicker">{t(ORG_KIND[company.kind])}</p>
        <h1 style={{ fontSize: '1.6rem', marginTop: 6 }}>{company.name_ar}</h1>
        {company.one_liner_ar && (
          <p className="muted" style={{ fontSize: '1rem', marginTop: 8 }}>{company.one_liner_ar}</p>
        )}

        <div className="tags-row" style={{ marginTop: 14 }}>
          {stage && <span className="badge-pill">{t(stage.label)}</span>}
          {company.industry_ar && <span className="badge-pill">{company.industry_ar}</span>}
          {company.location_ar && <span className="badge-pill">{company.location_ar}</span>}
          {company.founded_on && (
            <span className="badge-pill eng">{formatDate(locale, company.founded_on)}</span>
          )}
          {company.website_url && (
            <a className="badge-pill eng" href={company.website_url} target="_blank" rel="noreferrer noopener">
              {t('الموقع ↗', 'Website ↗')}
            </a>
          )}
        </div>
      </section>

      {(company.problem_ar || company.solution_ar) && (
        <section className="panel section-block">
          {company.problem_ar && (
            <>
              <h2 className="profile-heading">{t('المشكلة', 'The problem')}</h2>
              <p style={{ fontSize: '0.92rem' }}>{company.problem_ar}</p>
            </>
          )}
          {company.solution_ar && (
            <>
              <h2 className="profile-heading" style={{ marginTop: 16 }}>{t('الحل', 'The solution')}</h2>
              <p style={{ fontSize: '0.92rem' }}>{company.solution_ar}</p>
            </>
          )}
        </section>
      )}

      {(history ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('الرحلة', 'The journey')}</h2>
          <ul className="plain-list">
            {(history ?? []).map((row, index) => {
              const rung = STARTUP_STAGES.find((option) => option.key === row.stage);
              return (
                <li className="row-between" key={`${row.stage}-${index}`} style={{ fontSize: '0.88rem' }}>
                  <span>
                    {rung ? t(rung.label) : row.stage}
                    {row.note_ar && <span className="muted"> · {row.note_ar}</span>}
                  </span>
                  <span className="muted">{formatDate(locale, row.changed_at)}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
            {t('كل مرحلة هنا فُتحت بعد إنجاز ما تطلبه، لا بإعلانها.',
               'Every stage here opened by meeting what it asked for, not by announcing it.')}
          </p>
        </section>
      )}

      {(projects ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('أعمال منجزة', 'Finished work')}</h2>
          <ul className="profile-list">
            {(projects ?? []).map((project) => (
              <li key={project.id}>
                <strong>{project.title_ar}</strong>
                {project.description_ar && <span className="muted">{project.description_ar}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(canvases ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('كيف تفكّر هذه الشركة', 'How this company thinks')}</h2>
          <ul className="profile-list">
            {(canvases ?? []).map((canvas) => (
              <li key={canvas.id}>
                <strong>{canvas.title_ar}</strong>
                <span className="muted">{canvas.summary_ar ?? t(CANVAS_KIND[canvas.kind as CanvasKind].hint)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(people ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('من يقودها', 'Who runs it')}</h2>
          <ul className="profile-list">
            {(people ?? []).map((person) => (
              <li key={person.id}>
                <Link href={`/u/${person.techmood_id}`}><strong>{person.full_name}</strong></Link>
                {person.headline && <span className="muted">{person.headline}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', margin: '24px 0' }}>
        {t('صفحة شركة على TechMood — كل ما فيها مأخوذ من عمل مسجَّل داخل المنصة.',
           'A company page on TechMood — everything on it is taken from work recorded inside the platform.')}
      </p>
    </main>
  );
}
