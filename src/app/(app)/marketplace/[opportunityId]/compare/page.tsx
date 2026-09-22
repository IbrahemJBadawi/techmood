import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { Stars } from '@/components/Stars';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';

export const metadata = { title: 'Compare — TechMood' };

/**
 * Candidates, side by side.
 *
 * Deliberately not a ranking. There is no score column, no "best match" badge
 * and no default sort by anything but the order people applied — because the
 * platform does not know what this client is optimising for, and a number
 * pretending otherwise would be the most confident lie on the page.
 *
 * Every column is evidence that already exists elsewhere: the stars come from
 * work mentors approved, the projects from work that was finished, the skills
 * from `opportunity_match()` — the same function that tells each applicant how
 * they line up before they apply.
 */
export default async function ComparePage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, title_ar, posted_by, required_skills, amount_min, amount_max')
    .eq('id', opportunityId)
    .maybeSingle();

  if (!opportunity) notFound();

  const { data: rows, error } = await supabase.rpc('compare_candidates', {
    p_opportunity: opportunityId,
  });

  if (error) {
    return (
      <>
        <Link className="btn btn-ghost btn-sm" href={`/marketplace/${opportunityId}`}>
          {t('→ رجوع للفرصة', '← Back to the brief')}
        </Link>
        <p className="notice" style={{ marginTop: 16 }}>
          {t('المقارنة لصاحب الفرصة وحده.', 'Comparing candidates is for whoever wrote the brief.')}
        </p>
      </>
    );
  }

  const candidates = rows ?? [];

  return (
    <>
      <AiSurface surface="opportunity" entityType="opportunity" entityId={opportunityId}
                 label={opportunity.title_ar} />

      <Link className="btn btn-ghost btn-sm" href={`/marketplace/${opportunityId}`}>
        {t('→ رجوع للفرصة', '← Back to the brief')}
      </Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>{t('قارن المتقدّمين', 'Compare candidates')}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '64ch' }}>
              {t('بيانات للمقارنة، لا ترتيب. كل عمود هنا سجلّ حقيقي: نجوم من أعمال قيّمها منتور، مشاريع اكتملت، ومهارات مطابقة لوصفك — والقرار لك وحدك.',
                 'Data to compare, not a ranking. Every column is a real record: stars from work a mentor evaluated, projects that finished, skills matched against your brief — and the decision is yours alone.')}
            </p>
          </div>
          <AskAI prompt="قارن لي بين المتقدّمين على هذه الفرصة: من يناسب وصفي ولماذا، وما الذي أسأل عنه كلًّا منهم قبل أن أقرّر؟" />
        </div>
      </section>

      {candidates.length === 0 ? (
        <p className="notice">{t('لا عروض بعد على هذه الفرصة.', 'No proposals on this brief yet.')}</p>
      ) : (
        <div className="compare-scroll">
          <table className="table compare-table">
            <thead>
              <tr>
                <th>{t('المتقدّم', 'Candidate')}</th>
                <th>{t('التقييم', 'Rating')}</th>
                <th>{t('مشاريع مكتملة', 'Projects done')}</th>
                <th>{t('أعمال معتمدة', 'Approved work')}</th>
                <th>XP</th>
                <th>{t('السعر', 'Price')}</th>
                <th>{t('المدّة', 'Delivery')}</th>
                <th>{t('المهارات المطلوبة', 'Required skills')}</th>
                <th>{t('الحالة', 'Stage')}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((row) => (
                <tr key={row.application_id}>
                  <td>
                    <Link href={`/u/${row.techmood_id}`}>{row.full_name}</Link>
                    {row.team_title && (
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {t('عن فريق ', 'for ')}{row.team_title}
                      </div>
                    )}
                  </td>
                  <td>
                    {row.stars
                      ? <><Stars value={Number(row.stars)} /> <span className="eng muted">({row.rated_count})</span></>
                      : <span className="muted">{t('لا تقييم بعد', 'Not rated yet')}</span>}
                  </td>
                  <td className="eng">{row.projects_done}</td>
                  <td className="eng">{row.work_approved}</td>
                  <td className="eng">{row.xp}</td>
                  <td className="eng">
                    {row.proposed_amount ? money(Number(row.proposed_amount)) : '—'}
                  </td>
                  <td className="eng">{row.proposed_days ? `${row.proposed_days}d` : '—'}</td>
                  <td>
                    <div className="tags-row">
                      {row.matched_skills.map((skill) => (
                        <span className="tag tag-ok" key={skill}>{skill}</span>
                      ))}
                      {row.missing_skills.map((skill) => (
                        <span className="tag tag-gap" key={skill}>{skill}</span>
                      ))}
                    </div>
                  </td>
                  <td>{row.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
