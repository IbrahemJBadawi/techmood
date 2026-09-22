import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { OPPORTUNITY_KIND, compensationLabel } from '@/lib/marketplace';

import { StartupNav } from '../StartupNav';

/**
 * What the company is looking for, and who answered.
 *
 * The opening itself lives in the market — the same table everybody else posts
 * to, so a person applying to a company applies the way they apply to anything
 * else, with their record rather than a CV.
 */
export default async function HiringPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: openings }, { data: canManage }] = await Promise.all([
    supabase.from('opportunities')
      .select('id, kind, title_ar, status, seats, filled_count, compensation_kind, amount_min, amount_max, currency, compensation_ar, created_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false }),
    supabase.rpc('can_manage_startup', { p_startup: startupId }),
  ]);

  const ids = (openings ?? []).map((row) => row.id);
  const { data: applications } = await supabase
    .from('opportunity_applications')
    .select('opportunity_id, stage')
    .in('opportunity_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const countOf = new Map<string, number>();
  for (const row of applications ?? []) {
    countOf.set(row.opportunity_id, (countOf.get(row.opportunity_id) ?? 0) + 1);
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — التوظيف', ' — hiring')}</h2>
          {canManage === true && (
            <Link className="btn btn-primary btn-sm" href={`/marketplace/new?startup=${startupId}`}>
              {t('انشر فرصة', 'Post an opening')}
            </Link>
          )}
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('موظف، مستقل، أو فريق كامل — الفرصة تُنشر في سوق TechMood نفسه، فيصلك من يملك سجلاً موثّقاً لا سيرة ذاتية.',
             'An employee, a freelancer, or a whole team — the opening is posted in the TechMood market itself, so what reaches you is a verifiable record rather than a CV.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      {(openings ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا فرص منشورة', 'Nothing posted')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('تستطيع أيضاً البحث عن شخص بنفسك ودعوته بالاسم.',
               'You can also go and find somebody yourself, and invite them by name.')}
          </p>
          <Link className="btn btn-ghost btn-sm" href="/marketplace?tab=talent">{t('ابحث عن كفاءات', 'Find talent')}</Link>
        </div>
      ) : (
        <section className="section-block">
          <table className="data booking-table">
            <thead>
              <tr>
                <th>{t('الفرصة', 'Opening')}</th>
                <th>{t('النوع', 'Kind')}</th>
                <th>{t('الأجر', 'Pay')}</th>
                <th>{t('المتقدّمون', 'Applicants')}</th>
                <th>{t('الحالة', 'Status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(openings ?? []).map((opening) => (
                <tr key={opening.id}>
                  <td data-label={t('الفرصة', 'Opening')}>
                    {opening.title_ar}
                    <p className="muted" style={{ fontSize: '0.76rem' }}>{formatDate(locale, opening.created_at)}</p>
                  </td>
                  <td data-label={t('النوع', 'Kind')} className="muted">{t(OPPORTUNITY_KIND[opening.kind].label)}</td>
                  <td data-label={t('الأجر', 'Pay')} className="eng">{compensationLabel(locale, opening)}</td>
                  <td data-label={t('المتقدّمون', 'Applicants')} className="eng">{countOf.get(opening.id) ?? 0}</td>
                  <td data-label={t('الحالة', 'Status')}>
                    <span className={`status-pill ${opening.status === 'published' ? 'status-ok' : 'status-muted'}`}>
                      {opening.status === 'published' ? t('مفتوحة', 'Open') : t('مغلقة', 'Closed')}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-ghost btn-sm" href={`/marketplace/${opening.id}`}>
                      {t('افتح', 'Open')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.96rem' }}>{t('تحتاج رأياً قبل التوظيف؟', 'Want an opinion before you hire?')}</h3>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
          {t('احجز جلسة مع منتور في الأعمال أو المنتج أو التقنية — من نفس المنصة، وبنفس الحساب.',
             'Book a session with a mentor in business, product or engineering — from the same platform, with the same account.')}
        </p>
        <Link className="btn btn-ghost btn-sm" href="/mentors">{t('ابحث عن منتور', 'Find a mentor')}</Link>
      </section>
    </>
  );
}
