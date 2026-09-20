import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const KIND_LABELS: Record<string, string> = {
  lesson_assignment: 'تكليف درس',
  course_task: 'مهمة تطبيقية',
  course_project: 'مشروع دورة',
  path_project: 'مشروع مسار',
  portfolio_evidence: 'دليل معرض أعمال',
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  submitted: { text: 'بانتظار المراجعة', className: 'status-pending' },
  under_review: { text: 'قيد المراجعة', className: 'status-pending' },
};

export default async function ReviewQueuePage() {
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
        هذه الصفحة للمنتورز المعتمدين. يمكنك طلب دور منتور من صفحة الجواز المهني.
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
        <h2 style={{ fontSize: '1.2rem' }}>مراجعة الأعمال</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          كل عمل سلّمه طالب وينتظر تقييمك، الأقدم أولاً. اعتمادك هنا هو ما يمنح النقاط ويفتح
          الشهادة — لا يوجد طريق آخر إليها.
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{queue?.length ?? 0}</div>
            <div className="lbl">بانتظار التقييم</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{reevaluations?.length ?? 0}</div>
            <div className="lbl">طلبات إعادة تقييم</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">
              {(queue ?? []).filter((row) => row.current_version > 1).length}
            </div>
            <div className="lbl">تسليمات معادة</div>
          </div>
        </div>
      </section>

      {(queue?.length ?? 0) === 0 ? (
        <p className="notice">لا أعمال بانتظار المراجعة الآن 🎉</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>العمل</th>
              <th>النوع</th>
              <th>النسخة</th>
              <th>منذ</th>
              <th>الحالة</th>
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
                        <span className="badge-pill" style={{ marginTop: 4 }}>طلب إعادة تقييم</span>
                      </>
                    )}
                  </td>
                  <td>{KIND_LABELS[assignment?.kind ?? ''] ?? '—'}</td>
                  <td className="eng">v{row.current_version}</td>
                  <td className="eng">{new Date(row.updated_at).toLocaleDateString('ar-EG')}</td>
                  <td><span className={`status-pill ${status.className}`}>{status.text}</span></td>
                  <td>
                    <Link className="btn btn-primary btn-sm" href={`/review/${row.id}`}>راجِع</Link>
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
