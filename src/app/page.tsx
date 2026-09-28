import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { IconName } from '@/lib/roles';

/**
 * The front door.
 *
 * It says what TechMood is in one line, shows the product instead of
 * describing it (the preview beside the headline is built from the same
 * interface pieces the app uses — no screenshots to go stale), and then
 * answers a visitor's questions in the order they have them: how does it
 * work, is it for me, what is inside, can I trust it, what does it cost.
 * Nothing on this page is a number or a quote we did not measure or receive.
 */
export default async function LandingPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect('/home');

  const steps: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'academy',
      title: t('تعلّم', 'Learn'),
      body: t('مسار واضح بدروس قصيرة، وتقدّم تراه كل يوم.', 'A clear path in short lessons, and progress you see every day.'),
    },
    {
      icon: 'work',
      title: t('ابنِ', 'Build'),
      body: t('كل دورة تنتهي بمشروع حقيقي، وحدك أو مع فريق.', 'Every course ends in a real project, on your own or with a team.'),
    },
    {
      icon: 'mentor',
      title: t('راجِع مع منتور', 'Get reviewed'),
      body: t('منتور يراجع عملك في جلسة محجوزة ويقيّمه بصدق.', 'A mentor reviews your work in a booked session and rates it honestly.'),
    },
    {
      icon: 'certificate',
      title: t('أثبِت واكسب', 'Prove & earn'),
      body: t('شهادة قابلة للتحقق، ومشروع في المعرض، وبيع في سوق الطلاب.', 'A verifiable certificate, a project in the gallery, and a sale in the student market.'),
    },
  ];

  const roles: { key: string; icon: IconName; title: string; body: string; points: string[] }[] = [
    {
      key: 'student',
      icon: 'academy',
      title: t('طالب', 'Student'),
      body: t('تتعلّم من الصفر أو تكمل طريقك.', 'Starting from zero or carrying on.'),
      points: [
        t('مسارات ودورات مبنية على التطبيق', 'Paths and courses built on practice'),
        t('XP وسلسلة أيام ولوحات صدارة', 'XP, streaks and leaderboards'),
        t('مشاريع مع فرق وشهادات موثّقة', 'Team projects and verified certificates'),
      ],
    },
    {
      key: 'mentee',
      icon: 'passport',
      title: 'Mentee',
      body: t('تعمل أو تبحث عن عمل وتريد من يرافقك.', 'Working or job-hunting, and want someone in your corner.'),
      points: [
        t('أهداف مهنية تتابعها مع منتور', 'Career goals you track with a mentor'),
        t('جلسات مراجعة لأعمالك وسيرتك', 'Review sessions for your work and CV'),
        t('ملف مهني وجواز قابل للمشاركة', 'A shareable professional passport'),
      ],
    },
    {
      key: 'mentor',
      icon: 'mentor',
      title: t('منتور', 'Mentor'),
      body: t('خبير يريد أن يعلّم ويكسب من خبرته.', 'An expert who wants to teach and earn from it.'),
      points: [
        t('تحدّد أوقاتك وأسعار جلساتك', 'Set your own hours and session prices'),
        t('مستويات تُكسب بالجلسات والتقييم', 'Levels earned through sessions and ratings'),
        t('أرباحك في محفظتك وتسحبها محلياً', 'Earnings in your wallet, withdrawn locally'),
      ],
    },
  ];

  const faqs = [
    {
      q: t('هل التسجيل مجاني؟', 'Is signing up free?'),
      a: t('نعم. إنشاء الحساب والتعلّم في الأكاديمية والانضمام للفرق مجاني. تدفع فقط عندما تحجز جلسة مع منتور أو تشتري مشروعاً من السوق.',
           'Yes. Creating an account, learning in the academy and joining teams are free. You pay only when you book a mentor session or buy a project from the market.'),
    },
    {
      q: t('كيف أدفع ثمن جلسة؟', 'How do I pay for a session?'),
      a: t('تحوّل المبلغ إلى حساب TechMood في بنك فلسطين وترفع الإيصال. يراجعه فريقنا فتتأكّد الجلسة، وإن اعتذر المنتور يُعاد إليك المبلغ كاملاً.',
           'You transfer the amount to TechMood’s Bank of Palestine account and upload the receipt. Our team checks it and the session is confirmed; if the mentor declines, you get it all back.'),
    },
    {
      q: t('كيف تتم الجلسة؟', 'How does a session happen?'),
      a: t('المنتور يضع رابط اجتماع (Zoom أو Google Meet) في صفحة الحجز، ويظهر لك زر الانضمام قبل الموعد بعشر دقائق.',
           'The mentor puts a meeting link (Zoom or Google Meet) on the booking page, and your Join button appears ten minutes before the time.'),
    },
    {
      q: t('كيف يتحقق أحد من شهادتي؟', 'How can someone check my certificate?'),
      a: t('كل شهادة تحمل رقماً ورمز QR يفتح صفحة تحقق عامة، ولا تُصدر إلا بعد أن يراجع منتور عملك ويعتمده.',
           'Every certificate carries a number and a QR code that opens a public verification page, and it is issued only after a mentor has reviewed and approved your work.'),
    },
    {
      q: t('كيف يستلم المنتور أرباحه؟', 'How do mentors get paid?'),
      a: t('تُجمع الأرباح في المحفظة، ويسحبها المنتور إلى حسابه البنكي أو محفظة PalPay أو Jawwal Pay.',
           'Earnings collect in the wallet, and the mentor withdraws them to a bank account, a PalPay wallet or a Jawwal Pay wallet.'),
    },
  ];

  const week = t.locale === 'ar' ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['S', 'S', 'M', 'T', 'W', 'T', 'F'];

  return (
    <>
      <SiteNav />

      <main className="home">
        {/* ---------------------------------------------------------- hero */}
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-pill">
              <span className="home-pill-dot" />
              {t('منصة عربية للتعلّم والإرشاد والعمل', 'Arabic-first: learn, get mentored, work')}
            </p>
            <h1>
              {t('من أول درس', 'From your first lesson')}
              <br />
              <span className="accent-grad">{t('إلى أول عمل حقيقي', 'to your first real work')}</span>
            </h1>
            <p className="home-lead">
              {t('تعلّم بمسارات قصيرة، ابنِ مشاريع مع فريق، واحجز جلسة مع منتور يراجع عملك — وكل ما تنجزه يُسجَّل في هوية مهنية واحدة يمكن لأي أحد التحقق منها.',
                 'Learn in short paths, build projects with a team, and book a mentor who reviews your work — and everything you do lands in one professional identity anyone can verify.')}
            </p>
            <div className="home-cta">
              <Link className="btn btn-primary btn-lg" href="/signup">{t('ابدأ مجاناً', 'Start free')}</Link>
              <Link className="btn btn-ghost btn-lg" href="/mentors">{t('تصفّح المنتورز', 'Browse mentors')}</Link>
            </div>
            <ul className="home-trust">
              <li><Icon name="check" size={16} />{t('التسجيل مجاني', 'Free to join')}</li>
              <li><Icon name="check" size={16} />{t('شهادات قابلة للتحقق', 'Verifiable certificates')}</li>
              <li><Icon name="check" size={16} />{t('دفع محلي عبر بنك فلسطين', 'Local payment via Bank of Palestine')}</li>
            </ul>
          </div>

          <div className="home-preview" aria-hidden="true">
            <div className="preview-card preview-lesson">
              <div className="preview-row">
                <span className="preview-chip preview-chip-streak">🔥 <span className="eng">7</span></span>
                <span className="preview-chip preview-chip-xp eng">+40 XP</span>
              </div>
              <p className="preview-kicker">{t('المسار الحالي', 'Current path')}</p>
              <p className="preview-title">{t('تطوير الويب — الوحدة 3', 'Web development — unit 3')}</p>
              <div className="progress-track"><div className="progress-fill" style={{ width: '64%' }} /></div>
              <div className="preview-path">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`preview-node${n < 4 ? ' is-done' : n === 4 ? ' is-now' : ''}`}>
                    {n < 4 ? <Icon name="check" size={14} /> : <span className="eng">{n}</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="preview-card preview-session">
              <span className="preview-avatar">{t('م', 'M')}</span>
              <div className="preview-session-copy">
                <p className="preview-title">{t('جلسة مراجعة مشروع', 'Project review session')}</p>
                <p className="preview-sub">{t('اليوم · 7:00 م · 60 دقيقة', 'Today · 7:00 pm · 60 min')}</p>
              </div>
              <span className="preview-join"><Icon name="play" size={14} />{t('انضم', 'Join')}</span>
            </div>

            <div className="preview-card preview-wallet">
              <p className="preview-kicker">{t('المحفظة', 'Wallet')}</p>
              <p className="preview-balance eng">$240.00</p>
              <div className="preview-row">
                <span className="preview-rail">{t('بنك فلسطين', 'Bank of Palestine')}</span>
                <span className="preview-rail">PalPay</span>
                <span className="preview-rail">Jawwal Pay</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- how */}
        <section className="home-section">
          <header className="home-head">
            <p className="kicker">{t('كيف تعمل', 'How it works')}</p>
            <h2>{t('أربع خطوات من الفكرة إلى الدليل', 'Four steps from idea to proof')}</h2>
          </header>
          <ol className="home-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="home-step-icon"><Icon name={step.icon} size={22} /></span>
                <span className="home-step-no eng">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------- roles */}
        <section className="home-section">
          <header className="home-head">
            <p className="kicker">{t('لمن TechMood؟', 'Who is it for?')}</p>
            <h2>{t('اختر الطريق الذي يشبهك', 'Pick the path that fits you')}</h2>
            <p>{t('حساب واحد، وتستطيع إضافة دور آخر لاحقاً متى شئت.', 'One account — you can add another role whenever you like.')}</p>
          </header>
          <div className="home-roles">
            {roles.map((role) => (
              <article className={`home-role home-role-${role.key}`} key={role.key}>
                <span className="home-role-icon"><Icon name={role.icon} size={24} /></span>
                <h3>{role.title}</h3>
                <p className="muted">{role.body}</p>
                <ul>
                  {role.points.map((point) => (
                    <li key={point}><Icon name="check" size={16} />{point}</li>
                  ))}
                </ul>
                <Link className="home-role-link" href="/signup">
                  {t('ابدأ كـ', 'Start as ')}{role.title}
                  <Icon name="arrow" size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- bento */}
        <section className="home-section">
          <header className="home-head">
            <p className="kicker">{t('داخل المنصة', 'Inside the platform')}</p>
            <h2>{t('كل ما تحتاجه في مكان واحد', 'Everything you need, in one place')}</h2>
          </header>
          <div className="bento">
            <article className="bento-tile bento-wide bento-academy">
              <Icon name="academy" size={26} />
              <h3>{t('أكاديمية تُكمل ما تبدأه', 'An academy you actually finish')}</h3>
              <p>{t('دروس قصيرة، تمارين، وسلسلة أيام تحفّزك للعودة كل يوم — وكل دورة تنتهي بمشروع يراجعه إنسان.',
                    'Short lessons, practice and a daily streak that brings you back — and every course ends in a project a person reviews.')}</p>
              <div className="bento-streak" aria-hidden="true">
                {week.map((day, index) => (
                  <span key={index} className={index < 5 ? 'is-on' : ''}>{day}</span>
                ))}
              </div>
            </article>
            <article className="bento-tile bento-mentor">
              <Icon name="calendar" size={26} />
              <h3>{t('منتورز وحجوزات', 'Mentors & bookings')}</h3>
              <p>{t('اختر المنتور والموعد المتاح وادفع — والجلسة برابط اجتماع خاص بها.', 'Pick a mentor and a free slot, pay — and the session gets its own meeting link.')}</p>
            </article>
            <article className="bento-tile bento-team">
              <Icon name="team" size={26} />
              <h3>{t('فرق ومهام', 'Teams & tasks')}</h3>
              <p>{t('لوحة مهام ومحادثة لكل فريق، ومشاريع تنتقل من الفكرة إلى التسليم.', 'A task board and chat for each team, with projects that go from idea to delivery.')}</p>
            </article>
            <article className="bento-tile bento-gallery">
              <Icon name="gallery" size={26} />
              <h3>{t('معرض وسوق', 'Gallery & market')}</h3>
              <p>{t('مشاريعك المقيّمة تُعرض للعالم، ويمكنك بيعها في سوق الطلاب.', 'Your rated projects go on show, and you can sell them in the student market.')}</p>
            </article>
            <article className="bento-tile bento-wallet">
              <Icon name="wallet" size={26} />
              <h3>{t('محفظة واضحة', 'A clear wallet')}</h3>
              <p>{t('كل دفعة بفاتورة، وكل ربح بسجل، والسحب إلى حسابك المحلي.', 'An invoice for every payment, a record for every earning, and withdrawals to your local account.')}</p>
            </article>
            <article className="bento-tile bento-passport">
              <Icon name="passport" size={26} />
              <h3>{t('جواز مهني', 'A professional passport')}</h3>
              <p>{t('XP ونجوم وشهادات ومشاريع في صفحة واحدة تشاركها برابط أو رمز QR.', 'XP, stars, certificates and projects on one page you share by link or QR code.')}</p>
            </article>
            <article className="bento-tile bento-wide bento-ai">
              <Icon name="assistant" size={26} />
              <h3>{t('مساعد ذكي يعرف رحلتك', 'An assistant that knows your journey')}</h3>
              <p>{t('يقترح الدرس التالي والمنتور المناسب ويشرح لك ما لم تفهمه — ولا يحجز أو يدفع أو يرسل باسمك أبداً.',
                    'Suggests your next lesson and the right mentor, explains what you did not get — and never books, pays or sends anything in your name.')}</p>
            </article>
          </div>
        </section>

        {/* ---------------------------------------------------------- trust */}
        <section className="home-section home-proof">
          <div className="home-proof-copy">
            <p className="kicker">{t('قابل للإثبات', 'Provable')}</p>
            <h2>{t('شهادة لا تُمنح بضغطة زر', 'A certificate no button can hand out')}</h2>
            <p>
              {t('تُصدر الشهادة فقط بعد أن يراجع منتور أعمالك المطلوبة ويعتمدها. وكل شهادة تحمل رقماً ورمز QR يفتح صفحة تحقق عامة — يراها صاحب العمل كما هي.',
                 'A certificate is issued only after a mentor has reviewed and approved the required work. Each one carries a number and a QR code that opens a public verification page — an employer sees it exactly as it is.')}
            </p>
            <Link className="btn btn-ghost" href="/verify">{t('تحقّق من شهادة', 'Verify a certificate')}</Link>
          </div>
          <div className="home-cert" aria-hidden="true">
            <span className="home-cert-seal"><Icon name="shield" size={28} /></span>
            <p className="home-cert-org eng">TECHMOOD</p>
            <p className="home-cert-title">{t('شهادة إتمام مسار', 'Path completion certificate')}</p>
            <div className="home-cert-lines"><span /><span /><span /></div>
            <div className="home-cert-foot">
              <span className="eng">TM-C-XXXXXXXX</span>
              <span className="home-cert-qr" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- faq */}
        <section className="home-section">
          <header className="home-head">
            <p className="kicker">{t('أسئلة شائعة', 'Questions')}</p>
            <h2>{t('قبل أن تبدأ', 'Before you start')}</h2>
          </header>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- cta */}
        <section className="home-band">
          <h2>{t('رحلتك تبدأ بحساب واحد', 'Your journey starts with one account')}</h2>
          <p>{t('مجاني، ويأخذ أقل من دقيقة.', 'Free, and it takes less than a minute.')}</p>
          <Link className="btn btn-lg home-band-btn" href="/signup">{t('أنشئ حسابك الآن', 'Create your account')}</Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
