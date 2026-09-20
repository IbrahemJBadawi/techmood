import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { reviewEntry } from './actions';

export default async function AdminExhibitionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">هذه الصفحة للمشرفين فقط.</p>;
  }

  const { data: entries } = await supabase
    .from('exhibition_entries')
    .select('id, entry_code, project_id, team_id, summary_ar, technologies, demo_url, documentation_ar, status, created_at, published_at')
    .order('created_at', { ascending: true });

  const projectIds = [...new Set((entries ?? []).map((row) => row.project_id))];
  const teamIds = [...new Set((entries ?? []).map((row) => row.team_id).filter(Boolean))] as string[];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: projects }, { data: teams }] = await Promise.all([
    supabase.from('projects').select('id, code, title_ar, completed_at').in('id', projectIds.length ? projectIds : placeholder),
    supabase.from('teams').select('id, title_ar').in('id', teamIds.length ? teamIds : placeholder),
  ]);

  const projectById = new Map((projects ?? []).map((row) => [row.id, row]));
  const teamById = new Map((teams ?? []).map((row) => [row.id, row]));

  // Contributions are derived, so an admin reviews what the board says — not a
  // claim someone typed into the submission form.
  const contributions = await Promise.all(
    (entries ?? [])
      .filter((entry) => entry.status === 'submitted')
      .map(async (entry) => {
        const { data } = await supabase.rpc('project_contributions', { p_project: entry.project_id });
        return { entryId: entry.id, rows: data ?? [] };
      }),
  );
  const contributionsByEntry = new Map(contributions.map((row) => [row.entryId, row.rows]));

  const waiting = (entries ?? []).filter((entry) => entry.status === 'submitted');
  const settled = (entries ?? []).filter((entry) => entry.status !== 'submitted');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>مراجعة المعرض</h2>
          <Link className="btn btn-ghost btn-sm" href="/exhibition">المعرض العام</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          الاعتماد ينشر المشروع ويثبّت نسخة منه: هذه النسخة هي ما يراه الجمهور، فلا تنكشف مساحة
          عمل الفريق بعد النشر.
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>بانتظار المراجعة ({waiting.length})</h3>

        {waiting.length === 0 ? (
          <p className="notice">لا مشاريع بانتظار المراجعة 🎉</p>
        ) : (
          waiting.map((entry) => {
            const project = projectById.get(entry.project_id);
            const team = teamById.get(entry.team_id ?? '');
            const rows = contributionsByEntry.get(entry.id) ?? [];

            return (
              <article className="panel section-block" key={entry.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{project?.title_ar}</h3>
                    <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
                      {team?.title_ar ?? 'مشروع فردي'}
                    </p>
                  </div>
                  <span className="id-chip">{project?.code}</span>
                </div>

                <p style={{ fontSize: '0.89rem', marginTop: 12 }}>{entry.summary_ar}</p>

                <div className="tags-row" style={{ marginTop: 10 }}>
                  {(entry.technologies ?? []).map((tech) => <span className="tag eng" key={tech}>{tech}</span>)}
                  {project?.completed_at && (
                    <span className="badge-pill eng">
                      اكتمل {new Date(project.completed_at).toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>

                {entry.demo_url && (
                  <a className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} href={entry.demo_url} target="_blank" rel="noreferrer noopener">
                    العرض التجريبي ↗
                  </a>
                )}

                <div style={{ marginTop: 16 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
                    المساهمات كما تظهر على لوحة الفريق
                  </p>
                  {rows.length === 0 ? (
                    <p className="notice notice-danger">
                      لا مهام منجزة مرتبطة بهذا المشروع — لا يوجد ما يوثّق من بناه.
                    </p>
                  ) : (
                    <table className="data">
                      <thead><tr><th>العضو</th><th>المسؤولية</th><th>مهام منجزة</th></tr></thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.profile_id}>
                            <td>{row.full_name} <span className="id-chip">{row.techmood_id}</span></td>
                            <td>{row.responsibility_ar ?? '—'}</td>
                            <td className="eng">{row.tasks_done}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <form action={reviewEntry}>
                    <input type="hidden" name="entry_id" value={entry.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn btn-primary btn-sm">اعتمد وانشر</button>
                  </form>
                  <form action={reviewEntry} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                    <input type="hidden" name="entry_id" value={entry.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="note" required placeholder="سبب الرفض — يظهر للفريق" style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-ghost btn-sm">رفض</button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>سجلّ المعرض</h3>
          <table className="data">
            <thead><tr><th>المشروع</th><th>الفريق</th><th>الحالة</th><th>نُشر</th></tr></thead>
            <tbody>
              {settled.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {projectById.get(entry.project_id)?.title_ar}
                    <br />
                    <span className="id-chip">{entry.entry_code}</span>
                  </td>
                  <td>{teamById.get(entry.team_id ?? '')?.title_ar ?? '—'}</td>
                  <td>
                    <span className={`status-pill ${entry.status === 'approved' ? 'status-ok' : 'status-danger'}`}>
                      {entry.status === 'approved' ? 'منشور' : 'مرفوض'}
                    </span>
                  </td>
                  <td className="eng">
                    {entry.published_at ? new Date(entry.published_at).toLocaleDateString('ar-EG') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
