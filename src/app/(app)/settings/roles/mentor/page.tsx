import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { ROLE_STATUS_LABEL } from '@/lib/roles';
import type { RoleStatus } from '@/lib/database.types';

import { MentorApplicationForm } from './MentorApplicationForm';

export const generateMetadata = localizedTitle('التقديم كمنتور — TechMood', 'Apply as a mentor — TechMood');

export default async function MentorApplicationPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: request }, { data: mentor }, { data: fields }] = await Promise.all([
    supabase
      .from('profile_roles')
      .select('id, status, review_note')
      .eq('profile_id', user.id)
      .eq('role', 'mentor')
      .maybeSingle(),
    supabase
      .from('mentor_profiles')
      .select('headline_ar, bio_ar, domains, years_experience, weekly_hours, motivation_ar, experience_ar, linkedin_url, portfolio_url, cv_url, certificate_urls, languages')
      .eq('profile_id', user.id)
      .maybeSingle(),
    supabase.from('fields').select('slug, name_ar').eq('status', 'approved').order('name_ar'),
  ]);

  const status = request?.status as RoleStatus | undefined;

  if (status === 'approved') {
    return (
      <section className="panel section-block">
        <h1 style={{ fontSize: '1.1rem', marginBottom: 6 }}>{t('أنت منتور معتمد', 'You are an approved mentor')}</h1>
        <p className="muted">
          {t('يمكنك تعديل صفحتك وأوقاتك من ', 'You can edit your page and your hours from ')}
          <Link href="/mentors">{t('صفحة المنتورز', 'the mentors page')}</Link>.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>{t('التقدّم كمنتور', 'Apply as a mentor')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 680 }}>
          {t('ابدأ بالأساسيات، وخلال المراجعة تستخدم TechMood كطالب بكل خدماته. أضف أدلة (سيرة، شهادات، أعمال) متى شئت — تقوّي طلبك. عند القبول تبدأ من مستوى Peer / Junior (نطاق 10$–30$ للساعة) ما لم تضعك الإدارة أعلى حسب خبرتك، وتطلب الترقية لاحقاً فتراجعها الإدارة. وإن لم يُقبل الطلب تبقى طالباً كما أنت، مع السبب.',
             'Start with the basics; while it is reviewed you use TechMood as a learner, with every service. Add evidence (CV, certificates, work) whenever you like — it strengthens your application. Once approved you start at Peer / Junior (a $10–30 hourly range) unless TechMood places you higher for your experience, and later request upgrades that TechMood reviews. If it is not accepted, you stay a learner as you were, with the reason.')}
        </p>
      </section>

      {status && status !== 'rejected' && (
        <p className="notice">
          {t('حالة طلبك الحالية: ', 'Your request currently reads: ')}
          <strong>{t(ROLE_STATUS_LABEL[status])}</strong>
          {request?.review_note ? ` — ${request.review_note}` : ''}
        </p>
      )}

      {status === 'rejected' && request?.review_note && (
        <p className="notice notice-danger">
          <strong>{t('لم يُقبل الطلب السابق:', 'The previous request was not accepted:')}</strong> {request.review_note}
        </p>
      )}

      <MentorApplicationForm
        fields={fields ?? []}
        existing={mentor ?? null}
        isOpen={status === 'pending_review' || status === 'needs_more_info'}
      />
    </>
  );
}
