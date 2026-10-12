import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT, localizedTitle } from '@/lib/i18n.server';
import { VerifiedBadge } from '@/components/VerifiedBadge';

import { VerificationForm } from './VerificationForm';

export const generateMetadata = localizedTitle('توثيق الحساب — TechMood', 'Account verification — TechMood');

/**
 * Identity verification (0161): an admin looks at one document, decides, and
 * the document is deleted. What stays is the blue ✓ — never bought, never
 * automatic.
 */
export default async function VerificationPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: verified }, { data: requests }] = await Promise.all([
    supabase.from('verified_members').select('since').eq('profile_id', user.id).maybeSingle(),
    supabase.from('identity_verifications').select('id, status, reason, created_at, reviewed_at')
      .eq('profile_id', user.id).order('created_at', { ascending: false }).limit(5),
  ]);
  const pending = (requests ?? []).find((row) => row.status === 'pending');
  const lastRejected = (requests ?? []).find((row) => row.status === 'rejected');
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' });

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>{t('توثيق الحساب', 'Account verification')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 640 }}>
          {t('الحساب الموثّق تظهر بجانب اسمه علامة ', 'A verified account shows ')}
          <VerifiedBadge />
          {t(' في كل المنصة: الملف، والبورتفوليو، والجداول، والسوق. تعني أن الإدارة تحقّقت من هويتك — لا تُشترى بالمال.',
             ' next to its name everywhere: profile, portfolio, tables and the market. It means an admin checked your identity — it cannot be bought.')}
        </p>
      </section>

      <section className="hm-card st-section section-block">
        {verified ? (
          <p className="notice notice-ok">
            <VerifiedBadge /> {t(`حسابك موثّق منذ ${date.format(new Date(verified.since))}.`, `Your account is verified since ${date.format(new Date(verified.since))}.`)}
          </p>
        ) : pending ? (
          <p className="notice">
            {t(`طلبك قيد المراجعة منذ ${date.format(new Date(pending.created_at))} — ستصلك النتيجة بإشعار.`,
               `Your request is under review since ${date.format(new Date(pending.created_at))} — you will be notified.`)}
          </p>
        ) : (
          <>
            {lastRejected?.reason && (
              <p className="notice notice-danger">
                {t('لم يُقبل طلبك السابق: ', 'Your last request was not accepted: ')}{lastRejected.reason}
              </p>
            )}
            <h3>{t('أرسل وثيقة', 'Send a document')}</h3>
            <ul className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 12px', paddingInlineStart: 18 }}>
              <li>{t('تراها الإدارة فقط، وتُحذف فور اتخاذ القرار.', 'Only admins see it, and it is deleted as soon as they decide.')}</li>
              <li>{t('يجب أن يطابق الاسم اسم حسابك.', 'The name should match your account name.')}</li>
            </ul>
            <VerificationForm userId={user.id} />
          </>
        )}
      </section>
    </>
  );
}
