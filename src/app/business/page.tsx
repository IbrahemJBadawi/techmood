import Link from 'next/link';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { CONTACT_EMAIL } from '@/lib/contact';

import { InquiryForm } from './InquiryForm';

export const generateMetadata = localizedTitle('TechMood للأعمال', 'TechMood for business', {
  ar: 'وظّف مواهب تقنية مُثبتة بالعمل، نفّذ مشاريع مع فرق طلاب يشرف عليها منتورز، ودرّب فريقك.',
  en: 'Hire tech talent proven by real work, have mentored student teams build projects, and train your staff.',
}, '/business');

/**
 * For business (design lab 4: «صفحة هبوط + تواصل»): what a company gets from
 * TechMood, the proof behind it, and a form that reaches the admins at once.
 */
export default async function BusinessPage() {
  const t = await getT();

  const offers = [
    { icon: '🧑‍💻', title: t('توظيف بثقة', 'Hire with confidence'),
      body: t('كل مرشّح له سجلّ عمل حقيقي: مشاريع قيّمها منتورز، شهادات قابلة للتحقق، ومهارات مثبتة بالأدلة.', 'Every candidate has a real record: projects reviewed by mentors, verifiable certificates and skills backed by evidence.') },
    { icon: '🚀', title: t('مشاريع مع فرق', 'Projects with teams'),
      body: t('فريق طلاب بقائد ومنتور يبني لكم نموذجاً أو منتجاً، بمهام وتسليمات واضحة ودفع محفوظ حتى الاستلام.', 'A student team with a lead and a mentor builds your prototype or product, with clear tasks, deliverables and payment held until delivery.') },
    { icon: '🎓', title: t('تدريب موظفيكم', 'Train your staff'),
      body: t('مسارات الأكاديمية وجلسات المنتورز لفريقكم، مع تقارير تقدّم وشهادات لكل من يُكمل.', 'Academy paths and mentor sessions for your team, with progress reports and a certificate for everyone who completes.') },
    { icon: '🏆', title: t('رعاية التحدّيات والورش', 'Sponsor challenges and workshops'),
      body: t('ضعوا تحدّياً حقيقياً من عملكم أمام المواهب، أو ارعوا ورشة مباشرة باسم شركتكم.', 'Put a real challenge from your business in front of the talent, or sponsor a live workshop in your name.') },
  ];
  const steps = [
    t('تخبروننا بما تحتاجونه', 'You tell us what you need'),
    t('نقترح المواهب أو الفريق والمدة والتكلفة', 'We propose the talent or team, the timeline and the cost'),
    t('يبدأ العمل بمنتور يتابعه', 'Work starts, followed by a mentor'),
    t('تستلمون، ثم يُفرَج عن الدفع', 'You receive it, then the payment is released'),
  ];

  return (
    <>
      <SiteNav />
      <main className="landing biz-page">
        <section className="biz-hero">
          <p className="kicker">TechMood for Business</p>
          <h1>{t('مواهب تقنية ', 'Tech talent ')}<span className="accent-grad">{t('مُثبتة بالعمل', 'proven by work')}</span></h1>
          <p>{t('من غزة وفلسطين إلى فريقكم: طلاب وخريجون تعلّموا ببناء مشاريع حقيقية راجعها منتورز — ويمكنكم رؤية الدليل قبل أي قرار.',
                'From Gaza and Palestine to your team: students and graduates who learned by building real projects reviewed by mentors — and you can see the proof before any decision.')}</p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#contact">{t('تواصل معنا', 'Contact us')}</a>
            <Link className="btn btn-ghost" href="/exhibition">{t('شاهد أعمالهم في المعرض', 'See their work in the gallery')}</Link>
          </div>
        </section>

        <section className="section-block">
          <div className="biz-offers">
            {offers.map((offer) => (
              <article className="biz-offer" key={offer.title}>
                <span className="biz-icon" aria-hidden>{offer.icon}</span>
                <h3>{offer.title}</h3>
                <p>{offer.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block biz-steps-wrap">
          <h2>{t('كيف نعمل معكم', 'How we work with you')}</h2>
          <ol className="biz-steps">
            {steps.map((step, index) => (
              <li key={step}><span className="eng">{index + 1}</span>{step}</li>
            ))}
          </ol>
        </section>

        <section className="panel section-block biz-contact" id="contact">
          <h2>{t('تواصل معنا', 'Contact us')}</h2>
          <p className="muted">{t('اكتبوا لنا ما تحتاجونه، ويرد عليكم فريق TechMood مباشرة.', 'Write what you need, and the TechMood team gets back to you directly.')}</p>
          <InquiryForm />
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 12 }}>
            {t('أو راسلونا مباشرة على ', 'Or write to us directly at ')}<a className="eng" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
