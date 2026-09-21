import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';

const KIND_LABELS: Record<string, Text> = {
  lesson_assignment:  { ar: 'تكليف درس',          en: 'Lesson assignment' },
  course_task:        { ar: 'مهمة تطبيقية',      en: 'Practical task' },
  course_project:     { ar: 'مشروع دورة',        en: 'Course project' },
  path_project:       { ar: 'مشروع مسار',        en: 'Path project' },
  portfolio_evidence: { ar: 'دليل معرض أعمال',   en: 'Portfolio evidence' },
};

const STATUS_LABELS: Record<string, { text: Text; className: string }> = {
  submitted:    { text: { ar: 'بانتظار المراجعة', en: 'Awaiting review' }, className: 'status-pending' },
  under_review: { text: { ar: 'قيد المراجعة',     en: 'Under review' },    className: 'status-pending' },
};

export default async function ReviewQueuePage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: isMentor }, { data: isAdmin }] = await Promise.all([
    supabase.rpc('is_mentor'),
    supabase.rpc('is_admin'),
  ]);

  if (isMentor !== true && isAdmin !== true) {
    return (
      <p className="notice notice-danger">
        {t('هذه الصفحة للمنتورز المعتمدين. يمكنك طلب دور منتور من صفحة الجواز المهني.', 'This page is for approved mentors. You can ask for the mentor role from your passport.')}
      </p>
    );
  }

  const { data: queue } = await supabase
    .from('submissions')
    .select('id, status, current_version, updated_at, assignment_id, profile_id')
    .in('status', ['submitted', 'under_review'])
    .order('updated_at', { ascending: true });

  const assignmentIds = [...new Set((queue ?? []).map((row) => row.assignment_id))];
  const profileIds = [...new Set((queue ?? []).map((row) => row.profile_id))];
  const submissionIds = (queue ?? []).map((row) => row.id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: assignments }, { data: profiles }, { data: reevaluations }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, kind, title_ar')
      .in('id', assignmentIds.length ? assignmentIds : placeholder),
    supabase
      .from('profiles')
      .select('id, full_name, techmood_id')
      .in('id', profileIds.length ? profileIds : placeholder),
    supabase
      .from('reevaluation_requests')
      .select('id, submission_id, reason_ar, created_at')
      .eq('status', 'open')
      .in('submission_id', submissionIds.length ? submissionIds : placeholder),
  ]);

  const assignmentById = new Map((assignments ?? []).map((row) => [row.id, row]));
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const reevalBySubmission = new Map((reevaluations ?? []).map((row) => [row.submission_id, row]));

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('مراجعة الأعمال', 'Review work')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('كل عمل سلّمه طالب وينتظر تقييمك، الأقدم أولاً. اعتمادك هنا هو ما يمنح النقاط ويفتح الشهادة — لا يوجد طريق آخر إليها.',
             'Everything a student has handed in and is waiting on you, oldest first. Your approval here is what awards the points and unlocks the certificate — there is no other route to one.')}
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{queue?.length ?? 0}</div>
            <div className="lbl">{t('بانتظار التقييم', 'Awaiting evaluation')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{reevaluations?.length ?? 0}</div>
            <div className="lbl">{t('طلبات إعادة تقييم', 'Re-evaluation requests')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">
              {(queue ?? []).filter((row) => row.current_version > 1).length}
            </div>
            <div className="lbl">{t('تسليمات معادة', 'Resubmissions')}</div>
          </div>
        </div>
      </section>

      {(queue?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا أعمال بانتظار المراجعة الآن 🎉', 'Nothing waiting for review 🎉')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t('الطالب', 'Student')}</th>
              <th>{t('العمل', 'Work')}</th>
              <th>{t('النوع', 'Kind')}</th>
              <th>{t('النسخة', 'Version')}</th>
              <th>{t('منذ', 'Waiting')}</th>
              <th>{t('الحالة', 'Status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {queue!.map((row) => {
              const assignment = assignmentById.get(row.assignment_id);
              const student = profileById.get(row.profile_id);
              const status = STATUS_LABELS[row.status] ?? STATUS_LABELS.submitted;
              const reeval = reevalBySubmission.get(row.id);

              return (
                <tr key={row.id}>
                  <td>
                    {student?.full_name ?? '—'}
                    <br />
                    <span className="id-chip">{student?.techmood_id}</span>
                  </td>
                  <td>
                    {assignment?.title_ar ?? '—'}
                    {reeval && (
                      <>
                        <br />
                        <span className="badge-pill" style={{ marginTop: 4 }}>{t('طلب إعادة تقييم', 'Re-evaluation request')}</span>
                      </>
                    )}
                  </td>
                  <td>{KIND_LABELS[assignment?.kind ?? ''] ? t(KIND_LABELS[assignment?.kind ?? '']) : '—'}</td>
                  <td className="eng">v{row.current_version}</td>
                  <td className="eng">{new Date(row.updated_at).toLocaleDateString('ar-EG')}</td>
                  <td><span className={`status-pill ${status.className}`}>{t(status.text)}</span></td>
                  <td>
                    <Link className="btn btn-primary btn-sm" href={`/review/${row.id}`}>{t('راجِع', 'Review')}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
