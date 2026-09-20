import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';
import type { Opportunity, OpportunityKind } from '@/lib/database.types';

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let query = supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (kind && kind in OPPORTUNITY_KIND) query = query.eq('kind', kind as OpportunityKind);

  const [{ data: opportunities }, { data: canPost }, { data: myApplications }] = await Promise.all([
    query,
    supabase.rpc('can_post_opportunity', { p_kind: 'freelance', p_team: null }),
    supabase.from('opportunity_applications').select('opportunity_id').eq('profile_id', user.id),
  ]);

  const applied = new Set((myApplications ?? []).map((row) => row.opportunity_id));
  const posterIds = [...new Set((opportunities ?? []).map((row) => row.posted_by))];

  const { data: posters } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', posterIds.length ? posterIds : ['00000000-0000-0000-0000-000000000000']);

  const posterById = new Map((posters ?? []).map((row) => [row.id, row.full_name]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>سوق العمل</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              فرص تصل لمن يملك سجلاً مهنياً موثّقاً. عندما تتقدّم، يرى الناشر نقاطك ونجومك
              وشهاداتك وأعمالك المنشورة — لا خطاب تعريف فقط.
            </p>
          </div>
          {canPost === true && (
            <Link className="btn btn-primary btn-sm" href="/marketplace/new">+ انشر فرصة</Link>
          )}
        </div>
      </section>

      <div className="date-tabs section-block">
        <Link
          href="/marketplace"
          className={`date-tab${!kind ? ' selected' : ''}`}
          style={{ textDecoration: 'none', minWidth: 0, padding: '8px 16px' }}
        >
          الكل
        </Link>
        {Object.entries(OPPORTUNITY_KIND).map(([key, info]) => (
          <Link
            key={key}
            href={`/marketplace?kind=${key}`}
            className={`date-tab${kind === key ? ' selected' : ''}`}
            style={{ textDecoration: 'none', minWidth: 0, padding: '8px 16px' }}
          >
            {info.label}
          </Link>
        ))}
      </div>

      {(opportunities?.length ?? 0) === 0 ? (
        <p className="notice">لا فرص مطابقة حالياً.</p>
      ) : (
        (opportunities as Opportunity[]).map((opportunity) => (
          <article className="opp-row panel section-block" key={opportunity.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tags-row">
                <span className="tag">{OPPORTUNITY_KIND[opportunity.kind].label}</span>
                {opportunity.is_remote && <span className="badge-pill">عن بُعد</span>}
                {applied.has(opportunity.id) && <span className="badge-pill">قدّمت</span>}
              </div>

              <h3 style={{ fontSize: '1rem', marginTop: 8 }}>{opportunity.title_ar}</h3>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                {opportunity.organization_ar ?? posterById.get(opportunity.posted_by) ?? '—'}
                {opportunity.location_ar ? ` · ${opportunity.location_ar}` : ''}
              </p>

              {(opportunity.required_skills.length > 0 || opportunity.tags.length > 0) && (
                <div className="tags-row" style={{ marginTop: 8 }}>
                  {opportunity.required_skills.map((skill) => (
                    <span className="badge-pill eng" key={skill}>{skill}</span>
                  ))}
                  {opportunity.tags.map((tag) => <span className="badge-pill" key={tag}>{tag}</span>)}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'start' }}>
              <div className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', marginBottom: 8 }}>
                {compensationLabel(opportunity)}
              </div>
              {opportunity.seats > 1 && (
                <p className="muted eng" style={{ fontSize: '0.76rem', marginBottom: 8 }}>
                  {opportunity.filled_count}/{opportunity.seats} مقاعد
                </p>
              )}
              <Link className="btn btn-primary btn-sm" href={`/marketplace/${opportunity.id}`}>
                التفاصيل
              </Link>
            </div>
          </article>
        ))
      )}
    </>
  );
}
