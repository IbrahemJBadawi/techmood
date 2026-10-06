import Link from 'next/link';
import QRCode from 'qrcode';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { siteOrigin } from '@/lib/site';

import { AppInstall } from './AppInstall';

export const generateMetadata = localizedTitle(
  'TechMood على جوالك',
  'TechMood on your phone',
  {
    ar: 'ثبّت تطبيق TechMood من المتصفح مباشرة على Android وiPhone والكمبيوتر — بلا متجر، خفيف، ويتحدّث وحده.',
    en: 'Install the TechMood app straight from the browser on Android, iPhone and desktop — no store, light, and it updates itself.',
  },
  '/app',
);

/**
 * The app's «store page» (PWA). TechMood installs from the browser itself, so
 * this page is what we share instead of a store link: it shows the one-tap
 * install where the browser offers it, the two taps on iPhone, and a QR code
 * for a visitor on a computer to open it on their phone.
 */
export default async function AppPage() {
  const t = await getT();
  // The address the visitor is on, so the code works on whichever domain serves the site.
  const qr = await QRCode.toDataURL(`${await siteOrigin()}/app`, { margin: 1, width: 280 });

  const features = [
    { icon: '🔔', title: t('إشعارات على الجوال', 'Phone notifications'), body: t('رسائلك، جلساتك، مراجعة تسليماتك، وتذكير يومي بحماستك — حتى والتطبيق مغلق.', 'Your messages, sessions, reviews of your work and a daily streak reminder — even with the app closed.') },
    { icon: '📱', title: t('شاشة كاملة', 'Full screen'), body: t('يفتح من أيقونته على الشاشة الرئيسية بلا شريط المتصفح، بشريط تبويبات سفلي مثل أي تطبيق.', 'Opens from its icon on the home screen without the browser bar, with a bottom tab bar like any app.') },
    { icon: '⚡', title: t('خفيف جداً', 'Very light'), body: t('أقل من 1 ميغابايت على جهازك، لا يستهلك مساحة ولا ذاكرة.', 'Under 1 MB on your device; it takes no real space or memory.') },
    { icon: '🔄', title: t('يتحدّث وحده', 'Updates itself'), body: t('كل ميزة جديدة تصلك فوراً، بلا تحديثات ولا انتظار متجر.', 'Every new feature reaches you at once — no updates to install, no store to wait for.') },
    { icon: '🔒', title: t('نفس حسابك ونفس الأمان', 'Same account, same security'), body: t('هو موقع TechMood الرسمي نفسه على techmoodtech.com، بنفس الحساب والبيانات.', 'It is the official TechMood site itself, on techmoodtech.com, with the same account and data.') },
    { icon: '🌐', title: t('كل الأجهزة', 'Every device'), body: t('Android وiPhone وiPad والكمبيوتر — تبدأ على جهاز وتكمل على آخر.', 'Android, iPhone, iPad and computers — start on one, carry on on another.') },
  ];

  const questions = [
    { q: t('لماذا ليس في المتجر؟', 'Why is it not in a store?'), a: t('لأنه لا يحتاج متجراً: المتصفح يثبّته مباشرة من الموقع الرسمي، وهكذا تصلك التحديثات فوراً. نسخ المتاجر قادمة لاحقاً.', 'Because it does not need one: the browser installs it straight from the official site, so updates reach you at once. Store versions will come later.') },
    { q: t('هل يعمل على iPhone؟', 'Does it work on iPhone?'), a: t('نعم، من Safari. الإشعارات تعمل على iOS 16.4 فما فوق بعد تثبيته على الشاشة الرئيسية وفتحه منها.', 'Yes, from Safari. Notifications work on iOS 16.4 and later once it is on the home screen and opened from there.') },
    { q: t('ظهر لي «إنشاء اختصار» بدل «تثبيت»؟', 'I see “Create shortcut” instead of “Install”?'), a: t('في Chrome على Android اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية ← تثبيت». إن لم يظهر، حدّث Chrome أو افتح الصفحة في Chrome بدل متصفح تطبيق آخر (مثل فيسبوك أو إنستغرام).', 'In Chrome on Android choose “Install app” or “Add to Home screen → Install”. If it is missing, update Chrome or open this page in Chrome rather than inside another app (like Facebook or Instagram).') },
    { q: t('كيف أحذفه؟', 'How do I remove it?'), a: t('مثل أي تطبيق: اضغط مطوّلاً على أيقونته ثم «إزالة». حسابك وبياناتك لا تتأثر.', 'Like any app: long-press its icon, then “Remove”. Your account and data are not affected.') },
  ];

  return (
    <>
      <SiteNav />
      <main className="landing app-page">
        <section className="hero">
          <p className="kicker">TechMood App · Android · iPhone · Desktop</p>
          <h1>
            {t('TechMood ', 'TechMood ')}
            <span className="accent-grad">{t('على جوالك', 'on your phone')}</span>
          </h1>
          <p>
            {t('ثبّته من المتصفح مباشرة بضغطة — بلا متجر، بلا تحميل كبير، ويفتح كتطبيق كامل بإشعاراته.',
               'Install it straight from the browser in one tap — no store, no big download, and it opens as a full app with its notifications.')}
          </p>
        </section>

        <AppInstall qr={qr} />

        <section className="section-block">
          <h2 className="app-h2">{t('ماذا تحصل', 'What you get')}</h2>
          <div className="card-grid">
            {features.map((item) => (
              <article className="card" key={item.title}>
                <h3><span aria-hidden="true">{item.icon}</span> {item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <h2 className="app-h2">{t('أسئلة سريعة', 'Quick questions')}</h2>
          <div className="app-faq">
            {questions.map((item) => (
              <details className="panel" key={item.q}>
                <summary>{item.q}</summary>
                <p className="muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="panel section-block" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('ليس لديك حساب بعد؟', 'No account yet?')}</h2>
          <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>
            {t('أنشئ حسابك مجاناً ثم ثبّت التطبيق — أو بالعكس.', 'Create your free account, then install the app — or the other way round.')}
          </p>
          <div className="cta-row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" href="/signup">{t('أنشئ حسابك', 'Create your account')}</Link>
            <Link className="btn btn-ghost" href="/login">{t('تسجيل الدخول', 'Sign in')}</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
