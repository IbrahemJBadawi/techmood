import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { claimEntry } from './actions';

/**
 * The mentor's exhibition queue.
 *
 * A project reaching here has been finished, submitted, and is waiting on the
 * judgement that turns it into evidence. It is a separate queue from lesson
 * work because it is a different kind of reading: a whole project against six
 * criteria, not one assignment against one.
 */
export default async function ExhibitionReviewQueue() {
  const t = await getT();
  const locale = await getLocale();
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
        {t('هذه الصفحة للمنتورز المعتمدين.', 'This page is for approved mentors.')}
      </p>
    );
  }

  const { data: entries } = await supabase
    .from('exhibition_entries')
    .select('id, entry_code, project_id, team_id, status, version, summary_ar, created_at')
    .in('status', ['submitted', 'under_review'])
    .order('created_at');

  const projectIds = [...new Set((entries ?? []).map((entry) => entry.project_id))];
  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, title_ar, kind')
    .in('id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']);

  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('مشاريع بانتظار التقييم', 'Projects waiting to be judged')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/review">{t('مراجعة التكاليف', 'Assignment reviews')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('تقييمك هنا هو ما يحوّل المشروع من عمل داخل فريق إلى دليل مهني يمكن عرضه. تُقيَّم ستة معايير، والتقييم العام متوسطها.',
             'Your judgement here is what turns a project from work inside a team into professional evidence. Six criteria, and the overall rating is their average.')}
        </p>
      </section>

      {(entries?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا مشاريع بانتظار التقييم الآن 🎉', 'No projects waiting 🎉')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t('المشروع', 'Project')}</th>
              <th>{t('النسخة', 'Version')}</th>
              <th>{t('منذ', 'Waiting since')}</th>
              <th>{t('الحالة', 'Status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry) => {
              const project = projectById.get(entry.project_id);
              return (
                <tr key={entry.id}>
                  <td>
                    {project?.title_ar ?? '—'}
                    <br />
                    <span className="id-chip">{project?.code}</span>
                  </td>
                  <td className="eng">v{entry.version}</td>
                  <td className="eng">{formatDate(locale, entry.created_at)}</td>
                  <td>
                    <span className={`status-pill ${entry.status === 'under_review' ? 'status-pending' : 'status-muted'}`}>
                      {entry.status === 'under_review' ? t('قيد المراجعة', 'Under review') : t('بانتظار منتور', 'Waiting')}
                    </span>
                  </td>
                  <td>
                    {entry.status === 'submitted' ? (
                      <form action={claimEntry}>
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <button className="btn btn-ghost btn-sm">{t('استلم المراجعة', 'Pick it up')}</button>
                      </form>
                    ) : (
                      <Link className="btn btn-primary btn-sm" href={`/review/exhibition/${entry.id}`}>
                        {t('قيّمه', 'Judge it')}
                      </Link>
                    )}
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
