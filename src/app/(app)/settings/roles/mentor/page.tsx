import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ROLE_STATUS_LABEL } from '@/lib/roles';
import type { RoleStatus } from '@/lib/database.types';

import { MentorApplicationForm } from './MentorApplicationForm';

export const metadata = { title: 'التقدّم كمنتور — TechMood' };

export default async function MentorApplicationPage() {
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
      .select('headline_ar, bio_ar, domains, years_experience, weekly_hours, motivation_ar, experience_ar, linkedin_url, portfolio_url, languages')
      .eq('profile_id', user.id)
      .maybeSingle(),
    supabase.from('fields').select('slug, name_ar').eq('status', 'approved').order('name_ar'),
  ]);

  const status = request?.status as RoleStatus | undefined;

  if (status === 'approved') {
    return (
      <section className="panel section-block">
        <h1 style={{ fontSize: '1.1rem', marginBottom: 6 }}>أنت منتور معتمد</h1>
        <p className="muted">
          يمكنك تعديل صفحتك وأوقاتك من <Link href="/mentors">صفحة المنتورز</Link>.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>التقدّم كمنتور</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 680 }}>
          المنتور في TechMood يراجع أعمال الناس ويقرّر ما إذا كانت تستحق شهادة.
          لهذا الطلب نموذج كامل وليس زرّاً: من سيقرأه يحتاج أن يعرف خبرتك ودافعك
          قبل أن يفتح لك هذه المسؤولية.
        </p>
      </section>

      {status && status !== 'rejected' && (
        <p className="notice">
          حالة طلبك الحالية: <strong>{ROLE_STATUS_LABEL[status]}</strong>
          {request?.review_note ? ` — ${request.review_note}` : ''}
        </p>
      )}

      {status === 'rejected' && request?.review_note && (
        <p className="notice notice-danger">
          <strong>لم يُقبل الطلب السابق:</strong> {request.review_note}
        </p>
      )}

      <MentorApplicationForm
        fields={fields ?? []}
        existing={mentor ?? null}
        locked={status === 'pending_review'}
      />
    </>
  );
}
