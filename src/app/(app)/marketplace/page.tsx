import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { OPPORTUNITY_KIND } from '@/lib/marketplace';
import type { OpportunityKind } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { JobList } from './JobList';
import { Purchases } from './Purchases';
import { Offers } from './Offers';
import { ShowcaseGrid } from '@/components/showcase/ShowcaseGrid';
import { MoneyTab } from './Money';
import { MyWork } from './MyWork';
import { TalentList } from './TalentList';
import { TeamList } from './TeamList';
import { AiSurface } from '@/components/AiSurface';
import { IS_MVP } from '@/lib/scope';

export const generateMetadata = localizedTitle('السوق — TechMood', 'Market — TechMood');

type Tab = 'all' | 'jobs' | 'talent' | 'teams' | 'listings' | 'work' | 'money' | 'saved';

const TAB_LABEL: Record<Tab, Text> = {
  all:    { ar: 'السوق',          en: 'All market' },
  jobs:   { ar: 'الفرص',          en: 'Jobs' },
  talent: { ar: 'المستقلون',      en: 'Freelancers' },
  teams:  { ar: 'الفرق',          en: 'Teams' },
  listings: { ar: 'مشاريع للبيع', en: 'For sale' },
  money:  { ar: 'المال',          en: 'Money' },
  work:   { ar: 'عملي',           en: 'My work' },
  saved:  { ar: 'المحفوظات',      en: 'Saved' },
};

