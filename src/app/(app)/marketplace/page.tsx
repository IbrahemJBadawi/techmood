import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { OPPORTUNITY_KIND } from '@/lib/marketplace';
import type { OpportunityKind } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { JobList } from './JobList';
import { ListingList } from './ListingList';
import { MoneyTab } from './Money';
import { MyWork } from './MyWork';
import { TalentList } from './TalentList';
import { TeamList } from './TeamList';

export const metadata = { title: 'Market — TechMood' };

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
  searchParams: Promise<{ tab?: string; kind?: string; q?: string; remote?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
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
            <ListingList />
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
            {t('عمل مكتمل، مرّ بتقييم منتور وظهر في المعرض، ثم عُرض للبيع. الشراء يفتح حجزاً مالياً — والبيع ينقل العمل لا نسبته: يبقى في سجلّ من بناه.',
               'Finished work, judged by a mentor and shown in the exhibition, then put up for sale. Buying opens a hold — and a sale moves the work, never the authorship: it stays on the record of whoever built it.')}
          </p>
          <ListingList search={search} />
        </section>
      )}

      {tab === 'money' && (
        <section className="section-block">
          <MoneyTab />
        </section>
      )}

      {tab === 'work' && <MyWork />}
      {tab === 'saved' && <MyWork only="saved" />}
    </>
  );
}
