'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n.client';

/**
 * The workspace's own navigation.
 *
 * It is a room with sections, not a profile with tabs: the order runs from
 * thinking (canvases, plans) through deciding (strategy, incubation) to doing
 * (projects, team, hiring) and finally to showing (documents, showcase).
 */
const TABS = [
  { href: '',              label: { ar: 'نظرة عامة',   en: 'Overview' } },
  { href: '/incubation',   label: { ar: 'الاحتضان',    en: 'Incubation' } },
  { href: '/canvases',     label: { ar: 'اللوحات',     en: 'Canvases' } },
  { href: '/plan',         label: { ar: 'خطة العمل',   en: 'Business plan' } },
  { href: '/strategy',     label: { ar: 'الاستراتيجية', en: 'Strategy' } },
  { href: '/projects',     label: { ar: 'المشاريع',    en: 'Projects' } },
  { href: '/team',         label: { ar: 'الفريق',      en: 'Team' } },
  { href: '/hiring',       label: { ar: 'التوظيف',     en: 'Hiring' } },
  { href: '/documents',    label: { ar: 'المستندات',   en: 'Documents' } },
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