/**
 * TechMood Market — where a record becomes work.
 *
 * This is not a job board bolted onto a learning platform. Everything a card
 * shows was earned elsewhere in TechMood: the skills from approved work, the
 * projects from the exhibition, the stars from real evaluations. That is why an
 * application here carries a person's identity rather than a CV, and why an
 * opening carries the way back into the academy for whoever is not ready yet.
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; kind?: string; q?: string; remote?: string; category?: string; type?: string; sort?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;

  // The MVP's market is the Student Market: finished student and team projects
  // for sale, and what you bought. Jobs and freelancing are outside its scope
  // (src/lib/scope.ts) and their tabs are not shown.
  if (IS_MVP) {
    const mvpTab = (['projects', 'services', 'jobs', 'offers', 'money'] as const)
      .find((key) => key === params.tab) ?? (params.tab === 'buying' ? 'money' : 'projects');
    const filters = { q: params.q, category: params.category,
                      type: params.type, sort: params.sort };
    const tabs: { key: typeof mvpTab; label: string; soon?: boolean }[] = [
      { key: 'projects', label: t('🧩 المشاريع', '🧩 Projects') },
      { key: 'services', label: t('🛠️ الخدمات', '🛠️ Services') },
      { key: 'jobs', label: t('💼 الوظائف والطلبات', '💼 Jobs & requests'), soon: true },
      { key: 'offers', label: t('💬 عروض الأسعار', '💬 Offers') },
      { key: 'money', label: t('مشترياتي ومبيعاتي', 'My purchases & sales') },
    ];
    return (
      <>
        <section className="market-hero section-block">
          <h2>{t('سوق TechMood', 'TechMood market')}</h2>
          <p className="muted">
            {t('مشاريع جاهزة وخدمات رقمية من أعضاء TechMood وفرقهم، تتحقق منها TechMood قبل عرضها. يُحتجز المبلغ لدى TechMood، ورابط التسليم يصلك بعد تأكيد الدفع.',
               'Ready-made projects and digital services by TechMood members and teams, checked by TechMood before they are listed. TechMood holds the money, and the delivery reaches you once the payment is confirmed.')}
          </p>
          <div className="tags-row" style={{ margin: '10px 0' }}>
            <Link className="btn btn-primary btn-sm" href="/projects/new?intent=market">{t('+ اعرض مشروعاً للبيع', '+ Sell a project')}</Link>
            <Link className="btn btn-sky btn-sm" href="/projects/new?intent=market&type=digital_service">{t('+ اعرض خدمة', '+ Offer a service')}</Link>
            <Link className="btn btn-ghost btn-sm" href="/projects">{t('مشاريعي', 'My projects')}</Link>
            <Link className="btn btn-ghost btn-sm" href="/policies#market">{t('الشروط', 'Terms')}</Link>
          </div>
        </section>
        <nav className="tabs" aria-label={t('أقسام السوق', 'Market sections')}>
          {tabs.map((tab) => (
            <Link key={tab.key} className={`tab${mvpTab === tab.key ? ' is-active' : ''}`} href={`/marketplace?tab=${tab.key}`}>
              {tab.label}{tab.soon && <span className="soon-chip">{t('قريباً', 'Soon')}</span>}
            </Link>
          ))}
        </nav>
        <section className="section-block">
          {(mvpTab === 'projects' || mvpTab === 'services') && (
            <ShowcaseGrid mode="market" group={mvpTab} filters={filters} inApp action="/marketplace" hidden={{ tab: mvpTab }}
                          emptyCta={<Link className="btn btn-primary btn-sm" href={`/projects/new?intent=market${mvpTab === 'services' ? '&type=digital_service' : ''}`}>
                            {mvpTab === 'services' ? t('اعرض أول خدمة', 'Offer the first service') : t('اعرض أول مشروع', 'List the first project')}</Link>} />
          )}
          {mvpTab === 'jobs' && (
            <div className="panel empty-state">
              <h3 style={{ fontSize: '1rem' }}>💼 {t('الوظائف والطلبات — قريباً', 'Jobs & requests — coming soon')}</h3>
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                {t('قريباً تنشر الشركات والأعضاء طلبات عمل ووظائف، ويتقدّم لها أعضاء TechMood بسجلّهم الموثّق.',
                   'Soon companies and members will post jobs and work requests, and TechMood members apply with their verified record.')}
              </p>
            </div>
          )}
          {mvpTab === 'offers' && <Offers />}
          {mvpTab === 'money' && (<><Purchases /><MoneyTab /></>)}
        </section>
      </>
    );
  }

  const tab = (['all', 'jobs', 'talent', 'teams', 'listings', 'work', 'money', 'saved'] as Tab[])
    .find((key) => key === params.tab) ?? 'all';
  const kind = Object.keys(OPPORTUNITY_KIND).includes(params.kind ?? '')
    ? (params.kind as OpportunityKind)
    : undefined;
  const search = (params.q ?? '').trim() || undefined;
  const remoteOnly = params.remote === '1';

  const [{ data: overview }, { data: canPost }, { data: saves }] = await Promise.all([
    supabase.rpc('market_overview'),
    supabase.rpc('can_post_opportunity', { p_kind: 'freelance', p_team: null }),
    supabase.from('market_saves').select('target_kind, target_id').eq('profile_id', user.id),
  ]);

  const counts = overview?.[0];
  const savedOf = (target: 'opportunity' | 'talent' | 'team') =>
    new Set((saves ?? []).filter((row) => row.target_kind === target).map((row) => row.target_id));

  const href = (next: Partial<{ tab: Tab; kind: string; q: string; remote: string }>) => {
    const query = new URLSearchParams();
    const merged = { tab, kind, q: search, remote: remoteOnly ? '1' : undefined, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, String(value));
    return `/marketplace?${query.toString()}`;
  };

  return (
    <>
      <AiSurface surface="market" />

      <section className="market-hero section-block">
        <h2>{t('ابنِ. اعمل. انمُ.', 'Build. Work. Grow.')}</h2>
        <p className="muted">
          {t('فرص حقيقية، ومهارات موثّقة بعمل تم تقييمه. هنا يتحوّل سجلّك في TechMood إلى عمل — لا سيرة ذاتية تُرسل وتُنسى.',
             'Real openings, and skills proven by work somebody evaluated. This is where your TechMood record becomes work — not a CV sent into a void.')}
        </p>

        <form className="market-search" action="/marketplace">
          <input type="hidden" name="tab" value={tab === 'all' ? 'jobs' : tab} />
          <input
            type="search"
            name="q"
            defaultValue={search ?? ''}
            placeholder={t('فرصة، مهارة، أو شخص…', 'An opening, a skill, or a person…')}
            aria-label={t('ابحث في السوق', 'Search the market')}
          />
          <button className="btn btn-primary btn-sm">{t('ابحث', 'Search')}</button>
        </form>

        <div className="row-actions">
          <Link className="btn btn-ghost btn-sm" href={href({ tab: 'jobs' })}>{t('ابحث عن فرصة', 'Find jobs')}</Link>
          <Link className="btn btn-ghost btn-sm" href={href({ tab: 'talent' })}>{t('ابحث عن شخص', 'Find talent')}</Link>
          {canPost === true && (
            <Link className="btn btn-primary btn-sm" href="/marketplace/new">{t('انشر فرصة', 'Post an opening')}</Link>
          )}
        </div>
      </section>

      {counts && (
        <section className="stat-strip">
          <Link className="stat-card" href={href({ tab: 'jobs' })}>
            <span className="stat-value eng">{counts.jobs}</span>
            <span className="stat-label">{t('فرص مفتوحة', 'Open jobs')}</span>
          </Link>
          <Link className="stat-card" href={href({ tab: 'talent' })}>
            <span className="stat-value eng">{counts.freelancers}</span>
            <span className="stat-label">{t('مستقلون متاحون', 'Freelancers')}</span>
          </Link>
          <Link className="stat-card" href={href({ tab: 'teams' })}>
            <span className="stat-value eng">{counts.teams}</span>
            <span className="stat-label">{t('فرق تستقبل عملاً', 'Teams for hire')}</span>
          </Link>
          <span className="stat-card">
            <span className="stat-value eng">{counts.companies}</span>
            <span className="stat-label">{t('جهات ناشرة', 'Organisations')}</span>
          </span>
        </section>
      )}

      <nav className="tabs" aria-label={t('أقسام السوق', 'Market sections')}>
        {(['all', 'jobs', 'talent', 'teams', 'listings', 'work', 'money', 'saved'] as Tab[]).map((key) => (
          <Link className={`tab${key === tab ? ' is-active' : ''}`} href={href({ tab: key })} key={key}>
            {t(TAB_LABEL[key])}
          </Link>
        ))}
      </nav>

      {tab === 'all' && (
        <>
          <section className="section-block">
            <div className="row-between">
              <h3 className="academy-heading">{t('فرص مفتوحة', 'Open opportunities')}</h3>
              <Link className="btn btn-ghost btn-sm" href={href({ tab: 'jobs' })}>{t('الكل', 'See all')}</Link>
            </div>
            <JobList saved={savedOf('opportunity')} />
          </section>

          <section className="section-block">
            <div className="row-between">
              <h3 className="academy-heading">{t('مستقلون متاحون', 'Available freelancers')}</h3>
              <Link className="btn btn-ghost btn-sm" href={href({ tab: 'talent' })}>{t('الكل', 'See all')}</Link>
            </div>
            <TalentList saved={savedOf('talent')} />
          </section>

          <section className="section-block">
            <div className="row-between">
              <h3 className="academy-heading">{t('فرق تستقبل عملاً', 'Teams for hire')}</h3>
              <Link className="btn btn-ghost btn-sm" href={href({ tab: 'teams' })}>{t('الكل', 'See all')}</Link>
            </div>
            <TeamList saved={savedOf('team')} />
          </section>

          <section className="section-block">
            <div className="row-between">
              <h3 className="academy-heading">{t('مشاريع جاهزة للبيع', 'Finished work for sale')}</h3>
              <Link className="btn btn-ghost btn-sm" href={href({ tab: 'listings' })}>{t('الكل', 'See all')}</Link>
            </div>
            <ShowcaseGrid mode="market" filters={{}} inApp action="/marketplace" hidden={{ tab: 'listings' }} />
          </section>
        </>
      )}

      {tab === 'jobs' && (
        <section className="section-block">
          <div className="filter-row">
            <Link className={`chip${!kind ? ' is-active' : ''}`} href={href({ tab: 'jobs', kind: '' })}>
              {t('كل الأنواع', 'All kinds')}
            </Link>
            {Object.entries(OPPORTUNITY_KIND).map(([key, info]) => (
              <Link className={`chip${kind === key ? ' is-active' : ''}`} href={href({ tab: 'jobs', kind: key })} key={key}>
                {t(info.label)}
              </Link>
            ))}
            <Link
              className={`chip${remoteOnly ? ' is-active' : ''}`}
              href={href({ tab: 'jobs', remote: remoteOnly ? '' : '1' })}
            >
              {t('عن بُعد فقط', 'Remote only')}
            </Link>
          </div>

          <div style={{ marginTop: 16 }}>
            <JobList kind={kind} search={search} remoteOnly={remoteOnly} saved={savedOf('opportunity')} />
          </div>
        </section>
      )}

      {tab === 'talent' && (
        <section className="section-block">
          <TalentList search={search} saved={savedOf('talent')} />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 14 }}>
            {t('تريد أن تظهر هنا؟ ', 'Want to appear here? ')}
            <Link href="/settings/freelancer">{t('أدرج نفسك في السوق', 'List yourself in the market')}</Link>
          </p>
        </section>
      )}

      {tab === 'teams' && (
        <section className="section-block">
          <TeamList search={search} saved={savedOf('team')} />
        </section>
      )}

      {tab === 'listings' && (
        <section className="section-block">
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 14, maxWidth: '66ch' }}>
            {t('عمل مكتمل تحقّقت منه TechMood قبل عرضه. الشراء يفتح حجزاً مالياً، ورابط التسليم يصلك بعد تأكيد الدفع — والبيع ينقل العمل لا نسبته: يبقى في سجلّ من بناه.',
               'Finished work TechMood checked before listing it. Buying opens a hold, and the delivery link reaches you once the payment is confirmed — and a sale moves the work, never the authorship: it stays on the record of whoever built it.')}
          </p>
          <ShowcaseGrid mode="market" filters={{ q: search, category: params.category, type: params.type, sort: params.sort }} inApp action="/marketplace" hidden={{ tab: 'listings' }} />
        </section>
      )}

      {tab === 'money' && (
        <section className="section-block">
          <Purchases />
          <MoneyTab />
        </section>
      )}

      {tab === 'work' && <MyWork />}
      {tab === 'saved' && <MyWork only="saved" />}
    </>
  );
}
