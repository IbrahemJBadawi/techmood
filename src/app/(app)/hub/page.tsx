import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { NameBadges } from '@/components/VerifiedBadge';

import { JobList } from '../marketplace/JobList';
import { TalentList } from '../marketplace/TalentList';
import { TeamList } from '../marketplace/TeamList';

export const generateMetadata = localizedTitle('TechMood Business', 'TechMood Business');

const TABS = ['pages', 'services', 'projects', 'jobs', 'teams'] as const;
type Tab = (typeof TABS)[number];

/**
 * TechMood Business (design lab 5): one hub for services, projects, talent and
 * teams — for members only. Browsing and applying are open to everyone;
 * publishing and owning a business page are for Premium (0165).
 */
export default async function BusinessHubPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/hub');

  const params = await searchParams;
  const tab: Tab = TABS.find((key) => key === params.tab) ?? 'pages';
  const q = params.q?.trim() || undefined;

  const [{ data: accessRows }, { data: pages }] = await Promise.all([
    supabase.rpc('business_access'),
    tab === 'pages' ? supabase.rpc('business_directory', { p_search: q ?? null, p_limit: 40 }) : Promise.resolve({ data: [] }),
  ]);
  const access = accessRows?.[0];

  const labels: Record<Tab, string> = {
    pages: t('🏢 صفحات الأعمال', '🏢 Business pages'),
    services: t('🛠️ الخدمات والمواهب', '🛠️ Services & talent'),
    projects: t('🧑‍💻 مشاريع عمل حر', '🧑‍💻 Freelance projects'),
    jobs: t('💼 الوظائف', '💼 Jobs'),
    teams: t('👥 فرق تستقبل عملاً', '👥 Teams taking work'),
  };

  return (
    <>
      <section className="section-block biz-hero">
        <p className="kicker">TechMood Business</p>
        <h1>{t('الأعمال على TechMood', 'Business on TechMood')}</h1>
        <p className="muted">
          {t('خدمات وفرق ومستقلّون بسجلّ موثّق، ومشاريع ووظائف تبحث عن منفّذ — في مكان واحد. التصفّح والتقدّم مفتوحان لكل عضو؛ النشر وصفحة الأعمال لمشتركي Premium.',
             'Services, teams and freelancers with a verified record, and projects and jobs looking for people — in one place. Browsing and applying are open to every member; publishing and a business page are for Premium.')}
        </p>
        <div className="tags-row" style={{ marginTop: 10 }}>
          {access?.page_slug
            ? <Link className="btn btn-primary btn-sm" href={`/hub/${access.page_slug}`}>{t('صفحة أعمالي', 'My business page')}</Link>
            : <Link className="btn btn-primary btn-sm" href={access?.premium ? '/hub/edit' : '/premium'}>
                {access?.premium ? t('+ أنشئ صفحة أعمالك', '+ Create your business page') : t('✦ صفحة أعمال مع Premium', '✦ A business page with Premium')}
              </Link>}
          <Link className="btn btn-ghost btn-sm" href="/marketplace/new">{t('انشر وظيفة أو مشروعاً', 'Post a job or project')}</Link>
          <Link className="btn btn-ghost btn-sm" href="/startups">🚀 Startup Studio</Link>
          {!access?.freelancer && <Link className="btn btn-ghost btn-sm" href="/settings/roles">{t('فعّل دور الفريلانسر', 'Become a freelancer')}</Link>}
          {access?.freelancer && <Link className="btn btn-ghost btn-sm" href="/settings/freelancer">{t('ملف خدماتي', 'My services profile')}</Link>}
        </div>
      </section>

      <nav className="tabs" aria-label={t('أقسام الأعمال', 'Business sections')}>
        {TABS.map((key) => (
          <Link key={key} className={`tab${tab === key ? ' is-active' : ''}`} href={`/hub?tab=${key}`} aria-current={tab === key ? 'page' : undefined}>
            {labels[key]}
          </Link>
        ))}
      </nav>

      <section className="section-block">
        {tab === 'pages' && (
          <>
            <form className="search-row" action="/hub" style={{ marginBottom: 12 }}>
              <input type="hidden" name="tab" value="pages" />
              <input name="q" defaultValue={q ?? ''} placeholder={t('ابحث باسم أو مجال…', 'Search by name or field…')} aria-label={t('بحث', 'Search')} />
              <button className="btn btn-ghost btn-sm" type="submit">{t('بحث', 'Search')}</button>
            </form>
            {(pages ?? []).length === 0 ? (
              <div className="panel empty-state">
                <h3 style={{ fontSize: '0.98rem' }}>{t('لا صفحات أعمال بعد', 'No business pages yet')}</h3>
                <p className="muted" style={{ fontSize: '0.86rem' }}>{t('كن أول من يعرض خدماته وفريقه هنا.', 'Be the first to show your services and team here.')}</p>
              </div>
            ) : (
              <div className="biz-grid">
                {(pages ?? []).map((page) => (
                  <Link key={page.id} className="panel biz-card" href={`/hub/${page.slug}`}>
                    <span className="biz-card-mark" aria-hidden="true">{page.name.trim().charAt(0)}</span>
                    <div className="biz-card-body">
                      <strong>{page.name}<NameBadges verified={page.verified} /></strong>
                      {page.tagline && <span className="muted">{page.tagline}</span>}
                      <span className="biz-card-meta">
                        {page.team_id ? t('فريق', 'Team') : t('مستقل', 'Independent')}
                        {page.sector && <> · {page.sector}</>}{page.city && <> · {page.city}</>}
                      </span>
                      <span className="biz-card-counts muted">
                        {t(`${page.services} خدمة · ${page.projects} مشروع · ${page.openings} فرصة`, `${page.services} services · ${page.projects} projects · ${page.openings} openings`)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        {tab === 'services' && <TalentList search={q} saved={new Set()} />}
        {tab === 'projects' && <JobList kind="freelance" search={q} saved={new Set()} />}
        {tab === 'jobs' && <JobList kinds={['job', 'internship', 'remote']} search={q} saved={new Set()} />}
        {tab === 'teams' && <TeamList search={q} saved={new Set()} />}
      </section>
    </>
  );
}
