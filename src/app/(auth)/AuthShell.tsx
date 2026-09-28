import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getT } from '@/lib/i18n.server';

/**
 * Sign-in and sign-up share one frame: on a wide screen, what TechMood is
 * beside the form; on a phone, the form alone. The theme and the language
 * can be changed before anybody has an account.
 */
export async function AuthShell({
  variant,
  title,
  lede,
  footer,
  children,
}: {
  variant: 'login' | 'signup';
  title: string;
  lede: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getT();

  const points = [
    { icon: 'academy' as const, text: t('مسارات قصيرة تتعلّم فيها بالممارسة', 'Short paths where you learn by doing') },
    { icon: 'mentor' as const, text: t('منتور يراجع عملك، وجلسات إرشاد تحجزها', 'A mentor reviews your work; sessions you can book') },
    { icon: 'passport' as const, text: t('جواز مهني وشهادات يمكن لأي أحد التحقق منها', 'A professional passport and certificates anyone can verify') },
  ];

  const steps = [
    t('أنشئ الحساب', 'Create the account'),
    t('صورتك واهتماماتك', 'Your photo and interests'),
    t('ابدأ أول مسار', 'Start your first path'),
  ];

  return (
    <div className="au-page">
      <aside className="au-brand" aria-label={t('عن TechMood', 'About TechMood')}>
        <Link href="/" className="au-brand-logo"><LogoMark /> TechMood</Link>
        <div className="au-brand-body">
          <h2>{t('من أول درس', 'From your first lesson')}<br /><span>{t('إلى أول عمل حقيقي', 'to your first real work')}</span></h2>
          {variant === 'signup' ? (
            <ol className="au-steps">
              {steps.map((step, index) => (
                <li key={step}><span>{index + 1}</span>{step}</li>
              ))}
            </ol>
          ) : (
            <ul className="au-points">
              {points.map((point) => (
                <li key={point.text}><span><Icon name={point.icon} size={18} /></span>{point.text}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="au-brand-card" aria-hidden="true">
          <span className="au-brand-pill">🔥 7</span>
          <span className="au-brand-pill is-xp">+40 XP</span>
          <strong>{t('تطوير الويب — الوحدة 3', 'Web development — unit 3')}</strong>
          <span className="au-brand-track"><span /></span>
        </div>
      </aside>

      <main className="au-main">
        <header className="au-head">
          <Link href="/" className="au-head-logo"><LogoMark /> TechMood</Link>
          <div className="au-head-tools">
            <ThemeToggle />
            <LanguagePicker current={t.locale} />
          </div>
        </header>

        <div className="au-body">
          <h1>{title}</h1>
          <p className="au-lede">{lede}</p>
          {children}
          <p className="au-foot">{footer}</p>
        </div>
      </main>
    </div>
  );
}
