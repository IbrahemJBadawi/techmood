import Link from 'next/link';

/**
 * The way back (design lab 3: «سهم بشريط العنوان»): a round arrow and the
 * name of where it leads, sitting above the page title like an app's top bar,
 * instead of an outlined «→ رجوع» button.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back-bar" href={href}>
      <span className="back-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4"
             strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </span>
      <span className="back-label">{label}</span>
    </Link>
  );
}
