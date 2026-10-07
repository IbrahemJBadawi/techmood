'use client';

import { SearchBox } from '@/components/SearchBox';

/** The search box in the wide top bar; it suggests while typing, like the one on /search. */
export function HeaderSearch({ initial = '' }: { initial?: string }) {
  return <SearchBox initial={initial} variant="header" />;
}
