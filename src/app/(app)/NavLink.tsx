'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/Icon';
import type { IconName } from '@/lib/roles';

/**
 * The label is always in the DOM, even in the compact rail on a phone, where CSS
 * hides it visually — a nav that is only icons must still be readable by a
 * screen reader.
 */
const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function NavLink({
  href,
  icon,
  siblings = [],
  count = 0,
  children,
}: {
  href: string;
  icon?: IconName;
  /** Every link in the same navigation: a deeper one that also matches wins. */
  siblings?: string[];
  /** A blue count beside the label (unread messages, 0126). */
  count?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // "Session requests" and "My prices" (/mentor-requests/pricing) both match
  // the prices page; only the closest one lights up.
  const isActive = matches(pathname, href)
    && !siblings.some((other) => other !== href && other.startsWith(`${href}/`) && matches(pathname, other));

  return (
    <Link
      className={`navlink${isActive ? ' active' : ''}`}
      href={href}
      title={typeof children === 'string' ? children : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <Icon name={icon} />}
      <span className="navlink-label">{children}</span>
      {count > 0 && <span className="nav-count eng" aria-label={String(count)}>{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
