import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';
import type { OpportunityKind } from '@/lib/database.types';

import { SaveButton } from './SaveButton';

/**
 * The openings themselves.
 *
 * A card says the four things somebody decides on — what the work is, where and
 * how it is done, what it pays, and what it asks for — and then gets out of the
 * way. The skills are named because they are also the way back into the
 * academy: an opening is a description of something learnable.
 */
export async function JobList({
  kind,
  search,
  remoteOnly,
  saved,
}: {
  kind?: OpportunityKind;
  search?: string;
  remoteOnly?: boolean;
  saved: Set<string>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (kind) query = query.eq('kind', kind);
  if (remoteOnly) query = query.eq('is_remote', true);
  if (search) query = query.ilike('title_ar', `%${search}%`);

  const [{ data: opportunities }, { data: mine }] = await Promise.all([
    query,
    supabase.from('opportunity_applications').select('opportunity_id, stage').eq('profile_id', user?.id ?? ''),
  ]);

  const applied = new Map((mine ?? []).map((row) => [row.opportunity_id, row.stage]));
  const rows = opportunities ?? [];

  const posterIds = [...new Set(rows.map((row) => row.posted_by))];
  const { data: posters } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', posterIds.length ? posterIds : ['00000000-0000-0000-0000-000000000000']);

  const posterById = new Map((posters ?? []).map((row) => [row.id, row.full_name]));

  const counts = await supabase
    .from('opportunity_applications')
    .select('opportunity_id')
    .in('opportunity_id', rows.length ? rows.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000']);

  const applicants = new Map<string, number>();
  for (const row of counts.data ?? []) {
    applicants.set(row.opportunity_id, (applicants.get(row.opportunity_id) ?? 0) + 1);
  }

  if (rows.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا فرص مطابقة', 'Nothing matching')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('جرّب بحثاً آخر، أو تصفّح كل الفرص.', 'Try another search, or browse everything.')}
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      {rows.map((opportunity) => (
        <article className="panel opp-row" key={opportunity.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tags-row">
              <span className="tag">{t(OPPORTUNITY_KIND[opportunity.kind].label)}</span>
              {opportunity.is_remote && <span className="badge-pill">{t('عن بُعد', 'Remote')}</span>}
              {applied.has(opportunity.id) && <span className="badge-pill">{t('قدّمت', 'Applied')}</span>}
              {opportunity.closes_on && (
                <span className="badge-pill">
                  {t('يغلق ', 'closes ')}{formatDate(locale, opportunity.closes_on)}
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '1rem', marginTop: 8 }}>{opportunity.title_ar}</h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {opportunity.organization_ar ?? posterById.get(opportunity.posted_by) ?? '—'}
              {opportunity.location_ar ? ` · ${opportunity.location_ar}` : ''}
              {' · '}
              <span className="eng">{applicants.get(opportunity.id) ?? 0}</span>
              {' '}{t('متقدّم', 'applicants')}
            </p>

            {opportunity.required_skills.length > 0 && (
              <div className="tags-row" style={{ marginTop: 8 }}>
                {opportunity.required_skills.map((skill) => (
                  <span className="badge-pill eng" key={skill}>{skill}</span>
                ))}
              </div>
            )}
          </div>

          <div className="opp-side">
            <SaveButton kind="opportunity" target={opportunity.id} saved={saved.has(opportunity.id)} />
            <div className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>
              {compensationLabel(locale, opportunity)}
            </div>
            {opportunity.seats > 1 && (
              <p className="muted eng" style={{ fontSize: '0.76rem' }}>
                {opportunity.filled_count}/{opportunity.seats} {t('مقاعد', 'seats')}
              </p>
            )}
            <Link className="btn btn-primary btn-sm" href={`/marketplace/${opportunity.id}`}>
              {t('التفاصيل', 'Details')}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
