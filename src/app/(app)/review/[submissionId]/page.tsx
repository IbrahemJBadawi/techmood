import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import type { EvidenceKind } from '@/lib/database.types';

import { EvaluationForm } from '../EvaluationForm';

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  github: 'المستودع',
  linkedin: 'منشور التوثيق',
  youtube: 'فيديو الشرح',
  drive: 'الملفات',
  portfolio: 'معرض الأعمال',
  website: 'الموقع',
  file: 'ملف',
};

const DECISION_LABELS: Record<string, { text: string; className: string }> = {
  approved: { text: 'معتمد', className: 'status-ok' },
  changes_requested: { text: 'مطلوب تعديل', className: 'status-pending' },
  rejected: { text: 'غير معتمد', className: 'status-danger' },
};

export default async function ReviewSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: isMentor }, { data: isAdmin }] = await Promise.all([
    supabase.rpc('is_mentor'),
    supabase.rpc('is_admin'),
  ]);

  if (isMentor !== true && isAdmin !== true) {
    return <p className="notice notice-danger">هذه الصفحة للمنتورز المعتمدين.</p>;
  }

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, assignment_id, profile_id, status, current_version, created_at, updated_at')
    .eq('id', submissionId)
    .single();

  if (!submission) notFound();

  const [{ data: assignment }, { data: student }, { data: versions }, { data: evaluations }, { data: reeval }] =
    await Promise.all([
      supabase
        .from('assignments')
        .select('id, kind, title_ar, brief_ar, required_evidence, is_required, is_group_work, lesson_id, course_id, path_id')
        .eq('id', submission.assignment_id)
        .single(),
      supabase
        .from('profiles')
        .select('id, full_name, techmood_id, github_url, linkedin_url')
        .eq('id', submission.profile_id)
        .single(),
      supabase
        .from('submission_versions')
        .select('id, version, note_ar, submitted_at')
        .eq('submission_id', submissionId)
        .order('version', { ascending: false }),
      supabase
        .from('evaluations')
        .select('id, version_id, evaluator_id, decision, stars, feedback_ar, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reevaluation_requests')
        .select('id, reason_ar, created_at')
        .eq('submission_id', submissionId)
        .eq('status', 'open')
        .maybeSingle(),
    ]);

  const versionIds = (versions ?? []).map((version) => version.id);

  const { data: evidence } = await supabase
    .from('submission_evidence')
    .select('id, version_id, kind, url, label')
    .in('version_id', versionIds.length ? versionIds : ['00000000-0000-0000-0000-000000000000']);

  // Where does this work sit in the catalogue?
  let context: string | null = null;
  if (assignment?.course_id) {
    const { data: course } = await supabase
      .from('courses').select('title_ar').eq('id', assignment.course_id).maybeSingle();
    context = course?.title_ar ?? null;
  } else if (assignment?.lesson_id) {
    const { data: lesson } = await supabase
      .from('lessons').select('title_ar, modules(courses(title_ar))').eq('id', assignment.lesson_id).maybeSingle();
    const nested = lesson?.modules as unknown as { courses?: { title_ar: string } } | null;
    context = nested?.courses?.title_ar ?? lesson?.title_ar ?? null;
  } else if (assignment?.path_id) {
    const { data: path } = await supabase
      .from('learning_paths').select('title_ar').eq('id', assignment.path_id).maybeSingle();
    context = path?.title_ar ?? null;
  }

  const evidenceFor = (versionId: string) =>
    (evidence ?? []).filter((item) => item.version_id === versionId);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/review">→ رجوع لقائمة المراجعة</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem' }}>{assignment?.title_ar}</h2>
            {context && <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>{context}</p>}
          </div>
          <span className="badge-pill">
            {assignment?.is_group_work ? 'عمل جماعي' : 'عمل فردي'}
          </span>
        </div>

        <div className="tags-row" style={{ marginTop: 12 }}>
          <span className="badge-pill">{student?.full_name}</span>
          <span className="id-chip">{student?.techmood_id}</span>
          <span className="id-chip">v{submission.current_version}</span>
        </div>

        {assignment?.brief_ar && (
          <p className="muted" style={{ fontSize: '0.86rem', marginTop: 12 }}>{assignment.brief_ar}</p>
        )}
      </section>

      {reeval && (
        <p className="notice section-block">
          <strong>طلب إعادة تقييم:</strong> {reeval.reason_ar}
        </p>
      )}

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>
              التسليمات ({versions?.length ?? 0})
            </h3>

            {(versions ?? []).map((version, index) => (
              <div
                key={version.id}
                style={{
                  borderTop: index === 0 ? 'none' : '1px solid var(--line)',
                  paddingTop: index === 0 ? 0 : 14,
                  marginTop: index === 0 ? 0 : 14,
                }}
              >
                <div className="row-between">
                  <strong style={{ fontSize: '0.9rem' }}>
                    النسخة {version.version}
                    {index === 0 && <span className="badge-pill" style={{ marginInlineStart: 8 }}>الأحدث</span>}
                  </strong>
                  <span className="muted eng" style={{ fontSize: '0.76rem' }}>
                    {new Date(version.submitted_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                {version.note_ar && (
                  <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>{version.note_ar}</p>
                )}

                <div className="tags-row" style={{ marginTop: 10 }}>
                  {evidenceFor(version.id).map((item) => (
                    <a
                      key={item.id}
                      className="badge-pill"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ textDecoration: 'none' }}
                    >
                      ↗ {EVIDENCE_LABELS[item.kind] ?? item.kind}
                    </a>
                  ))}
                  {evidenceFor(version.id).length === 0 && (
                    <span className="muted" style={{ fontSize: '0.8rem' }}>لا روابط مرفقة</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>
              سجل التقييم ({evaluations?.length ?? 0})
            </h3>

            {(evaluations?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>لم يُقيَّم هذا العمل بعد.</p>
            ) : (
              evaluations!.map((evaluation, index) => {
                const decision = DECISION_LABELS[evaluation.decision] ?? DECISION_LABELS.rejected;
                const version = (versions ?? []).find((item) => item.id === evaluation.version_id);

                return (
                  <div
                    key={evaluation.id}
                    style={{
                      borderTop: index === 0 ? 'none' : '1px solid var(--line)',
                      paddingTop: index === 0 ? 0 : 12,
                      marginTop: index === 0 ? 0 : 12,
                    }}
                  >
                    <div className="row-between">
                      <span className={`status-pill ${decision.className}`}>{decision.text}</span>
                      <span className="muted eng" style={{ fontSize: '0.74rem' }}>
                        v{version?.version ?? '?'} ·{' '}
                        {new Date(evaluation.created_at).toLocaleDateString('ar-EG')}
                        {evaluation.evaluator_id === user.id ? ' · أنت' : ''}
                      </span>
                    </div>
                    {evaluation.stars !== null && (
                      <div style={{ marginTop: 6 }}><Stars value={evaluation.stars} /></div>
                    )}
                    {evaluation.feedback_ar && (
                      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>
                        {evaluation.feedback_ar}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside>
          <EvaluationForm submissionId={submission.id} />
        </aside>
      </div>
    </>
  );
}
