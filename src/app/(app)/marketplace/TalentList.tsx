import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { SaveButton } from './SaveButton';

/**
 * Who is available, with the record they earned.
 *
 * Every number on a card came from somewhere else in the platform — stars from
 * real evaluations, projects from the exhibition, certificates from completed
 * paths. The market shows them; it does not mint them. And the card is a
 * preview: the profile itself is the person's one professional identity, not a
 * second one kept for this page.
 */
export async function TalentList({
  search,
  saved,
}: {
  search?: string;
  saved: Set<string>;
}) {
  const t = await getT();
  const supabase = await createClient();

  const { data: talent } = await supabase.rpc('market_talent', {
    p_search: search ?? null,
    p_skill: null,
    p_limit: 24,
  });

  if ((talent ?? []).length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا أحد مدرج بعد', 'Nobody listed yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('يظهر هنا من أعلن استعداده للعمل — ومعه سجلّه لا سيرته الذاتية.',
             'People who said they are available appear here, with their record rather than a CV.')}
        </p>
        <Link className="btn btn-ghost btn-sm" href="/settings/freelancer">
          {t('أدرج نفسك', 'List yourself')}
        </Link>
      </div>
    );
  }

  return (
    <div className="market-grid">
      {(talent ?? []).map((person) => (
        <article className="panel talent-card" key={person.profile_id}>
          <div className="row-between">
            <div>
              <h3 style={{ fontSize: '0.98rem' }}>{person.full_name}</h3>
              <p className="muted" style={{ fontSize: '0.82rem', marginTop: 3 }}>
                {person.headline ?? t('عضو في TechMood', 'A TechMood member')}
              </p>
            </div>
            <SaveButton kind="talent" target={person.profile_id} saved={saved.has(person.profile_id)} />
          </div>

          <div className="talent-meta">
            <span><Stars value={person.stars_avg} /></span>
            <span className="muted eng">{person.projects} {t('مشروع معروض', 'exhibited')}</span>
            <span className="muted eng">{person.certificates} {t('شهادة', 'certificates')}</span>
          </div>

          {person.skills.length > 0 && (
            <div className="tags-row" style={{ marginTop: 10 }}>
              {person.skills.slice(0, 5).map((skill) => (
                <span className="badge-pill" key={skill}>{skill}</span>
              ))}
              {person.skills.length > 5 && (
                <span className="badge-pill eng">+{person.skills.length - 5}</span>
              )}
            </div>
          )}

          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="eng" style={{ fontWeight: 600, color: 'var(--royal-dark)' }}>
              {person.rate_min_usd === null && person.rate_max_usd === null
                ? t('السعر بالاتفاق', 'Rate on request')
                : `$${person.rate_min_usd ?? person.rate_max_usd}${
                    person.rate_max_usd && person.rate_min_usd && person.rate_max_usd !== person.rate_min_usd
                      ? `–${person.rate_max_usd}` : ''
                  }${person.rate_kind === 'hourly' ? '/hr' : ''}`}
            </span>
            <Link className="btn btn-ghost btn-sm" href={`/u/${person.techmood_id}`}>
              {t('الملف المهني', 'View profile')}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
