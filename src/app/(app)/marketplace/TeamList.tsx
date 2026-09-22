import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { SaveButton } from './SaveButton';

/**
 * Teams that take work. A team is the thing this platform is best at making,
 * so it can be hired as one — with the same record behind it that a person has.
 */
export async function TeamList({ search, saved }: { search?: string; saved: Set<string> }) {
  const t = await getT();
  const supabase = await createClient();

  const { data: teams } = await supabase.rpc('market_teams', { p_search: search ?? null, p_limit: 24 });

  if ((teams ?? []).length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا فرق تعرض خدماتها بعد', 'No teams offering work yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('يستطيع قائد الفريق إعلان أن فريقه يستقبل مشاريع من إعدادات الفريق.',
             'A team lead can say their team takes projects from the team settings.')}
        </p>
      </div>
    );
  }

  return (
    <div className="market-grid">
      {(teams ?? []).map((team) => (
        <article className="panel talent-card" key={team.team_id}>
          <div className="row-between">
            <h3 style={{ fontSize: '0.98rem' }}>{team.title_ar}</h3>
            <SaveButton kind="team" target={team.team_id} saved={saved.has(team.team_id)} />
          </div>

          {team.summary_ar && (
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>{team.summary_ar}</p>
          )}

          <div className="talent-meta">
            <span><Stars value={team.stars_avg} /></span>
            <span className="muted eng">{team.members} {t('أعضاء', 'members')}</span>
            <span className="muted eng">{team.projects} {t('مشاريع', 'projects')}</span>
          </div>

          {team.needs.length > 0 && (
            <div className="tags-row" style={{ marginTop: 10 }}>
              {team.needs.slice(0, 5).map((need) => <span className="badge-pill" key={need}>{need}</span>)}
            </div>
          )}

          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="eng" style={{ fontWeight: 600, color: 'var(--royal-dark)' }}>
              {team.rate_from_usd ? `${t('من', 'from')} $${team.rate_from_usd}` : t('السعر بالاتفاق', 'Rate on request')}
            </span>
            <Link className="btn btn-ghost btn-sm" href={`/teams/${team.team_id}`}>
              {t('صفحة الفريق', 'View team')}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
