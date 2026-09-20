import Link from 'next/link';

import { SiteNav } from '@/components/SiteNav';

export const metadata = { title: 'عن TechMood' };

const PRINCIPLES = [
  {
    title: 'حساب واحد، هوية واحدة',
    body: 'عند إنشاء حسابك يصدر لك معرّف TechMood دائم. كل ما تبنيه بعده — نقاط الخبرة، النجوم، الشهادات، المشاريع، تقييمات الفرق — يعود إلى هذا المعرّف، لا إلى دورك ولا إلى اسمك المستعار.',
  },
  {
    title: 'الأدوار وصول، لا ترتيب',
    body: 'المنتور ليس «أعلى» من الطالب، والمؤسس ليس «أعلى» من الفريلانسر. كل دور يفتح مساحة عمل مختلفة، ويمكنك حمل عدة أدوار في الوقت نفسه. رفض دور لا يمسّ حسابك.',
  },
  {
    title: 'لا شهادة بلا مراجعة',
    body: 'الشهادة هنا لا تُمنح بإكمال فيديوهات. تُصدر بعد أن يراجع منتور أعمالك المطلوبة ويعتمدها، وتحمل رقماً ورمز QR يقودان إلى صفحة تحقّق عامة.',
  },
  {
    title: 'الكمّية والجودة لا تُخلطان',
    body: 'نقاط الخبرة (XP) تقيس ما أنجزته، والنجوم تقيس جودة ما أنجزته. لا يُشترى أحدهما بالآخر، والأرقام صغيرة عن قصد حتى تبقى ذات معنى.',
  },
  {
    title: 'خصوصيتك ليست إعداداً ثانوياً',
    body: 'مساحة الفريق مغلقة، وإيصالات الدفع لا يراها إلا صاحبها والإدارة المخوّلة، ولا يمكن لأحد أن يرى بياناتك بتغيير رقم في الرابط. هذا مفروض في قاعدة البيانات نفسها، لا في الواجهة.',
  },
  {
    title: 'صُنع في غزة',
    body: 'TechMood مشروع فلسطيني يبنيه فريق في غزة، ويُكتب بالعربية أولاً — لا كترجمة لواجهة إنجليزية.',
  },
];

const LOOP = [
  { step: 'تتعلّم', body: 'مسارات مفتوحة دائماً، تبدأ متى شئت ولا تنتظر دفعة.' },
  { step: 'تبني', body: 'كل دورة تنتهي بمشروع حقيقي، لا باختبار اختيار من متعدد.' },
  { step: 'تُراجَع', body: 'منتور بشري يقرأ عملك ويعطيك نجوماً وملاحظات.' },
  { step: 'تنضم', body: 'فرق ومساحات عمل مغلقة بمهام وسبرنتات وتسليمات.' },
  { step: 'تعمل', body: 'فرص عمل حر ووظائف تصل لمن يملك سجلاً موثّقاً.' },
  { step: 'تكبر', body: 'حاضنة تأخذ فكرتك إلى نموذج عمل وخطة مكتوبة.' },
];

export default function AboutPage() {
  return (
    <main className="landing">
      <SiteNav />

      <section className="hero">
        <p className="kicker">One Account · One TechMood ID · Many Journeys</p>
        <h1>منصة واحدة بين <span className="accent-grad">التعلّم والعمل</span></h1>
        <p>
          معظم المنصات تعلّمك ثم تتركك. TechMood يكمل الطريق: تتعلّم، تبني، يُراجَع
          عملك، تنضم إلى فريق، تعمل، ثم تؤسّس — وكل خطوة تترك أثراً في سجلّ مهني
          واحد يمكن التحقّق منه.
        </p>
      </section>

      <section className="section-block">
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>الرحلة</h2>
        <div className="card-grid">
          {LOOP.map((item) => (
            <article className="card" key={item.step}>
              <h3>{item.step}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>المبادئ التي نبني عليها</h2>
        <div className="card-grid">
          {PRINCIPLES.map((item) => (
            <article className="card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel section-block" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>ابدأ من حيث أنت</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>
          كل حساب يبدأ طالباً. الأدوار الأخرى تُطلب متى احتجتها.
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/signup">أنشئ حسابك</Link>
          <Link className="btn btn-ghost" href="/verify">تحقّق من شهادة</Link>
        </div>
      </section>
    </main>
  );
}
