import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { KIND_LABEL } from '../../../../exhibition/types';
import { RubricForm } from '../RubricForm';

/**
 * One project, as a mentor reads it before judging.
 *
 * Everything shown here is the live entry, not a snapshot: the snapshot does
 * not exist yet — approving is what writes it. The contributions are the ones
 * the board recorded, so the mentor sees who actually did the work before
 * deciding what it is worth.
 */
export default async function ExhibitionReviewPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: isMentor }, { data: isAdmin }] = await Promise.all([
    supabase.rpc('is_mentor'),
    supabase.rpc('is_admin'),
  ]);
  if (isMentor !== true && isAdmin !== true) redirect('/home');

  const { data: entry } = await supabase
    .from('exhibition_entries')
    .select('id, entry_code, project_id, team_id, status, version, summary_ar, technologies, demo_url, documentation_ar, problem_ar, solution_ar, outcomes_ar, cover_url, created_at')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry) notFound();

  const [{ data: project }, { data: contributions }, { data: history }, { data: evidence }] = await Promise.all([
    supabase.from('projects').select('id, code, title_ar, description_ar, kind, completed_at').eq('id', entry.project_id).maybeSingle(),
    supabase.rpc('project_contributions', { p_project: entry.project_id }),
    supabase.rpc('exhibition_entry_reviews', { p_entry: entry.id }),
    supabase.from('project_evidence').select('id, kind, url, label').eq('project_id', entry.project_id),
  ]);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/review/exhibition">{t('→ قائمة المشاريع', '← The queue')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>{project?.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
              <span className="id-chip">{project?.code}</span>
              {' · '}{project ? (KIND_LABEL[project.kind]?.[locale] ?? project.kind) : null}
              {' · '}<span className="eng">v{entry.version}</span>
            </p>
          </div>
          {project?.completed_at && (
            <span className="muted eng" style={{ fontSize: '0.78rem' }}>{formatDate(locale, project.completed_at)}</span>
          )}
        </div>

        <p style={{ fontSize: '0.92rem', marginTop: 12 }}>{entry.summary_ar}</p>

        <div className="tags-row" style={{ marginTop: 12 }}>
          {(entry.technologies ?? []).map((tech) => <span className="tag eng" key={tech}>{tech}</span>)}
        </div>

        {entry.demo_url && (
          <p style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href={entry.demo_url} target="_blank" rel="noreferrer">
              {t('افتح العرض الحي ↗', 'Open the live demo ↗')}
            </a>
          </p>
        )}
      </section>

      <div className="detail-grid">
        <section>
          {(entry.problem_ar || entry.solution_ar) && (
            <section className="panel section-block">
              {entry.problem_ar && (
                <div className="exhibit-block">
                  <h3>{t('المشكلة', 'The problem')}</h3>
                  <p>{entry.problem_ar}</p>
                </div>
              )}
              {entry.solution_ar && (
                <div className="exhibit-block">
                  <h3>{t('الحل', 'The solution')}</h3>
                  <p>{entry.solution_ar}</p>
                </div>
              )}
            </section>
          )}

          {(entry.outcomes_ar ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('ما يقولون إنهم بنوه', 'What they say they built')}</h3>
              <ul className="lesson-outcomes">
                {entry.outcomes_ar.map((outcome) => <li key={outcome}>{outcome}</li>)}
              </ul>
            </section>
          )}

          {(evidence ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('الأدلة', 'Evidence')}</h3>
              <ul className="lesson-links">
                {(evidence ?? []).map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer">{item.label ?? item.kind}</a>
                    <span className="muted eng"> · {item.kind}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry.documentation_ar && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('التوثيق', 'Documentation')}</h3>
              <p style={{ fontSize: '0.9rem', marginTop: 8, whiteSpace: 'pre-wrap' }}>{entry.documentation_ar}</p>
            </section>
          )}

          <RubricForm entryId={entry.id} />
        </section>

        <aside>
          <section className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('من بناه فعلاً', 'Who actually built it')}</h3>
            {(contributions ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.84rem', marginTop: 8 }}>
                {t('لا مهام على لوحة فريق — مشروع فردي.', 'No team board behind it — a solo project.')}
              </p>
            ) : (
              <ul className="admin-mini-list" style={{ marginTop: 10 }}>
                {(contributions ?? []).map((person) => (
                  <li key={person.profile_id}>
                    <span>{person.full_name}</span>
                    <span className="muted eng">{person.tasks_done} {t('مهمة', 'tasks')}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              {t('محسوب من المهام المغلقة، لا من وصف كتبوه عن أنفسهم.',
                 'Counted from closed tasks, not from what anyone wrote about themselves.')}
            </p>
          </section>

          {(history ?? []).length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('المراجعات السابقة', 'Earlier reviews')}</h3>
              <ul className="admin-mini-list" style={{ marginTop: 10 }}>
                {(history ?? []).map((review, index) => (
                  <li key={`${review.version}-${index}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span className="eng">v{review.version} · {review.mentor_name}</span>
                    <span className="muted">
                      {review.decision === 'approved' ? t('اعتُمد', 'Approved') : t('أُعيد للتعديل', 'Sent back')}
                      {review.rating !== null && <span className="eng"> · {review.rating}/5</span>}
                    </span>
                    {review.feedback_ar && <span className="muted">{review.feedback_ar}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
