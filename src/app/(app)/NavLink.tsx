'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { Icon } from '@/components/Icon';
import type { IconName } from '@/lib/roles';

/**
 * The label is always in the DOM, even in the compact rail on a phone, where CSS
 * hides it visually — a nav that is only icons must still be readable by a
 * screen reader.
 */
const matches = (pathname: string, search: URLSearchParams, href: string) => {
  const [path, query] = href.split('?');
  if (!(pathname === path || pathname.startsWith(`${path}/`))) return false;
  // /marketplace?tab=talent lights on that tab only, not on the whole market
  if (!query || pathname !== path) return true;
  return [...new URLSearchParams(query)].every(([key, value]) => search.get(key) === value);
};

type NavLinkProps = {
  href: string;
  icon?: IconName;
  /** Every link in the same navigation: a deeper one that also matches wins. */
  siblings?: string[];
  /** A blue count beside the label (unread messages, 0126). */
  count?: number;
  children: React.ReactNode;
};

/**
 * Reading the query (useSearchParams) needs a Suspense boundary wherever a
 * page could be rendered ahead of time; until it resolves the link is drawn
 * from the path alone.
 */
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkView {...props} search={EMPTY} />}>
      <NavLinkWithQuery {...props} />
    </Suspense>
  );
}

const EMPTY = new URLSearchParams();

function NavLinkWithQuery(props: NavLinkProps) {
  const search = useSearchParams();
  return <NavLinkView {...props} search={search} />;
}

function NavLinkView({
  href,
  icon,
  siblings = [],
  count = 0,
  children,
  search,
}: NavLinkProps & { search: URLSearchParams }) {
  const pathname = usePathname();
  // "Session requests" and "My prices" (/mentor-requests/pricing) both match
  // the prices page; only the closest one lights up.
  const isActive = matches(pathname, search, href)
    && !siblings.some((other) => other !== href && other.startsWith(`${href}/`) && matches(pathname, search, other));

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
