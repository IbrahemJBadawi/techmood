import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { LanguagePicker } from './LanguagePicker';

/**
 * The public navigation.
 *
 * Academy, Mentors, Teams, Work and Startups are the platform itself, so a
 * signed-out visitor who opens one is asked to sign in and is then taken there —
 * the link is real, and nothing here is a dead end.
 */
export async function SiteNav() {
  const t = await getT();

  const links = [
    { href: '/', label: t('الرئيسية', 'Home') },
    { href: '/academy', label: t('الأكاديمية', 'Academy') },
    { href: '/mentors', label: t('المنتورز', 'Mentors') },
    { href: '/teams', label: t('الفرق', 'Teams') },
    { href: '/marketplace', label: t('سوق العمل', 'Work') },
    { href: '/startups', label: t('الشركات الناشئة', 'Startups') },
    { href: '/about', label: t('عن TechMood', 'About') },
  ];

  return (
    <nav className="landing-nav" aria-label={t('روابط الموقع', 'Site links')}>
      <Link className="site-brand" href="/">
        <span className="logo-mark" />
        TechMood
      </Link>

      <ul className="site-links">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>

      <div className="site-actions">
        <LanguagePicker current={t.locale} />
        <Link className="btn btn-ghost btn-sm" href="/login">{t('تسجيل الدخول', 'Sign in')}</Link>
        <Link className="btn btn-primary btn-sm" href="/signup">{t('أنشئ حسابك', 'Create account')}</Link>
      </div>
    </nav>
  );
}
