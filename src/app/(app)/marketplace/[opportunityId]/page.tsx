import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { APPLICATION_STAGE, OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';
import { Opportunity } from '@/lib/database.types';

import { ApplyForm } from './ApplyForm';
import { InviteRow } from './InviteRow';
import { Negotiation, type Round } from './Negotiation';
import { SaveButton } from '../SaveButton';
import { ApplicantRow } from './ApplicantRow';
import { closeOpportunity } from '../actions';

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const t = await getT();
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
      .select('id, stage, cover_note_ar, decision_note_ar, proposed_amount_usd, proposed_days')
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
        .select('id, profile_id, cover_note_ar, stage, decision_note_ar, created_at, proposed_amount_usd, proposed_days')
        .eq('opportunity_id', opportunityId)
        .order('created_at')
    : { data: null };

  // The loop the platform is built on: an opening names skills, and the academy
  // is shown as the way to them — to whoever does not have them yet.
  const { data: learning } = isPoster
    ? { data: null }
    : await supabase.rpc('opportunity_learning', { p_opportunity: opportunityId });

  // A poster who found nobody can ask somebody instead of waiting.
  const { data: talent } = isPoster
    ? await supabase.rpc('market_talent', { p_search: null, p_skill: null, p_limit: 6 })
    : { data: null };

  const { data: invited } = isPoster
    ? await supabase.from('opportunity_invites')
        .select('invited_profile, status').eq('opportunity_id', opportunityId)
    : { data: null };

  // The rounds two people have offered each other, for whichever side is here.
  const { data: myRounds } = myApplication
    ? await supabase.rpc('negotiation', { p_application: myApplication.id })
    : { data: null };

  const { data: saved } = await supabase
    .from('market_saves')
    .select('target_id')
    .eq('profile_id', user.id)
    .eq('target_kind', 'opportunity')
    .eq('target_id', opportunityId)
    .maybeSingle();

  const matchInfo = (match as { meets_stars: boolean; meets_path: boolean; matched_skills: string[]; missing_skills: string[] }[] | null)?.[0];
  const isOpen =
    opportunity.status === 'published' &&
    opportunity.filled_count < opportunity.seats &&
    (!opportunity.closes_on || opportunity.closes_on >= new Date().toISOString().slice(0, 10));

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/marketplace">{t('→ رجوع للسوق', '← Back to work')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="tags-row">
              <span className="tag">{t(OPPORTUNITY_KIND[opportunity.kind].label)}</span>
              {opportunity.is_remote && <span className="badge-pill">{t('عن بُعد', 'Remote')}</span>}
              {!isOpen && <span className="status-pill status-muted">{t('مغلقة', 'Closed')}</span>}
            </div>
            <h2 style={{ fontSize: '1.25rem', marginTop: 10 }}>{opportunity.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
              {opportunity.organization_ar ?? poster?.full_name}
              {opportunity.location_ar ? ` · ${opportunity.location_ar}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'start' }}>
            <div className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', fontSize: '1.05rem' }}>
              {compensationLabel(t.locale, opportunity)}
            </div>
            {opportunity.closes_on && (
              <p className="muted eng" style={{ fontSize: '0.76rem', marginTop: 6 }}>
                {t('يغلق ', 'Closes ')}{opportunity.closes_on}
              </p>
            )}
            <div style={{ marginTop: 10 }}>
              <SaveButton
                kind="opportunity"
                target={opportunityId}
                saved={Boolean(saved)}
                revalidate={`/marketplace/${opportunityId}`}
              />
            </div>
          </div>
        </div>

        {opportunity.description_ar && (
          <p style={{ fontSize: '0.9rem', marginTop: 16, whiteSpace: 'pre-wrap' }}>{opportunity.description_ar}</p>
        )}

        <div className="tags-row" style={{ marginTop: 14 }}>
          {opportunity.required_skills.map((skill) => <span className="badge-pill eng" key={skill}>{skill}</span>)}
          {opportunity.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          {opportunity.seats > 1 && (
            <span className="badge-pill eng">{opportunity.filled_count}/{opportunity.seats} {t('مقاعد', 'seats')}</span>
          )}
        </div>

        {isPoster && opportunity.status === 'published' && (
          <form action={closeOpportunity} style={{ marginTop: 16 }}>
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <button className="btn btn-ghost btn-sm">{t('أغلق الفرصة', 'Close the opening')}</button>
          </form>
        )}
      </section>

      <div className="detail-grid">
        <section>
          {isPoster ? (
            <div className="panel">
              <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>
                {t('المتقدّمون', 'Applicants')} ({applications?.length ?? 0})
              </h3>

              {(applications?.length ?? 0) === 0 ? (
                <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا طلبات بعد.', 'No applications yet.')}</p>
              ) : (
                await Promise.all(applications!.map(async (application) => {
                  const { data: rounds } = opportunity.kind === 'freelance'
                    ? await supabase.rpc('negotiation', { p_application: application.id })
                    : { data: null };

                  return (
                    <ApplicantRow
                      key={application.id}
                      applicationId={application.id}
                      opportunityId={opportunityId}
                      stage={application.stage}
                      coverNote={application.cover_note_ar}
                      isTeamSeat={opportunity.kind === 'team_seat'}
                      proposal={{ amount: application.proposed_amount_usd, days: application.proposed_days }}
                    >
                      {opportunity.kind === 'freelance'
                        && !['declined', 'withdrawn'].includes(application.stage) && (
                        <Negotiation
                          applicationId={application.id}
                          rounds={(rounds ?? []) as Round[]}
                          meId={user.id}
                        />
                      )}
                    </ApplicantRow>
                  );
                }))
              )}

              {(talent ?? []).length > 0 && opportunity.kind !== 'team_seat' && (
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
                  <h4 style={{ fontSize: '0.92rem' }}>{t('ادعُ شخصاً بالاسم', 'Invite somebody by name')}</h4>
                  <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    {t('من أعلنوا أنهم متاحون للعمل. الدعوة تدخل نفس الطابور — خطوة واحدة للأمام.',
                       'People who said they are available. An invitation enters the same queue, one step further along.')}
                  </p>
                  <div className="stack" style={{ marginTop: 10 }}>
                    {(talent ?? []).map((person) => (
                      <InviteRow
                        key={person.profile_id}
                        opportunityId={opportunityId}
                        profileId={person.profile_id}
                        name={person.full_name}
                        headline={person.headline}
                        alreadyInvited={(invited ?? []).some((row) => row.invited_profile === person.profile_id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {opportunity.kind === 'team_seat' && (
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
                  {t('مقاعد الفرق تُقرَّر من صفحة الفريق، والقرار ينعكس هنا تلقائياً.', 'Team seats are decided from the team page, and the decision shows up here automatically.')}
                </p>
              )}
            </div>
          ) : (
            <>
              <ApplyForm
                opportunityId={opportunityId}
                isOpen={isOpen}
                needsProposal={opportunity.kind === 'freelance'}
                application={myApplication ?? null}
              />

              {myApplication && opportunity.kind === 'freelance'
                && !['declined', 'withdrawn'].includes(myApplication.stage) && (
                <Negotiation
                  applicationId={myApplication.id}
                  rounds={(myRounds ?? []) as Round[]}
                  meId={user.id}
                />
              )}

              {(learning ?? []).length > 0 && (
                <div className="panel section-block" style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: '0.98rem' }}>{t('الطريق إلى ما تطلبه هذه الفرصة', 'The way to what this asks for')}</h3>
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                    {t('مسارات في الأكاديمية تُدرّس المهارات التي لم تُوثَّق في ملفك بعد. لا أحد يمنعك من التقدّم الآن.',
                       'Academy paths that teach the skills your record does not carry yet. Nothing stops you applying today.')}
                  </p>
                  <ul className="plain-list" style={{ marginTop: 12 }}>
                    {(learning ?? []).map((row) => (
                      <li className="row-between" key={row.path_id} style={{ fontSize: '0.88rem' }}>
                        <span>
                          {row.title_ar}
                          <span className="muted"> · {row.teaches.slice(0, 3).join('، ')}</span>
                        </span>
                        <Link className="btn btn-ghost btn-sm" href={`/academy/${row.slug}`}>
                          {t('ابدأ', 'Start')}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{t('مدى المطابقة', 'How well you match')}</h3>
          <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
            {t('إرشادية فقط — لا تمنعك من التقدّم. القرار للناشر.', 'Advisory only — nothing here stops you applying. The poster decides.')}
          </p>

          {opportunity.min_stars !== null && (
            <div className={`match-row ${matchInfo?.meets_stars ? 'met' : 'unmet'}`}>
              <span className="mark">{matchInfo?.meets_stars ? '✓' : '○'}</span>
              <span>{t(`تقييم ${opportunity.min_stars} نجوم فأعلى`, `${opportunity.min_stars} stars or above`)}</span>
            </div>
          )}

          {opportunity.required_path_id && (
            <div className={`match-row ${matchInfo?.meets_path ? 'met' : 'unmet'}`}>
              <span className="mark">{matchInfo?.meets_path ? '✓' : '○'}</span>
              <span>{t('شهادة ', 'Certificate: ')}{(path as { title_ar: string } | null)?.title_ar ?? t('مسار مطلوب', 'a required path')}</span>
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
              <p className="muted" style={{ fontSize: '0.84rem' }}>{t('لم يحدد الناشر متطلبات.', 'The poster set no requirements.')}</p>
            )}

          {myApplication && (
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
              <div className="row-between">
                <span className="muted" style={{ fontSize: '0.82rem' }}>{t('حالة طلبك', 'Your application')}</span>
                <span className={`status-pill ${APPLICATION_STAGE[myApplication.stage].className}`}>
                  {t(APPLICATION_STAGE[myApplication.stage].text)}
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
