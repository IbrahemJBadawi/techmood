import Link from 'next/link';

import { SiteFooter, SiteNav } from '@/components/SiteNav';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

export const generateMetadata = localizedTitle('السياسات والشروط — TechMood', 'Policies and terms — TechMood');

/**
 * TechMood's policies in one page, each section linkable (#terms, #privacy,
 * #market, #sessions, #community, #payments). Every number that a rule in the
 * database decides is read from platform_settings, so the page and the
 * platform cannot disagree; an admin changing a setting changes the page.
 */
export default async function PoliciesPage() {
  const t = await getT();
  const supabase = await createClient();
  const [{ data: settings }, { data: tiers }] = await Promise.all([
    supabase.from('platform_settings').select('key, value'),
    supabase.from('commission_tiers').select('kind, min_amount_usd, rate_percent').eq('kind', 'project_sale').order('min_amount_usd'),
  ]);
  const get = (key: string, fallback: string) => settings?.find((row) => row.key === key)?.value ?? fallback;

  const minPct = get('offer_min_pct', '50');
  const hours = get('offer_hours', '72');
  const perBuyer = get('offers_per_buyer', '3');
  const version = get('market_terms_version', '1');
  const saleCommission = tiers?.[0]?.rate_percent ?? 15;
  const instantPct = get('instant_booking_surcharge_pct', '50');
  const responseHours = get('mentor_response_hours', '48');

  const sections: { id: string; title: string; items: string[] }[] = [
    {
      id: 'terms',
      title: t('شروط الاستخدام', 'Terms of use'),
      items: [
        t('TechMood منصة تعلّم وعمل: أكاديمية، منتورز، فرق، معرض وسوق. باستخدامك لها توافق على هذه الشروط.', 'TechMood is a platform for learning and work: an academy, mentors, teams, a gallery and a market. Using it means you accept these terms.'),
        t('حساب واحد لكل شخص، باسمك الحقيقي. أنت مسؤول عمّا يُنشر من حسابك.', 'One account per person, in your real name. You are responsible for what your account publishes.'),
        t('لا تنشر عمل غيرك على أنه عملك، ولا محتوى مخالفاً للقانون أو مسيئاً أو يحتوي بيانات أشخاص دون إذنهم.', 'Do not publish someone else’s work as yours, nor anything unlawful, abusive, or containing people’s data without their consent.'),
        t('لـTechMood أن تخفي محتوى أو توقف ميزة عن حساب يخالف الشروط، مع ذكر السبب، ولك أن تعترض عبر الدعم.', 'TechMood may hide content or restrict a feature for an account that breaks these terms, with the reason given; you may appeal through Support.'),
      ],
    },
    {
      id: 'privacy',
      title: t('الخصوصية', 'Privacy'),
      items: [
        t('نجمع ما يلزم لتشغيل المنصة فقط: حسابك، تعلّمك، أعمالك، حجوزاتك ومدفوعاتك.', 'We collect only what running the platform needs: your account, learning, work, bookings and payments.'),
        t('صورتك واسمك ومعرّفك وملفك العام ظاهرة لأعضاء TechMood. بيانات الدفع وإيصالاتك لا يراها إلا أنت والإدارة.', 'Your photo, name, ID and public profile are visible to TechMood members. Payment details and receipts are seen only by you and TechMood.'),
        t('لا نبيع بياناتك، ولا نشاركها إلا حين يلزم القانون.', 'We never sell your data, and share it only where the law requires.'),
        t('تستطيع طلب نسخة من بياناتك أو حذف حسابك من الإعدادات أو الدعم.', 'You can ask for a copy of your data or delete your account from Settings or Support.'),
      ],
    },
    {
      id: 'market',
      title: t('شروط البيع والشراء والمفاصلة (السوق)', 'Buying, selling and negotiation (the market)'),
      items: [
        t('البائع: تعرض عملاً من إنجازك وتملك حق بيعه. كل عرض تراجعه TechMood قبل ظهوره — ومنه رابط التسليم. العرض المرفوض يُسجَّل تنبيهاً على حسابك.', 'Sellers: you list work you made and have the right to sell. TechMood checks every listing — including its delivery link — before it shows. A refused listing is recorded as a warning on your account.'),
        t('«حق استخدام» يُباع لأكثر من مشترٍ؛ «نقل كامل» يُباع مرة واحدة ولا يعيد البائع بيعه. البيع ينقل العمل، لا نسبته: يبقى في سجلّ من بناه.', '“Usage rights” sell to many buyers; a “full transfer” sells once and the seller does not sell it again. A sale moves the work, never the authorship: it stays on its maker’s record.'),
        t('الدفع: يُحتجز المبلغ لدى TechMood. يصل رابط التسليم للمشتري بعد تأكيد الدفع، ولا يُصرف للبائع إلا بعد أن يستلم المشتري ويُفرج عنه.', 'Payment: TechMood holds the money. The buyer receives the delivery link once the payment is confirmed; the seller is paid only after the buyer receives it and releases the money.'),
        t(`عمولة TechMood على البيع ${saleCommission}% من المبلغ.`, `TechMood’s commission on a sale is ${saleCommission}% of the amount.`),
        t(`المفاصلة: على المشاريع «القابلة للتفاوض» فقط. العرض لا يقل عن ${minPct}% من السعر، ولكل مشترٍ ${perBuyer} عروض كحد أقصى على المشروع نفسه، وعرض واحد مفتوح في كل مرة.`, `Negotiation: only on “negotiable” listings. An offer is at least ${minPct}% of the price; each buyer makes at most ${perBuyer} offers on one listing, one open at a time.`),
        t(`يردّ البائع خلال ${hours} ساعة: يقبل أو يعتذر أو يقترح سعراً مقابلاً مرة واحدة، ويردّ المشتري على السعر المقابل خلال ${hours} ساعة. السعر المتفق عليه محجوز للمشتري ${hours} ساعة ليدفع.`, `The seller answers within ${hours} hours: accept, decline, or counter once; the buyer answers a counter within ${hours} hours. An agreed price is held for the buyer for ${hours} hours to pay.`),
        t('الخدمات: بعد تأكيد الدفع تُفتح محادثة بين المشتري ومقدّم الخدمة لتنفيذها، بلا روابط ولا وسائل تواصل خارجية، وتُغلق عند انتهاء الطلب.', 'Services: once the payment is confirmed a conversation opens between the buyer and the provider, without links or outside contacts, and closes when the order ends.'),
        t('النزاع: إن لم يطابق ما استلمته العرض، افتح نزاعاً قبل الإفراج عن المبلغ؛ تراجعه TechMood وقد تعيد المبلغ.', 'Disputes: if what you received does not match the listing, open a dispute before releasing the money; TechMood reviews it and may refund you.'),
        t('التقييم: يقيّم المشتري ما اشتراه مرة واحدة بعد الإفراج، ويظهر تقييمه على صفحة المشروع.', 'Ratings: a buyer rates a purchase once, after releasing the money; the rating shows on the project page.'),
        t('ممنوع: نقل الصفقة خارج المنصة، أو الاتفاق على دفع خارجها، أو بيع عمل منسوخ. ذلك يوقف البيع على الحساب.', 'Not allowed: moving a deal off the platform, agreeing to pay outside it, or selling copied work. Doing so stops selling on the account.'),
        t(`إصدار هذه الشروط: ${version}. يوافق عليها البائع عند العرض والمشتري عند الشراء أو تقديم عرض سعر.`, `Version of these terms: ${version}. Sellers accept them when listing, buyers when buying or making an offer.`),
      ],
    },
    {
      id: 'sessions',
      title: t('جلسات المنتورز', 'Mentor sessions'),
      items: [
        t('يحدد المنتور سعره ضمن نطاق مستواه. يُحتجز المبلغ لدى TechMood ولا يصل للمنتور إلا بعد الجلسة.', 'A mentor sets their price within their level’s range. TechMood holds the money and pays the mentor only after the session.'),
        t(`يردّ المنتور على طلب مدفوع خلال ${responseHours} ساعة، وإلا يُلغى الطلب ويُعاد لك المبلغ.`, `A mentor answers a paid request within ${responseHours} hours, or it is cancelled and refunded.`),
        t(`الحجز الفوري (أقرب موعد خلال ٢٤ ساعة دون مهلة الحجز المعتادة) بزيادة ${instantPct}% على السعر.`, `Instant booking (the nearest slot within 24 hours, without the usual notice) costs ${instantPct}% more.`),
        t('إن غاب المنتور عن الجلسة يُعاد لك المبلغ كاملاً.', 'If the mentor misses the session, you are refunded in full.'),
        t('إن غاب الطالب تُمنح فرصة واحدة لإعادة جدولة الجلسة دون استرداد المبلغ؛ وإن تكرّر الغياب تُحتسب الجلسة.', 'If the learner misses it, they get one chance to reschedule, without a refund; a second absence counts the session as held.'),
      ],
    },
    {
      id: 'community',
      title: t('قواعد المجتمع', 'Community rules'),
      items: [
        t('احترم الجميع. لا إساءة ولا تحرّش ولا تمييز.', 'Respect everyone. No abuse, harassment or discrimination.'),
        t('لا روابط ولا وسائل تواصل خارجية في الرسائل والتعليقات؛ شارك العمل كتسليم أو صفحة مشروع.', 'No links or outside contacts in messages and comments; share work as a hand-in or a project page.'),
        t('أبلغ عن أي إساءة من زر «أبلغ» أو من الدعم، وتراجعها TechMood.', 'Report abuse with the “Report” button or through Support; TechMood reviews it.'),
      ],
    },
    {
      id: 'payments',
      title: t('الدفع والاسترداد', 'Payments and refunds'),
      items: [
        t('تدفع بإحدى طرق الدفع المعروضة وترفع الإيصال، وتتأكد TechMood منه.', 'You pay with one of the listed methods and upload the receipt; TechMood confirms it.'),
        t('المبلغ المستحق إعادته يظهر لك في الإشعارات ويُحوَّل بالطريقة التي دفعت بها أو إلى محفظتك.', 'Money owed back is shown in your notifications and returned by the method you paid with or to your wallet.'),
        t('أرباحك تظهر في المحفظة، وتسحبها عند بلوغ الحد الأدنى للسحب.', 'Your earnings show in your wallet; withdraw them once they reach the minimum.'),
      ],
    },
  ];

  return (
    <>
      <SiteNav />
      <main className="landing policies">
        <section style={{ padding: '36px 0 12px' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)' }}>{t('السياسات والشروط', 'Policies and terms')}</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: '68ch' }}>
            {t('قواعد TechMood بوضوح. الأرقام هنا تُقرأ من إعدادات المنصة نفسها.', 'TechMood’s rules, plainly. The numbers here are read from the platform’s own settings.')}
          </p>
          <nav className="tags-row" style={{ marginTop: 12 }} aria-label={t('أقسام السياسات', 'Policy sections')}>
            {sections.map((section) => <a key={section.id} className="chip" href={`#${section.id}`}>{section.title}</a>)}
          </nav>
        </section>
        {sections.map((section) => (
          <section className="panel section-block policy-section" id={section.id} key={section.id}>
            <h2>{section.title}</h2>
            <ul>{section.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </section>
        ))}
        <p className="muted" style={{ fontSize: '0.84rem', margin: '18px 0 40px' }}>
          {t('سؤال عن سياسة؟ ', 'A question about a policy? ')}<Link href="/support">{t('تواصل مع الدعم', 'Contact Support')}</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
