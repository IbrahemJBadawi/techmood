import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { APPLICATION_STAGE, OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';
import type { Opportunity } from '@/lib/database.types';

import { ApplyForm } from './ApplyForm';
import { ApplicantRow } from './ApplicantRow';
import { closeOpportunity } from '../actions';

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: raw } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .maybeSingle();

  if (!raw) notFound();
  const opportunity = raw as Opportunity;

  const isPoster = opportunity.posted_by === user.id;

  const [{ data: poster }, { data: match }, { data: myApplication }, { data: path }] = await Promise.all([
    supabase.from('profiles').select('full_name, techmood_id').eq('id', opportunity.posted_by).single(),
    supabase.rpc('opportunity_match', { p_opportunity: opportunityId, p_profile: user.id }),
    supabase
      .from('opportunity_applications')
      .select('id, stage, cover_note_ar, decision_note_ar')
      .eq('opportunity_id', opportunityId)
      .eq('profile_id', user.id)
      .maybeSingle(),
    opportunity.required_path_id
      ? supabase.from('learning_paths').select('title_ar').eq('id', opportunity.required_path_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Only the poster sees who applied.
  const { data: applications } = isPoster
    ? await supabase
        .from('opportunity_applications')
        .select('id, profile_id, cover_note_ar, stage, decision_note_ar, created_at')
        .eq('opportunity_id', opportunityId)
        .order('created_at')
    : { data: null };

  const matchInfo = (match as { meets_stars: boolean; meets_path: boolean; matched_skills: string[]; missing_skills: string[] }[] | null)?.[0];
  const isOpen =
    opportunity.status === 'published' &&
    opportunity.filled_count < opportunity.seats &&
    (!opportunity.closes_on || opportunity.closes_on >= new Date().toISOString().slice(0, 10));

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/marketplace">→ رجوع للسوق</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="tags-row">
              <span className="tag">{OPPORTUNITY_KIND[opportunity.kind].label}</span>
              {opportunity.is_remote && <span className="badge-pill">عن بُعد</span>}
              {!isOpen && <span className="status-pill status-muted">مغلقة</span>}
            </div>
            <h2 style={{ fontSize: '1.25rem', marginTop: 10 }}>{opportunity.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
              {opportunity.organization_ar ?? poster?.full_name}
              {opportunity.location_ar ? ` · ${opportunity.location_ar}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'start' }}>
            <div className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', fontSize: '1.05rem' }}>
              {compensationLabel(opportunity)}
            </div>
            {opportunity.closes_on && (
              <p className="muted eng" style={{ fontSize: '0.76rem', marginTop: 6 }}>
                يغلق {opportunity.closes_on}
              </p>
            )}
          </div>
        </div>

        {opportunity.description_ar && (
          <p style={{ fontSize: '0.9rem', marginTop: 16, whiteSpace: 'pre-wrap' }}>{opportunity.description_ar}</p>
        )}

        <div className="tags-row" style={{ marginTop: 14 }}>
          {opportunity.required_skills.map((skill) => <span className="badge-pill eng" key={skill}>{skill}</span>)}
          {opportunity.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          {opportunity.seats > 1 && (
            <span className="badge-pill eng">{opportunity.filled_count}/{opportunity.seats} مقاعد</span>
          )}
        </div>

        {isPoster && opportunity.status === 'published' && (
          <form action={closeOpportunity} style={{ marginTop: 16 }}>
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <button className="btn btn-ghost btn-sm">أغلق الفرصة</button>
          </form>
        )}
      </section>

      <div className="detail-grid">
        <section>
          {isPoster ? (
            <div className="panel">
              <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>
                المتقدّمون ({applications?.length ?? 0})
              </h3>

              {(applications?.length ?? 0) === 0 ? (
                <p className="muted" style={{ fontSize: '0.86rem' }}>لا طلبات بعد.</p>
              ) : (
                applications!.map((application) => (
                  <ApplicantRow
                    key={application.id}
                    applicationId={application.id}
                    opportunityId={opportunityId}
                    stage={application.stage}
                    coverNote={application.cover_note_ar}
                    isTeamSeat={opportunity.kind === 'team_seat'}
                  />
                ))
              )}

              {opportunity.kind === 'team_seat' && (
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
                  مقاعد الفرق تُقرَّر من صفحة الفريق، والقرار ينعكس هنا تلقائياً.
                </p>
              )}
            </div>
          ) : (
            <ApplyForm
              opportunityId={opportunityId}
              isOpen={isOpen}
              application={myApplication ?? null}
            />
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>مدى المطابقة</h3>
          <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
            إرشادية فقط — لا تمنعك من التقدّم. القرار للناشر.
          </p>

          {opportunity.min_stars !== null && (
            <div className={`match-row ${matchInfo?.meets_stars ? 'met' : 'unmet'}`}>
              <span className="mark">{matchInfo?.meets_stars ? '✓' : '○'}</span>
              <span>تقييم {opportunity.min_stars} نجوم فأعلى</span>
            </div>
          )}

          {opportunity.required_path_id && (
            <div className={`match-row ${matchInfo?.meets_path ? 'met' : 'unmet'}`}>
              <span className="mark">{matchInfo?.meets_path ? '✓' : '○'}</span>
              <span>شهادة {(path as { title_ar: string } | null)?.title_ar ?? 'مسار مطلوب'}</span>
            </div>
          )}

          {(matchInfo?.matched_skills ?? []).map((skill) => (
            <div className="match-row met" key={skill}>
              <span className="mark">✓</span>
              <span className="eng">{skill}</span>
            </div>
          ))}

          {(matchInfo?.missing_skills ?? []).map((skill) => (
            <div className="match-row unmet" key={skill}>
              <span className="mark">○</span>
              <span className="eng">{skill}</span>
            </div>
          ))}

          {opportunity.min_stars === null &&
            !opportunity.required_path_id &&
            opportunity.required_skills.length === 0 && (
              <p className="muted" style={{ fontSize: '0.84rem' }}>لم يحدد الناشر متطلبات.</p>
            )}

          {myApplication && (
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
              <div className="row-between">
                <span className="muted" style={{ fontSize: '0.82rem' }}>حالة طلبك</span>
                <span className={`status-pill ${APPLICATION_STAGE[myApplication.stage].className}`}>
                  {APPLICATION_STAGE[myApplication.stage].text}
                </span>
              </div>
              {myApplication.decision_note_ar && (
                <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8 }}>
                  {myApplication.decision_note_ar}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
