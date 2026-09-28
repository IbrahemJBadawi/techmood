import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

export const metadata = { title: 'Cohorts — TechMood admin' };

/**
 * Cohorts as a lens, not a split: the people who started the same path in the
 * same month, and how they are doing. A path stays one open community with one
 * conversation (0020); this page groups nobody, it only counts.
 */
export default async function AdminCohortsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: cohorts } = await supabase.rpc('admin_cohorts', { p_months: 12 });
  const month = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { month: 'long', year: 'numeric' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('الدفعات', 'Cohorts')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('الدفعة هنا هي من بدأ المسار نفسه في الشهر نفسه — عدسة للمتابعة، لا تقسيم: المسار يبقى مجتمعاً مفتوحاً واحداً بمحادثة واحدة. «نشط» تعني تقدّماً في درس من المسار خلال 30 يوماً.',
             'A cohort here is who started the same path in the same month — a lens for following up, not a split: a path stays one open community with one conversation. "Active" means progress on a lesson of the path in the last 30 days.')}
        </p>
      </section>

      {(cohorts ?? []).length === 0 ? (
        <p className="notice">{t('لا التحاقات خلال السنة الماضية.', 'No enrolments in the last year.')}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t('المسار', 'Path')}</th><th>{t('الشهر', 'Month')}</th><th>{t('التحقوا', 'Started')}</th>
              <th>{t('نشطون (30 يوماً)', 'Active (30 days)')}</th><th>{t('أكملوا', 'Completed')}</th>
            </tr>
          </thead>
          <tbody>
            {cohorts!.map((row) => (
              <tr key={`${row.path_id}-${row.cohort_month}`}>
                <td><Link href="/admin/academy">{row.path_title_ar}</Link></td>
                <td>{month.format(new Date(row.cohort_month))}</td>
                <td className="eng">{row.enrolled}</td>
                <td className="eng">{row.active_30d} <span className="muted">({Math.round((100 * row.active_30d) / row.enrolled)}%)</span></td>
                <td className="eng">{row.completed} <span className="muted">({row.completion_pct}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
