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
export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: IconName;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={`navlink${isActive ? ' active' : ''}`}
      href={href}
      title={typeof children === 'string' ? children : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <Icon name={icon} />}
      <span className="navlink-label">{children}</span>
    </Link>
  );
}
