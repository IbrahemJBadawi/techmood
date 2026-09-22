import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { STARTUP_STAGES } from '@/lib/incubator';

export const metadata = { title: 'Companies I advise — TechMood' };

/**
 * The companies that let this mentor in.
 *
 * A mentor sees a company's walls because the company said so, by name and
 * until a date it chose — not because they once had a session with somebody
 * who works there.
 */
export default async function MentorCompaniesPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: companies } = await supabase.rpc('my_mentored_companies');

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('شركات أُرشدها', 'Companies I advise')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('ترى هنا ما فتحته لك كل شركة من لوحاتها — لا مساحة عملها كاملة. الوصول ينتهي في التاريخ الذي حدّدته الشركة.',
             'What you see here is whichever canvases each company opened to its mentors — not its whole workspace. The access ends on the date the company set.')}
        </p>
      </section>

      {(companies ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا شركة منحتك وصولاً بعد', 'No company has let you in yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('عندما تحجز شركة جلسة معك، أو تمنحك وصولاً بالاسم، تظهر هنا.',
               'When a company books a session with you, or grants you access by name, it appears here.')}
          </p>
          <Link className="btn btn-ghost btn-sm" href="/mentor-requests">{t('طلبات الجلسات', 'Session requests')}</Link>
        </div>
      ) : (
        <div className="stack">
          {(companies ?? []).map((company) => {
            const stage = STARTUP_STAGES.find((row) => row.key === company.stage);

            return (
              <article className="panel session-row" key={company.startup_id}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '0.98rem' }}>{company.name_ar}</h3>
                  {company.one_liner_ar && (
                    <p className="muted" style={{ fontSize: '0.82rem', marginTop: 3 }}>{company.one_liner_ar}</p>
                  )}
                  <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    {stage ? t(stage.label) : company.stage}
                    {' · '}
                    {t('منذ ', 'since ')}{formatDate(locale, company.granted_at)}
                    {company.expires_on && ` · ${t('حتى ', 'until ')}${formatDate(locale, company.expires_on)}`}
                  </p>
                </div>

                <div className="session-row-actions">
                  <span className="badge-pill eng">{company.canvases}</span>
                  <Link className="btn btn-ghost btn-sm" href={`/startups/${company.startup_id}/canvases`}>
                    {t('اللوحات المفتوحة لك', 'What they opened')}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
