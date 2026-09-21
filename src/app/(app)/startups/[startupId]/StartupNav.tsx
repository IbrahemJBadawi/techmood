'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n.client';

const TABS = [
  { href: '',          label: { ar: 'نظرة عامة',    en: 'Overview' } },
  { href: '/canvas',   label: { ar: 'نموذج العمل',  en: 'Business model' } },
  { href: '/plan',     label: { ar: 'خطة العمل',    en: 'Business plan' } },
  { href: '/strategy', label: { ar: 'الاستراتيجية', en: 'Strategy' } },
];

export function StartupNav({ startupId }: { startupId: string }) {
  const t = useT();
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
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
