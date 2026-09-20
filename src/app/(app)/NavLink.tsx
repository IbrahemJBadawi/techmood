'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link className={`navlink${isActive ? ' active' : ''}`} href={href} aria-current={isActive ? 'page' : undefined}>
      <span>{children}</span>
    </Link>
  );
}
