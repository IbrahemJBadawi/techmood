import type { LinkKind } from '@/lib/database.types';

/**
 * The main accounts (0123): set apart from every other link in Settings and on
 * the portfolio, one of each. Everything else is "other links".
 */
export const PRIMARY_LINK_KINDS = ['cv', 'linkedin', 'github', 'behance', 'youtube'] as const satisfies readonly LinkKind[];

export const PRIMARY_LINK_LABEL: Record<(typeof PRIMARY_LINK_KINDS)[number], { ar: string; en: string; placeholder: string }> = {
  cv:       { ar: 'السيرة الذاتية (CV)', en: 'CV', placeholder: 'https://drive.google.com/…' },
  linkedin: { ar: 'LinkedIn', en: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
  github:   { ar: 'GitHub', en: 'GitHub', placeholder: 'https://github.com/…' },
  behance:  { ar: 'Behance', en: 'Behance', placeholder: 'https://behance.net/…' },
  youtube:  { ar: 'YouTube', en: 'YouTube', placeholder: 'https://youtube.com/@…' },
};

export const isPrimaryLink = (kind: string) => (PRIMARY_LINK_KINDS as readonly string[]).includes(kind);
