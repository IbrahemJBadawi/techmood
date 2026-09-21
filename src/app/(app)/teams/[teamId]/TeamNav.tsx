'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useT } from '@/lib/i18n.client';

const TABS = [
  { href: '',          label: { ar: 'نظرة عامة',  en: 'Overview' } },
  { href: '/tasks',     label: { ar: 'المهام',      en: 'Tasks' } },
  { href: '/projects',  label: { ar: 'المشاريع',    en: 'Projects' } },
  { href: '/sprints',   label: { ar: 'السبرنتات',   en: 'Sprints' } },
  { href: '/members',   label: { ar: 'الأعضاء',     en: 'Members' } },
  { href: '/calendar',  label: { ar: 'التقويم',     en: 'Calendar' } },
  { href: '/documents', label: { ar: 'المستندات',   en: 'Documents' } },
  { href: '/settings',  label: { ar: 'الإعدادات',   en: 'Settings' } },
];

export function TeamNav({ teamId }: { teamId: string }) {
  const t = useT();
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
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
