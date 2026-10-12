import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

// The page is a client form; its title is set here.
export const generateMetadata = localizedTitle('شركة ناشئة جديدة — TechMood', 'New startup — TechMood');

/** Starting a startup is for Premium (0166) — say so before the form, not after it. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/startups/new');
  const [{ data: premium }, { data: admin }] = await Promise.all([
    supabase.rpc('is_premium', { p_profile: user.id }),
    supabase.rpc('is_admin'),
  ]);
  if (premium || admin) return children;

  return (
    <>
      <BackLink href="/startups" label={t('رجوع', 'Back')} />
      <section className="panel section-block business-gate" style={{ marginTop: 16, maxWidth: 620 }}>
        <h3>✦ {t('Startup Studio لمشتركي Premium', 'The Startup Studio is for Premium members')}</h3>
        <p className="muted">
          {t('ست أدوات لتحويل الفكرة إلى شركة: السوق، والمنافسون، والمستخدمون، والجدوى، وخطة العمل، ونموذج العمل — مع المساعد الذكي في كل خطوة.',
             'Six tools to turn an idea into a company: market, competitors, users, feasibility, the business plan and the business model — with the assistant at every step.')}
        </p>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {t('إن دعاك فريق إلى مشروعه فستدخله دون اشتراك.', 'If a team invites you into its startup, you can join it without a subscription.')}
        </p>
        <Link className="btn btn-primary" href="/premium">{t('اشترك في Premium', 'Get Premium')}</Link>
      </section>
    </>
  );
}
