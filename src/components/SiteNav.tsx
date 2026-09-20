import Link from 'next/link';

/**
 * The public navigation.
 *
 * Academy, Mentors, Teams, Work and Startups are the platform itself, so a
 * signed-out visitor who opens one is asked to sign in and is then taken there —
 * the link is real, and nothing here is a dead end.
 */
const LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/academy', label: 'الأكاديمية' },
  { href: '/mentors', label: 'المنتورز' },
  { href: '/teams', label: 'الفرق' },
  { href: '/marketplace', label: 'سوق العمل' },
  { href: '/startups', label: 'الشركات الناشئة' },
  { href: '/about', label: 'عن TechMood' },
];

export function SiteNav() {
  return (
    <nav className="landing-nav" aria-label="روابط الموقع">
      <Link className="site-brand" href="/">
        <span className="logo-mark" />
        TechMood
      </Link>

      <ul className="site-links">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>

      <div className="site-actions">
        <Link className="btn btn-ghost btn-sm" href="/login">تسجيل الدخول</Link>
        <Link className="btn btn-primary btn-sm" href="/signup">أنشئ حسابك</Link>
      </div>
    </nav>
  );
}
