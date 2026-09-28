import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { Icon } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LogoMark } from '@/components/Logo';
import type { IconName } from '@/lib/roles';

import { SiteMenu } from './SiteMenu';

/**
 * The public header.
 *
 * One bar that fits the screen it is on: the full set of links on a desktop,
 * and on a tablet or a phone only the brand, the one button that matters
 * (create an account) and a menu that holds everything else. Academy, Mentors
 * and the Market ask a signed-out visitor to sign in and then take them there.
 */
export async function SiteNav() {
  const t = await getT();

  const links: { href: string; label: string; icon: IconName }[] = [
    { href: '/academy', label: t('الأكاديمية', 'Academy'), icon: 'academy' },
    { href: '/mentors', label: t('المنتورز', 'Mentors'), icon: 'mentor' },
    { href: '/exhibition', label: t('المعرض', 'Gallery'), icon: 'gallery' },
    { href: '/marketplace', label: t('السوق', 'Market'), icon: 'work' },
    { href: '/about', label: t('عن TechMood', 'About'), icon: 'review' },
  ];

  return (
    <header className="site-header">
      <nav className="site-header-inner" aria-label={t('روابط الموقع', 'Site links')}>
        <Link className="site-brand" href="/">
          <LogoMark size={30} />
          <span>TechMood</span>
        </Link>

        <ul className="site-links">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>

        <div className="site-actions">
          <span className="site-lang"><LanguagePicker current={t.locale} /></span>
          <Link className="btn btn-ghost btn-sm site-login" href="/login">{t('تسجيل الدخول', 'Sign in')}</Link>
          <Link className="btn btn-primary btn-sm" href="/signup">{t('ابدأ مجاناً', 'Start free')}</Link>
          <SiteMenu openLabel={t('افتح القائمة', 'Open the menu')} closeLabel={t('أغلق القائمة', 'Close the menu')}>
            <ul className="site-menu-links">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="site-menu-icon"><Icon name={link.icon} size={20} /></span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="site-menu-foot">
              <LanguagePicker current={t.locale} />
              <Link className="btn btn-ghost btn-block" href="/login">{t('تسجيل الدخول', 'Sign in')}</Link>
              <Link className="btn btn-primary btn-block" href="/signup">{t('أنشئ حسابك مجاناً', 'Create your free account')}</Link>
            </div>
          </SiteMenu>
        </div>
      </nav>
    </header>
  );
}

/** The public footer: where everything is, once, on every public page. */
export async function SiteFooter() {
  const t = await getT();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t('المنصة', 'Platform'),
      links: [
        { href: '/academy', label: t('الأكاديمية', 'Academy') },
        { href: '/mentors', label: t('المنتورز', 'Mentors') },
        { href: '/teams', label: t('الفرق', 'Teams') },
        { href: '/exhibition', label: t('المعرض', 'Gallery') },
        { href: '/marketplace', label: t('سوق الطلاب', 'Student market') },
      ],
    },
    {
      title: t('للأعضاء', 'Members'),
      links: [
        { href: '/signup', label: t('أنشئ حساباً', 'Create an account') },
        { href: '/login', label: t('تسجيل الدخول', 'Sign in') },
        { href: '/verify', label: t('تحقّق من شهادة', 'Verify a certificate') },
        { href: '/support', label: t('المساعدة والبلاغات', 'Help & reports') },
      ],
    },
    {
      title: 'TechMood',
      links: [
        { href: '/about', label: t('عن TechMood', 'About TechMood') },
        { href: '/guide', label: t('دليل التقييمات والمستويات', 'Ratings & levels guide') },
      ],
    },
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link className="site-brand" href="/">
            <LogoMark size={30} />
            <span>TechMood</span>
          </Link>
          <p>
            {t('منصة عربية تجمع التعلّم والإرشاد والعمل الجماعي في هوية مهنية واحدة قابلة للتحقق.',
               'An Arabic-first platform bringing learning, mentoring and teamwork into one verifiable professional identity.')}
          </p>
          <LanguagePicker current={t.locale} />
        </div>

        {columns.map((column) => (
          <nav className="site-footer-col" key={column.title} aria-label={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="site-footer-bottom">
        <span>© <span className="eng">{year}</span> TechMood Technology</span>
        <span>{t('العربية أولاً، والإنجليزية دائماً', 'Arabic first, English always')}</span>
      </div>
    </footer>
  );
}
