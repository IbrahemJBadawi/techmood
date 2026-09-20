import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const LOOP = ['Learn', 'Build', 'Prove', 'Connect', 'Work', 'Grow'];

const PILLARS = [
  { title: 'الأكاديمية', body: 'مسارات ودورات مبنية على التطبيق، وكل دورة تُكمَل بمشروع يُراجَع فعلياً.' },
  { title: 'المنتورز', body: 'إرشاد بشري مدفوع بجلسات محجوزة، ومراجعة حقيقية لأعمالك وتسليماتك.' },
  { title: 'الفرق', body: 'مشاريع جماعية ومساحة عمل مشتركة، لأن أغلب العمل الحقيقي يحدث ضمن فريق.' },
  { title: 'سوق العمل', body: 'فرص عمل حر ووظائف وطلبات فرق تصل لمن يملك سجلاً مهنياً موثّقاً.' },
  { title: 'الحاضنة', body: 'من فكرة إلى شركة ناشئة، بمراحل واضحة ومراجعة من خبراء.' },
  { title: 'الجواز المهني', body: 'هوية واحدة تجمع XP والنجوم والشهادات والمشاريع — قابلة للتحقق.' },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect('/home');

  return (
    <main className="landing">
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
          <span className="logo-mark" />
          TechMood
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn btn-ghost btn-sm" href="/login">تسجيل الدخول</Link>
          <Link className="btn btn-primary btn-sm" href="/signup">ابدأ رحلتك</Link>
        </div>
      </nav>

      <section className="hero">
        <p className="kicker">Build • Learn • Mentor • Work • Grow</p>
        <h1>
          ابنِ مستقبلك التقني،
          <br />
          من <span className="accent-grad">التعلّم إلى العمل</span>
        </h1>
        <p>
          حساب واحد → هوية TechMood واحدة → سجل مهني واحد يرافقك من أول درس حتى أول عقد عمل.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/signup">أنشئ حسابك</Link>
          <Link className="btn btn-ghost" href="/verify">تحقّق من شهادة</Link>
        </div>

        <div className="loop-strip">
          {LOOP.map((step, index) => (
            <span key={step} style={{ display: 'contents' }}>
              <span className="step">{step}</span>
              {index < LOOP.length - 1 && <span className="arrow">←</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="section-block">
        <p className="kicker" style={{ textAlign: 'center' }}>One Ecosystem</p>
        <h2 style={{ textAlign: 'center', margin: '8px 0 24px' }}>منصة واحدة، رحلة متصلة</h2>
        <div className="card-grid">
          {PILLARS.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel section-block">
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>كل إنجاز هنا قابل للإثبات</h2>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          الشهادة في TechMood لا تُمنح بضغطة زر: تُصدَر فقط بعد أن يُراجع منتور أعمالك المطلوبة
          ويعتمدها. كل شهادة تحمل رقماً ورمز QR يقود إلى صفحة تحقق عامة.
        </p>
      </section>
    </main>
  );
}
