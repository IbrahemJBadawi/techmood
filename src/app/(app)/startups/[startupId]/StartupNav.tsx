'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'نظرة عامة' },
  { href: '/canvas', label: 'نموذج العمل' },
  { href: '/plan', label: 'خطة العمل' },
  { href: '/strategy', label: 'الاستراتيجية' },
];

export function StartupNav({ startupId }: { startupId: string }) {
  const pathname = usePathname();
  const base = `/startups/${startupId}`;

  return (
    <div className="date-tabs" style={{ marginBottom: 20 }}>
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`date-tab${active ? ' selected' : ''}`}
            style={{ textDecoration: 'none', minWidth: 0, padding: '8px 16px' }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
