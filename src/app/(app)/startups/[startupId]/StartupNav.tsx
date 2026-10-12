'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n.client';
import { STUDIO_TOOLS } from '@/lib/studio-tools';

/**
 * The workspace's own navigation.
 *
 * It is a room with sections, not a profile with tabs: the six studio tools
 * come first (0166) — market, competitors, users, feasibility, the plan and
 * the model — then deciding (strategy, incubation), doing (roadmap,
 * projects, team, hiring) and finally showing (documents, sharing).
 */
const TABS = [
  { href: '',              label: { ar: 'نظرة عامة',   en: 'Overview' } },
  ...STUDIO_TOOLS.map((tool) => ({ href: tool.href, label: tool.label })),
  { href: '/strategy',     label: { ar: 'الاستراتيجية', en: 'Strategy' } },
  { href: '/incubation',   label: { ar: 'الاحتضان',    en: 'Incubation' } },
  { href: '/roadmap',      label: { ar: 'خارطة الطريق', en: 'Roadmap' } },
  { href: '/projects',     label: { ar: 'المشاريع',    en: 'Projects' } },
  { href: '/team',         label: { ar: 'الفريق',      en: 'Team' } },
  { href: '/hiring',       label: { ar: 'التوظيف',     en: 'Hiring' } },
  { href: '/mentors',      label: { ar: 'المنتورون',   en: 'Mentors' } },
  { href: '/documents',    label: { ar: 'المستندات',   en: 'Documents' } },
  { href: '/share',        label: { ar: 'المشاركة',    en: 'Sharing' } },
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
