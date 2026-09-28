import { redirect } from 'next/navigation';

import { BarList, ColumnChart } from '@/components/Charts';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_CATEGORY } from '@/lib/support';

export const metadata = { title: 'Analytics — TechMood admin' };

/**
 * What happened, week by week — each measure its own small chart on its own
 * axis — plus support by category, the most-joined paths, and whether the
 * platform's scheduled jobs are running.
 */
export default async function AdminAnalyticsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: weeks }, { data: tickets }, { data: paths }, { data: jobs }] = await Promise.all([
    supabase.rpc('admin_weekly_metrics', { p_weeks: 12 }),
    supabase.rpc('admin_ticket_stats', { p_days: 90 }),
    supabase.rpc('admin_top_paths', { p_limit: 10 }),
    supabase.rpc('admin_scheduled_jobs'),
  ]);

  const label = (week: string) => week.slice(5).replace('-', '/');
  const series = (key: 'signups' | 'active_people' | 'enrolments' | 'certificates' | 'sessions_completed' | 'tickets_opened') =>
    (weeks ?? []).map((row) => ({ label: label(row.week), value: row[key] }));
  const table = t('عرض الأرقام', 'Show the numbers');
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('التحليلات', 'Analytics')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('آخر 12 أسبوعاً، كل مقياس برسم مستقل. الأرقام معدودة من الصفوف نفسها، لا تقديرات.',
             'The last 12 weeks, each measure on its own chart. Counted from the rows themselves, not estimated.')}
        </p>
      </section>

      <section className="section-block chart-grid-4">
        <ColumnChart title={t('تسجيلات جديدة', 'New sign-ups')} data={series('signups')} tableLabel={table} />
        <ColumnChart title={t('أشخاص نشطون', 'Active people')} data={series('active_people')} tableLabel={table} />
        <ColumnChart title={t('التحاق بالمسارات', 'Path enrolments')} data={series('enrolments')} tableLabel={table} />
        <ColumnChart title={t('شهادات صادرة', 'Certificates issued')} data={series('certificates')} tableLabel={table} />
        <ColumnChart title={t('جلسات إرشاد مكتملة', 'Mentoring sessions held')} data={series('sessions_completed')} tableLabel={table} />
        <ColumnChart title={t('بلاغات جديدة', 'Tickets opened')} data={series('tickets_opened')} tableLabel={table} />
      </section>

      <section className="section-block detail-grid">
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('البلاغات حسب النوع — آخر 90 يوماً', 'Tickets by type — last 90 days')}</h3>
          {(tickets ?? []).length === 0 ? <p className="muted">{t('لا بلاغات.', 'No tickets.')}</p> : (
            <BarList rows={(tickets ?? []).map((row) => ({
              label: t(TICKET_CATEGORY[row.category]),
              value: row.opened,
              note: t(
                `صُعّد ${row.escalated} · حُل ${row.resolved}${row.avg_hours_to_resolve !== null ? ` · متوسط الحل ${row.avg_hours_to_resolve} ساعة` : ''}`,
                `${row.escalated} escalated · ${row.resolved} resolved${row.avg_hours_to_resolve !== null ? ` · ${row.avg_hours_to_resolve}h to resolve on average` : ''}`,
              ),
            }))} />
          )}
        </div>
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('أكثر المسارات التحاقاً', 'Most-joined paths')}</h3>
          {(paths ?? []).length === 0 ? <p className="muted">{t('لا التحاقات بعد.', 'No enrolments yet.')}</p> : (
            <BarList rows={(paths ?? []).map((row) => ({
              label: row.title_ar,
              value: row.enrolled,
              note: t(`أكمله ${row.completed}`, `${row.completed} completed`),
            }))} />
          )}
        </div>
      </section>

      <section className="section-block panel">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('المهام المجدولة', 'Scheduled jobs')}</h3>
        {(jobs ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            {t('pg_cron غير مفعّل في قاعدة البيانات هذه، فالمهام لا تعمل تلقائياً. على Supabase تُجدوَل مع الترحيل 0086.',
               'pg_cron is not active in this database, so the jobs do not run by themselves. On Supabase, migration 0086 schedules them.')}
          </p>
        ) : (
          <table className="data">
            <thead><tr><th>{t('المهمة', 'Job')}</th><th>{t('التكرار', 'Schedule')}</th><th>{t('آخر تشغيل', 'Last run')}</th><th>{t('النتيجة', 'Result')}</th></tr></thead>
            <tbody>
              {(jobs ?? []).map((job) => (
                <tr key={job.job}>
                  <td className="eng">{job.job}</td>
                  <td className="eng">{job.schedule}</td>
                  <td className="muted">{job.last_run ? time.format(new Date(job.last_run)) : '—'}</td>
                  <td>
                    <span className={`status-pill ${job.last_status === 'succeeded' ? 'status-ok' : job.last_status ? 'status-danger' : 'status-muted'}`}>
                      {job.last_status ?? t('لم يعمل بعد', 'Not run yet')}
                    </span>
                    {job.last_status && job.last_status !== 'succeeded' && <div className="muted" style={{ fontSize: '0.74rem' }}>{job.last_message}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
