'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { APPLICATION_STAGE } from '@/lib/marketplace';
import type { ApplicationStage } from '@/lib/database.types';

import { decideApplication } from '../actions';

type Evidence = {
  full_name: string;
  techmood_id: string;
  headline: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  total_xp: number;
  stars_avg: number;
  certificates: number;
  published_work: number;
  approved_submissions: number;
};

/**
 * The applicant's record, fetched on demand. It comes from applicant_evidence(),
 * which checks that this application was actually made to the caller — the
 * poster never gets a window onto anyone else's XP or certificates.
 */
export function ApplicantRow({
  applicationId,
  opportunityId,
  stage,
  coverNote,
  isTeamSeat,
}: {
  applicationId: string;
  opportunityId: string;
  stage: ApplicationStage;
  coverNote: string | null;
  isTeamSeat: boolean;
}) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadEvidence() {
    setLoading(true);
    setFailed(false);

    const supabase = createClient();
    const { data, error } = await supabase.rpc('applicant_evidence', { p_application: applicationId });

    setLoading(false);
    const row = (data as Evidence[] | null)?.[0];
    if (error || !row) setFailed(true);
    else setEvidence(row);
  }

  const info = APPLICATION_STAGE[stage];
  const decided = stage !== 'submitted' && stage !== 'shortlisted';

  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--line)' }}>
      <div className="row-between">
        <strong style={{ fontSize: '0.9rem' }}>{evidence?.full_name ?? 'متقدّم'}</strong>
        <span className={`status-pill ${info.className}`}>{info.text}</span>
      </div>

      {coverNote && <p style={{ fontSize: '0.86rem', marginTop: 8 }}>{coverNote}</p>}

      {!evidence ? (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={loadEvidence} disabled={loading}>
          {loading ? 'جارٍ التحميل…' : 'اعرض سجله المهني'}
        </button>
      ) : (
        <>
          <div className="tags-row" style={{ marginTop: 10, alignItems: 'center' }}>
            <span className="id-chip">{evidence.techmood_id}</span>
            <span className="xp-badge eng">{evidence.total_xp} XP</span>
            <span className="badge-pill eng">⭐ {evidence.stars_avg}</span>
            <span className="badge-pill eng">{evidence.certificates} شهادة</span>
            <span className="badge-pill eng">{evidence.published_work} عمل منشور</span>
            <span className="badge-pill eng">{evidence.approved_submissions} تسليم معتمد</span>
          </div>

          {evidence.headline && (
            <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8 }}>{evidence.headline}</p>
          )}

          {(evidence.github_url || evidence.linkedin_url) && (
            <div className="tags-row" style={{ marginTop: 8 }}>
              {evidence.github_url && (
                <a className="badge-pill eng" href={evidence.github_url} target="_blank" rel="noreferrer noopener">
                  GitHub ↗
                </a>
              )}
              {evidence.linkedin_url && (
                <a className="badge-pill eng" href={evidence.linkedin_url} target="_blank" rel="noreferrer noopener">
                  LinkedIn ↗
                </a>
              )}
            </div>
          )}
        </>
      )}

      {failed && <p className="notice notice-danger" style={{ marginTop: 8 }}>تعذّر عرض السجل.</p>}

      {!decided && !isTeamSeat && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {(['shortlisted', 'accepted'] as ApplicationStage[])
            .filter((value) => value !== stage)
            .map((value) => (
              <form action={decideApplication} key={value}>
                <input type="hidden" name="application_id" value={applicationId} />
                <input type="hidden" name="opportunity_id" value={opportunityId} />
                <input type="hidden" name="stage" value={value} />
                <button className="btn btn-primary btn-sm" style={{ padding: '5px 12px', fontSize: '0.76rem' }}>
                  {APPLICATION_STAGE[value].text}
                </button>
              </form>
            ))}

          <form action={decideApplication} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
            <input type="hidden" name="application_id" value={applicationId} />
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <input type="hidden" name="stage" value="declined" />
            <input name="note" placeholder="سبب الاعتذار (اختياري)" style={{ flex: 1, minWidth: 0, fontSize: '0.78rem' }} />
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.76rem' }}>اعتذار</button>
          </form>
        </div>
      )}
    </div>
  );
}
