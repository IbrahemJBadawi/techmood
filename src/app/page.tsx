import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SiteNav } from '@/components/SiteNav';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

const LOOP = ['Learn', 'Build', 'Prove', 'Connect', 'Work', 'Grow'];

export default async function LandingPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect('/home');

  const pillars = [
    {
      title: t('الأكاديمية', 'Academy'),
      body: t('مسارات ودورات مبنية على التطبيق، وكل دورة تُكمَل بمشروع يُراجَع فعلياً.',
              'Paths and courses built on practice, each one finished with a project a human actually reviews.'),
    },
    {
      title: t('المنتورز', 'Mentors'),
      body: t('إرشاد بشري مدفوع بجلسات محجوزة، ومراجعة حقيقية لأعمالك وتسليماتك.',
              'Paid human mentoring in booked sessions, and real review of what you hand in.'),
    },
    {
      title: t('الفرق', 'Teams'),
      body: t('مشاريع جماعية ومساحة عمل مشتركة، لأن أغلب العمل الحقيقي يحدث ضمن فريق.',
              'Group projects and a shared workspace, because most real work happens in a team.'),
    },
    {
      title: t('سوق العمل', 'Work'),
      body: t('فرص عمل حر ووظائف وطلبات فرق تصل لمن يملك سجلاً مهنياً موثّقاً.',
              'Freelance work, jobs and team openings that reach people with a verifiable record.'),
    },
    {
      title: t('الحاضنة', 'Incubator'),
      body: t('من فكرة إلى شركة ناشئة، بمراحل واضحة ومراجعة من خبراء.',
              'From an idea to a startup, in clear stages with expert review.'),
    },
    {
      title: t('الجواز المهني', 'Professional passport'),
      body: t('هوية واحدة تجمع XP والنجوم والشهادات والمشاريع — قابلة للتحقق.',
              'One identity holding your XP, stars, certificates and projects — and anyone can verify it.'),
    },
  ];

  return (
    <main className="landing">
      <SiteNav />

      <section className="hero">
        <p className="kicker">Build • Learn • Mentor • Work • Grow</p>
        <h1>
          {t('ابنِ مستقبلك التقني،', 'Build your career in tech,')}
          <br />
          {t('من ', 'from ')}
          <span className="accent-grad">{t('التعلّم إلى العمل', 'learning to working')}</span>
        </h1>
        <p>
          {t('حساب واحد → هوية TechMood واحدة → سجل مهني واحد يرافقك من أول درس حتى أول عقد عمل.',
             'One account → one TechMood ID → one professional record, from your first lesson to your first contract.')}
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/signup">{t('أنشئ حسابك', 'Create your account')}</Link>
          <Link className="btn btn-ghost" href="/verify">{t('تحقّق من شهادة', 'Verify a certificate')}</Link>
        </div>

        <div className="loop-strip">
          {LOOP.map((step, index) => (
            <span key={step} style={{ display: 'contents' }}>
              <span className="step">{step}</span>
              {index < LOOP.length - 1 && <span className="arrow">{t('←', '→')}</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="section-block">
        <p className="kicker" style={{ textAlign: 'center' }}>One Ecosystem</p>
        <h2 style={{ textAlign: 'center', margin: '8px 0 24px' }}>
          {t('منصة واحدة، رحلة متصلة', 'One platform, one connected journey')}
        </h2>
        <div className="card-grid">
          {pillars.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel section-block">
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>
          {t('كل إنجاز هنا قابل للإثبات', 'Everything here can be proved')}
        </h2>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          {t('الشهادة في TechMood لا تُمنح بضغطة زر: تُصدَر فقط بعد أن يُراجع منتور أعمالك المطلوبة ويعتمدها. كل شهادة تحمل رقماً ورمز QR يقود إلى صفحة تحقق عامة.',
             'A TechMood certificate is not handed out at the press of a button. It is issued only after a mentor has reviewed the required work and approved it. Every certificate carries a number and a QR code that lead to a public verification page.')}
        </p>
      </section>
    </main>
  );
}
