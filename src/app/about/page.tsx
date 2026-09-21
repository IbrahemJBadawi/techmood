import Link from 'next/link';

import { SiteNav } from '@/components/SiteNav';
import { getT } from '@/lib/i18n.server';

export const metadata = { title: 'About — TechMood' };

export default async function AboutPage() {
  const t = await getT();

  const principles = [
    {
      title: t('حساب واحد، هوية واحدة', 'One account, one identity'),
      body: t('عند إنشاء حسابك يصدر لك معرّف TechMood دائم. كل ما تبنيه بعده — نقاط الخبرة، النجوم، الشهادات، المشاريع، تقييمات الفرق — يعود إلى هذا المعرّف، لا إلى دورك ولا إلى اسمك المستعار.',
              'Creating your account issues you a permanent TechMood ID. Everything you build afterwards — XP, stars, certificates, projects, team reviews — belongs to that ID, not to your role and not to your handle.'),
    },
    {
      title: t('الأدوار وصول، لا ترتيب', 'Roles are access, not rank'),
      body: t('المنتور ليس «أعلى» من الطالب، والمؤسس ليس «أعلى» من الفريلانسر. كل دور يفتح مساحة عمل مختلفة، ويمكنك حمل عدة أدوار في الوقت نفسه. رفض دور لا يمسّ حسابك.',
              'A mentor is not "above" a student, and a founder is not "above" a freelancer. Each role opens a different workspace, and you can hold several at once. Turning a role down does not touch your account.'),
    },
    {
      title: t('لا شهادة بلا مراجعة', 'No certificate without review'),
      body: t('الشهادة هنا لا تُمنح بإكمال فيديوهات. تُصدر بعد أن يراجع منتور أعمالك المطلوبة ويعتمدها، وتحمل رقماً ورمز QR يقودان إلى صفحة تحقّق عامة.',
              'A certificate here is not earned by finishing videos. It is issued after a mentor reviews the required work and approves it, and it carries a number and a QR code that lead to a public verification page.'),
    },
    {
      title: t('الكمّية والجودة لا تُخلطان', 'Quantity and quality are never mixed'),
      body: t('نقاط الخبرة (XP) تقيس ما أنجزته، والنجوم تقيس جودة ما أنجزته. لا يُشترى أحدهما بالآخر، والأرقام صغيرة عن قصد حتى تبقى ذات معنى.',
              'XP measures how much you have done; stars measure how well. Neither buys the other, and the numbers are deliberately small so they keep their meaning.'),
    },
    {
      title: t('خصوصيتك ليست إعداداً ثانوياً', 'Privacy is not a secondary setting'),
      body: t('مساحة الفريق مغلقة، وإيصالات الدفع لا يراها إلا صاحبها والإدارة المخوّلة، ولا يمكن لأحد أن يرى بياناتك بتغيير رقم في الرابط. هذا مفروض في قاعدة البيانات نفسها، لا في الواجهة.',
              'A team workspace is closed, a payment receipt is seen only by the person who uploaded it and authorised admins, and nobody reaches your data by editing a number in a URL. That is enforced in the database itself, not in the interface.'),
    },
    {
      title: t('صُنع في غزة', 'Made in Gaza'),
      body: t('TechMood مشروع فلسطيني يبنيه فريق في غزة، ويُكتب بالعربية أولاً — لا كترجمة لواجهة إنجليزية.',
              'TechMood is a Palestinian project built by a team in Gaza, and written in Arabic first — not as a translation of an English original.'),
    },
  ];

  const loop = [
    { step: t('تتعلّم', 'You learn'),  body: t('مسارات مفتوحة دائماً، تبدأ متى شئت ولا تنتظر دفعة.', 'Paths are always open. Start when you want; there is no cohort to wait for.') },
    { step: t('تبني', 'You build'),    body: t('كل دورة تنتهي بمشروع حقيقي، لا باختبار اختيار من متعدد.', 'Every course ends in a real project, not a multiple-choice quiz.') },
    { step: t('تُراجَع', 'You are reviewed'), body: t('منتور بشري يقرأ عملك ويعطيك نجوماً وملاحظات.', 'A human mentor reads your work and gives you stars and notes.') },
    { step: t('تنضم', 'You join'),     body: t('فرق ومساحات عمل مغلقة بمهام وسبرنتات وتسليمات.', 'Teams and closed workspaces with tasks, sprints and deliverables.') },
    { step: t('تعمل', 'You work'),     body: t('فرص عمل حر ووظائف تصل لمن يملك سجلاً موثّقاً.', 'Freelance work and jobs that reach people with a verifiable record.') },
    { step: t('تكبر', 'You grow'),     body: t('حاضنة تأخذ فكرتك إلى نموذج عمل وخطة مكتوبة.', 'An incubator that takes your idea to a business model and a written plan.') },
  ];

  return (
    <main className="landing">
      <SiteNav />

      <section className="hero">
        <p className="kicker">One Account · One TechMood ID · Many Journeys</p>
        <h1>
          {t('منصة واحدة بين ', 'One platform between ')}
          <span className="accent-grad">{t('التعلّم والعمل', 'learning and working')}</span>
        </h1>
        <p>
          {t('معظم المنصات تعلّمك ثم تتركك. TechMood يكمل الطريق: تتعلّم، تبني، يُراجَع عملك، تنضم إلى فريق، تعمل، ثم تؤسّس — وكل خطوة تترك أثراً في سجلّ مهني واحد يمكن التحقّق منه.',
             'Most platforms teach you and then leave you there. TechMood carries on: you learn, you build, your work is reviewed, you join a team, you work, then you found something — and every step leaves a mark on one professional record anyone can verify.')}
        </p>
      </section>

      <section className="section-block">
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>{t('الرحلة', 'The journey')}</h2>
        <div className="card-grid">
          {loop.map((item) => (
            <article className="card" key={item.step}>
              <h3>{item.step}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>
          {t('المبادئ التي نبني عليها', 'The principles we build on')}
        </h2>
        <div className="card-grid">
          {principles.map((item) => (
            <article className="card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel section-block" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>
          {t('ابدأ من حيث أنت', 'Start where you are')}
        </h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>
          {t('كل حساب يبدأ طالباً. الأدوار الأخرى تُطلب متى احتجتها.',
             'Every account starts as a student. You ask for the other roles when you need them.')}
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/signup">{t('أنشئ حسابك', 'Create your account')}</Link>
          <Link className="btn btn-ghost" href="/verify">{t('تحقّق من شهادة', 'Verify a certificate')}</Link>
        </div>
      </section>
    </main>
  );
}
