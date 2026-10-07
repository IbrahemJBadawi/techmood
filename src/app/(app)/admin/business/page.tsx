import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { setInquiryStatus } from './actions';

export const generateMetadata = localizedTitle('طلبات الشركات — إدارة TechMood', 'Business inquiries — TechMood admin');

/** What companies wrote on /business (0150), newest first, with where each stands. */
export default async function AdminBusinessPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: rows } = await supabase.from('business_inquiries')
    .select('id, company, contact_name, email, phone, need, message, status, created_at')
    .order('created_at', { ascending: false }).limit(200);
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });

  const NEED = {
    hire: t('توظيف', 'Hiring'), project: t('مشروع مع فريق', 'A team project'), training: t('تدريب', 'Training'),
    sponsor: t('رعاية', 'Sponsorship'), other: t('أخرى', 'Other'),
  } as const;
  const STATUS = {
    new: { label: t('جديد', 'New'), tone: 'status-pending' },
    contacted: { label: t('تم التواصل', 'Contacted'), tone: 'status-ok' },
    closed: { label: t('مغلق', 'Closed'), tone: 'status-muted' },
  } as const;

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('طلبات الشركات', 'Business inquiries')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('ما كتبته الشركات في صفحة «للأعمال». يصلكم تنبيه بكل طلب جديد.', 'What companies sent from the «For business» page. Each new one notifies you.')}
        </p>
      </section>

      {(rows ?? []).length === 0 ? (
        <div className="panel empty-state"><h3 style={{ fontSize: '0.98rem' }}>{t('لا طلبات بعد', 'No inquiries yet')}</h3></div>
      ) : (
        <ul className="biz-inbox">
          {(rows ?? []).map((row) => (
            <li key={row.id} className="panel">
              <div className="row-between">
                <strong>{row.company}</strong>
                <span className={`status-pill ${STATUS[row.status].tone}`}>{STATUS[row.status].label}</span>
              </div>
              <p className="muted" style={{ fontSize: '0.82rem' }}>
                {row.contact_name} · <a href={`mailto:${row.email}`} dir="ltr">{row.email}</a>
                {row.phone && <> · <span dir="ltr">{row.phone}</span></>} · {NEED[row.need]} · {time.format(new Date(row.created_at))}
              </p>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{row.message}</p>
              <form action={setInquiryStatus} className="row-actions">
                <input type="hidden" name="id" value={row.id} />
                {row.status !== 'contacted' && <button className="btn btn-primary btn-sm" name="status" value="contacted">{t('تم التواصل', 'Mark contacted')}</button>}
                {row.status !== 'closed' && <button className="btn btn-ghost btn-sm" name="status" value="closed">{t('أغلق', 'Close')}</button>}
                {row.status !== 'new' && <button className="btn btn-ghost btn-sm" name="status" value="new">{t('أعده جديداً', 'Mark new')}</button>}
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
