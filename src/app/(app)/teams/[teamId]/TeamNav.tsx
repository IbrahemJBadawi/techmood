'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'نظرة عامة' },
  { href: '/tasks', label: 'المهام' },
  { href: '/sprints', label: 'السبرنتات' },
  { href: '/members', label: 'الأعضاء' },
];

export function TeamNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  const base = `/teams/${teamId}`;

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
